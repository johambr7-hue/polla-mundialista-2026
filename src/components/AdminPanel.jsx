import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, ClipboardList, Database, Download, GitBranch, Lock, LogIn, Power, RefreshCcw, RotateCcw, Save, Settings, Unlock, Upload } from 'lucide-react';
import { downloadCsv } from '../utils/exportCsv';
import { formatCop } from '../utils/formatters';
import { getGroupPredictionStatus, importGroupPredictions, reprocessGroupPredictions } from '../utils/importGroupPredictions';
import { buildMasterImportState, validateMasterCsv } from '../utils/importMasterCsv';
import { displayMatch, displayTeam } from '../utils/localization';
import { getKnockoutPhaseReadiness, isKnockoutPhaseActivated, isKnockoutStage, knockoutPhaseOrder } from '../utils/scoring';
import { resolveOfficialMatches } from '../utils/officialBracket';
import { validateTournamentEntry } from '../utils/tournament';

const finalFields = [
  ['champion', 'Campeón'],
  ['second', 'Segundo lugar'],
  ['third', 'Tercer lugar'],
  ['fourth', 'Cuarto lugar']
];

const classificationMethods = [
  ['regulation', 'Tiempo reglamentario'],
  ['extraTime', 'Prórroga'],
  ['penalties', 'Penales']
];

const methodLabels = Object.fromEntries(classificationMethods);

const adminTabs = [
  { id: 'results', label: 'Resultados', icon: ClipboardList },
  { id: 'dashboard', label: 'Resumen', icon: BarChart3 },
  { id: 'bracketActivation', label: 'Activación de llaves', icon: GitBranch },
  { id: 'imports', label: 'Importaciones', icon: Upload },
  { id: 'polls', label: 'Pollas', icon: Database },
  { id: 'settings', label: 'Configuración', icon: Settings }
];

const createResultDrafts = (matches) =>
  Object.fromEntries(
    matches.map((match) => [
      match.id,
      {
        realHomeScore: match.realHomeScore ?? '',
        realAwayScore: match.realAwayScore ?? '',
        qualifiedTeam: match.qualifiedTeam ?? '',
        classificationMethod: match.classificationMethod ?? '',
        status: match.status ?? 'pendiente'
      }
    ])
  );

function AdminPanel({
  adminError,
  adminPassword,
  collection,
  finalResults,
  handleAdminLogin,
  isAdmin,
  migrateInitialData,
  matches,
  participants,
  predictions,
  prizes,
  ranking,
  resetData,
  setAdminError,
  setAdminPassword,
  settings,
  tournamentEntries,
  updateFinalResults,
  updateMasterState,
  updateMatches,
  updateSettings,
  updateTournamentEntries
}) {
  const [resultDrafts, setResultDrafts] = useState(() => createResultDrafts(matches));
  const [predictionImportSummary, setPredictionImportSummary] = useState(null);
  const [masterImport, setMasterImport] = useState({ fileName: '', csvText: '', validation: null });
  const [initialMigration, setInitialMigration] = useState({ loading: false, summary: null, error: '', status: '' });
  const [activeAdminTab, setActiveAdminTab] = useState('results');
  const [resultStatusFilter, setResultStatusFilter] = useState('pendiente');
  const [resultStageFilter, setResultStageFilter] = useState('all');

  useEffect(() => {
    setResultDrafts(createResultDrafts(matches));
  }, [matches]);

  const resolvedOfficialMatches = useMemo(() => resolveOfficialMatches(matches), [matches]);
  const resolvedMatchById = useMemo(
    () => new Map(resolvedOfficialMatches.map((match) => [match.id, match])),
    [resolvedOfficialMatches]
  );
  const sortedMatches = useMemo(
    () => [...resolvedOfficialMatches].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [resolvedOfficialMatches]
  );

  const pendingMatches = sortedMatches.filter((match) => match.status !== 'jugado');
  const finishedMatches = sortedMatches.filter((match) => match.status === 'jugado');
  const stageOptions = [...new Set(sortedMatches.map((match) => match.stage).filter(Boolean))];
  const visibleResultMatches = sortedMatches.filter((match) => {
    const statusMatches =
      resultStatusFilter === 'all' ||
      (resultStatusFilter === 'pendiente' && match.status !== 'jugado') ||
      (resultStatusFilter === 'jugado' && match.status === 'jugado');
    const stageMatches = resultStageFilter === 'all' || match.stage === resultStageFilter;
    return statusMatches && stageMatches;
  });
  const leader = ranking[0];
  const topFive = ranking.slice(0, 5);
  const tournamentStatus = participants.map((participant) => {
    const entry = tournamentEntries?.[participant.id] ?? {};
    const validation = validateTournamentEntry(matches, entry);
    return {
      participant,
      complete: Boolean(entry.complete) || validation.complete,
      missing: validation.missing.length,
      submittedAt: entry.submittedAt ?? '',
      finalResults: entry.finalResults ?? validation.bracket.finalResults
    };
  });

  const closePendingMatches = () => {
    updateMatches(
      matches.map((match) =>
        match.realHomeScore !== '' && match.realAwayScore !== '' ? { ...match, status: 'jugado' } : match
      )
    );
  };

  const togglePredictionLock = () => {
    updateSettings({
      ...settings,
      predictionsLocked: !settings.predictionsLocked
    });
  };

  const toggleKnockoutPhase = (stage) => {
    const phaseStatus = getKnockoutPhaseReadiness(resolvedOfficialMatches, stage);
    const active = isKnockoutPhaseActivated(settings, stage);
    if (!active && !phaseStatus.ready) return;

    updateSettings({
      ...settings,
      knockoutPhaseActivation: {
        ...(settings.knockoutPhaseActivation ?? {}),
        [stage]: !active
      }
    });
  };

  const completeKnockoutDraft = (match, draft = {}) => {
    if (
      !match ||
      !isKnockoutStage(match.stage) ||
      draft.realHomeScore === '' ||
      draft.realHomeScore == null ||
      draft.realAwayScore === '' ||
      draft.realAwayScore == null
    ) {
      return draft;
    }

    const homeGoals = Number(draft.realHomeScore);
    const awayGoals = Number(draft.realAwayScore);

    if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals) || homeGoals === awayGoals) {
      return draft;
    }

    return {
      ...draft,
      qualifiedTeam: draft.qualifiedTeam || (homeGoals > awayGoals ? match.homeTeam : match.awayTeam),
      classificationMethod: draft.classificationMethod || 'regulation'
    };
  };

  const isValidResultDraft = (match, draft = {}) => {
    const knockout = isKnockoutStage(match.stage);

    if (
      draft.realHomeScore === '' ||
      draft.realHomeScore == null ||
      draft.realAwayScore === '' ||
      draft.realAwayScore == null
    ) {
      return false;
    }
    if (!knockout) return true;
    if (!draft.qualifiedTeam || !draft.classificationMethod) return false;

    const homeGoals = Number(draft.realHomeScore);
    const awayGoals = Number(draft.realAwayScore);

    if (homeGoals === awayGoals && draft.classificationMethod === 'regulation') return false;

    return true;
  };

  const updateResultDraft = (matchId, field, value) => {
    const resolvedMatch = resolvedMatchById.get(matchId);

    setResultDrafts((current) => {
      const nextDraft = {
        ...current[matchId],
        [field]: value
      };

      return {
        ...current,
        [matchId]: completeKnockoutDraft(resolvedMatch, nextDraft)
      };
    });
  };

  const saveOfficialResult = (match) => {
    const draft = completeKnockoutDraft(match, resultDrafts[match.id]);
    const knockout = isKnockoutStage(match.stage);

    if (!isValidResultDraft(match, draft)) return;

    updateMatches(
      matches.map((item) =>
        item.id === match.id
          ? {
              ...item,
              homeTeam: knockout ? match.homeTeam : item.homeTeam,
              awayTeam: knockout ? match.awayTeam : item.awayTeam,
              realHomeScore: Number(draft.realHomeScore),
              realAwayScore: Number(draft.realAwayScore),
              qualifiedTeam: knockout ? draft.qualifiedTeam : draft.qualifiedTeam || '',
              classificationMethod: knockout ? draft.classificationMethod : draft.classificationMethod || 'regulation',
              status: 'jugado'
            }
          : item
      )
    );
  };

  const saveAllCompleteResults = () => {
    updateMatches(
      matches.map((match) => {
        const resolvedMatch = resolvedMatchById.get(match.id) ?? match;
        const draft = completeKnockoutDraft(resolvedMatch, resultDrafts[match.id]);
        const knockout = isKnockoutStage(match.stage);

        if (!isValidResultDraft(resolvedMatch, draft)) return match;

        return {
          ...match,
          homeTeam: knockout ? resolvedMatch.homeTeam : match.homeTeam,
          awayTeam: knockout ? resolvedMatch.awayTeam : match.awayTeam,
          realHomeScore: Number(draft.realHomeScore),
          realAwayScore: Number(draft.realAwayScore),
          qualifiedTeam: knockout ? draft.qualifiedTeam : draft.qualifiedTeam || '',
          classificationMethod: knockout ? draft.classificationMethod : draft.classificationMethod || 'regulation',
          status: 'jugado'
        };
      })
    );
  };

  const updateSetting = (field, value) => {
    updateSettings({ ...settings, [field]: field === 'predictionDeadline' ? value : Number(value) });
  };

  const updatePhasePoints = (stage, field, value) => {
    updateSettings({
      ...settings,
      scoring: {
        ...settings.scoring,
        [stage]: {
          ...settings.scoring[stage],
          [field]: Number(value)
        }
      }
    });
  };

  const updateFinalPoints = (field, value) => {
    updateSettings({
      ...settings,
      finalResultsPoints: {
        ...settings.finalResultsPoints,
        [field]: Number(value)
      }
    });
  };

  const exportPredictions = () => {
    downloadCsv('polla-mundialista-predicciones.csv', [
      ['Participante', 'Partido', 'Llave 1', 'Llave 2', 'Marcador local', 'Marcador visitante', 'Ganador por penales'],
      ...predictions.map((prediction) => {
        const participant = participants.find((item) => item.id === prediction.participantId);
        const match = matches.find((item) => item.id === prediction.matchId);
        return [
          participant?.name ?? 'Participante eliminado',
          match ? displayMatch(match) : 'Partido eliminado',
          displayTeam(prediction.predictedHomeTeam ?? match?.homeTeam ?? ''),
          displayTeam(prediction.predictedAwayTeam ?? match?.awayTeam ?? ''),
          prediction.homeScore,
          prediction.awayScore,
          prediction.penaltyWinner ?? ''
        ];
      })
    ]);
  };

  const exportTournamentEntries = () => {
    downloadCsv('polla-mundialista-completa.csv', [
      ['Participante', 'Estado', 'Faltantes', 'Fecha envío', 'Campeón', 'Segundo', 'Tercero', 'Cuarto'],
      ...tournamentStatus.map((item) => [
        item.participant.name,
        item.complete ? 'Completa' : 'Incompleta',
        item.missing,
        item.submittedAt,
        displayTeam(item.finalResults.champion ?? ''),
        displayTeam(item.finalResults.second ?? ''),
        displayTeam(item.finalResults.third ?? ''),
        displayTeam(item.finalResults.fourth ?? '')
      ])
    ]);
  };

  const exportRanking = () => {
    downloadCsv('polla-mundialista-ranking.csv', [
      [
        'Posicion',
        'Nombre',
        'Puntos',
        'Fase de grupos',
        'Eliminatorias',
        'Resultados finales',
        'Exactos',
        'Llaves',
        'Clasificados'
      ],
      ...ranking.map((item) => [
        item.position,
        item.name,
        item.totalPoints,
        item.groupPoints,
        item.knockoutPoints,
        item.finalPoints,
        item.exactScores,
        item.bracketHits,
        item.qualifiedTeamHits
      ])
    ]);
  };

  const exportImportErrors = () => {
    const errors = masterImport.validation?.summary?.errors ?? [];
    downloadCsv('errores-importacion-csv-maestro.csv', [
      ['Error'],
      ...errors.map((error) => [error])
    ]);
  };

  const exportParticipants = () => {
    downloadCsv('participantes.csv', [
      ['Nombre', 'Correo', 'Telefono', 'Pago', 'Medio de pago'],
      ...participants.map((participant) => [
        participant.name,
        participant.email,
        participant.phone,
        participant.paid ? 'Si' : 'No',
        participant.paymentMethod
      ])
    ]);
  };

  const exportPhasePoints = () => {
    downloadCsv('puntos-por-fase.csv', [
      ['Fase', 'Ganador/empate', 'Equipo clasificado', 'Llave acertada', 'Marcador exacto'],
      ...Object.entries(settings.scoring).map(([stage, values]) => [
        stage,
        values.result,
        values.qualifiedTeam,
        values.bracket,
        values.exactScore
      ])
    ]);
  };

  const selectMasterFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const csvText = await file.text();
    setMasterImport({
      fileName: file.name,
      csvText,
      validation: validateMasterCsv({ csvText, existingMatches: matches })
    });
  };

  const validateMasterFile = () => {
    if (!masterImport.csvText) return;
    setMasterImport((current) => ({
      ...current,
      validation: validateMasterCsv({ csvText: current.csvText, existingMatches: matches })
    }));
  };

  const importMasterFile = ({ clearFirst = false } = {}) => {
    if (!masterImport.csvText) return;
    if ((clearFirst || participants.length || predictions.length || Object.keys(tournamentEntries ?? {}).length) &&
      !window.confirm('Esta acción eliminará participantes, predicciones y llaves actuales. ¿Deseas continuar?')) {
      return;
    }

    const result = buildMasterImportState({
      csvText: masterImport.csvText,
      existingMatches: matches,
      settings
    });

    setMasterImport((current) => ({ ...current, validation: result.validation }));
    if (!result.validation.ok || !result.state) return;

    updateMasterState(result.state);
  };

  const importPredictionFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const csvText = await file.text();
      const result = importGroupPredictions({
        csvText,
        participants,
        matches,
        tournamentEntries
      });

      updateTournamentEntries(result.tournamentEntries);
      setPredictionImportSummary(result.summary);
    } catch (error) {
      setPredictionImportSummary({
        foundParticipantCount: 0,
        notFoundParticipants: [],
        imported: 0,
        updated: 0,
        errors: [error.message],
        incompleteParticipants: []
      });
    }
  };

  const reprocessImportedBrackets = () => {
    const reprocessedEntries = reprocessGroupPredictions(matches, tournamentEntries);
    const incompleteParticipants = participants
      .map((participant) => {
        const status = getGroupPredictionStatus(matches, reprocessedEntries[participant.id]);
        return { participant, ...status };
      })
      .filter((item) => !item.groupStageComplete);

    updateTournamentEntries(reprocessedEntries);
    setPredictionImportSummary({
      foundParticipantCount: Object.values(reprocessedEntries).filter((entry) => entry.groupStageComplete).length,
      notFoundParticipants: [],
      imported: 0,
      updated: 0,
      errors: [],
      incompleteParticipants
    });
  };

  const runInitialMigration = async () => {
    console.log('Ejecutando migración inicial a Supabase');
    if (!migrateInitialData) {
      setInitialMigration({
        loading: false,
        summary: null,
        error: 'La función de migración inicial no está conectada.',
        status: ''
      });
      return;
    }

    setInitialMigration({ loading: true, summary: null, error: '', status: 'Preparando migración inicial...' });
    try {
      const summary = await migrateInitialData((status) => {
        setInitialMigration((current) => ({ ...current, status }));
      });
      setInitialMigration({
        loading: false,
        summary,
        error: summary ? '' : 'Migración cancelada por el usuario.',
        status: summary ? 'Migración finalizada.' : ''
      });
    } catch (error) {
      console.error('Error migrando datos iniciales a Supabase', error);
      setInitialMigration({
        loading: false,
        summary: null,
        error: error.message ?? 'No se pudo migrar la información inicial.',
        status: ''
      });
    }
  };

  return (
    <section className="stack-list">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Panel de administración</h3>
            <p className="muted">Acciones principales para administrar resultados, importaciones y configuración.</p>
          </div>
        </div>

        {!isAdmin && (
          <form className="admin-panel-login" onSubmit={handleAdminLogin}>
            <div className="notice">Entra como administrador para habilitar estas acciones.</div>
            <div className="inline-form wide">
              <input
                aria-label="Clave de administrador"
                onChange={(event) => {
                  setAdminPassword(event.target.value);
                  setAdminError('');
                }}
                placeholder="Clave de administrador"
                type="password"
                value={adminPassword}
              />
              <button className="primary-button" type="submit">
                <LogIn size={18} />
                Entrar
              </button>
            </div>
            {adminError && <p className="form-error">{adminError}</p>}
          </form>
        )}

        <div className="admin-actions">
          <button className="primary-button" disabled={!isAdmin} onClick={closePendingMatches} type="button">
            <RefreshCcw size={18} />
            Cerrar partidos con resultado
          </button>
          <button className="secondary-button" disabled={!isAdmin} onClick={exportRanking} type="button">
            <Download size={18} />
            Exportar tabla
          </button>
          <button className="secondary-button" disabled={!isAdmin} onClick={exportPredictions} type="button">
            <Download size={18} />
            Exportar predicciones
          </button>
          <button className="secondary-button" disabled={!isAdmin} onClick={exportTournamentEntries} type="button">
            <Download size={18} />
            Exportar pollas completas
          </button>
          <button className="secondary-button" disabled={!isAdmin} onClick={exportParticipants} type="button">
            <Download size={18} />
            Exportar participantes
          </button>
          <button className="secondary-button" disabled={!isAdmin} onClick={exportPhasePoints} type="button">
            <Download size={18} />
            Exportar puntos por fase
          </button>
          <button className={settings.predictionsLocked ? 'secondary-button' : 'primary-button'} disabled={!isAdmin} onClick={togglePredictionLock} type="button">
            {settings.predictionsLocked ? <Unlock size={18} /> : <Lock size={18} />}
            {settings.predictionsLocked ? 'Abrir pronósticos' : 'Cerrar pronósticos'}
          </button>
          <button
            className="secondary-button"
            disabled={!isAdmin || initialMigration.loading}
            onClick={runInitialMigration}
            type="button"
          >
            <Upload size={18} />
            {initialMigration.loading ? 'Migrando datos...' : 'Migrar datos iniciales'}
          </button>
          <button className="danger-button" disabled={!isAdmin} onClick={resetData} type="button">
            <RotateCcw size={18} />
            Restaurar datos oficiales
          </button>
        </div>
        {initialMigration.status && <div className="notice">{initialMigration.status}</div>}
        {settings.predictionsLocked && (
          <div className="notice">
            Pronósticos cerrados: los participantes no pueden modificar marcadores ni resultados finales. Solo el administrador puede corregir.
          </div>
        )}
        {initialMigration.error && <div className="notice error-notice">{initialMigration.error}</div>}
        {initialMigration.summary && (
          <div className="notice success-notice">
            Migración lista: {initialMigration.summary.participantsCreated} participantes creados,{' '}
            {initialMigration.summary.participantsUpdated} actualizados, {initialMigration.summary.matchesCreated} partidos creados,{' '}
            {initialMigration.summary.predictionsStored ?? initialMigration.summary.predictionsCreated} de{' '}
            {initialMigration.summary.predictionsExpected ?? 'las'} predicciones verificadas y{' '}
            {initialMigration.summary.duplicatePredictionsDeleted ?? 0} duplicadas limpiadas.
          </div>
        )}
      </div>

      <div className="summary-grid">
        <article>
          <span>Partidos pendientes</span>
          <strong>{pendingMatches.length}</strong>
        </article>
        <article>
          <span>Partidos finalizados</span>
          <strong>{finishedMatches.length}</strong>
        </article>
        <article>
          <span>Pronósticos registrados</span>
          <strong>{predictions.length}</strong>
        </article>
        <article>
          <span>Participante líder</span>
          <strong>{leader ? `${leader.name} (${leader.totalPoints})` : 'Sin datos'}</strong>
        </article>
      </div>

      <div className="admin-tab-strip" role="tablist" aria-label="Secciones de administración">
        {adminTabs.map(({ id, label, icon: Icon }) => (
          <button
            aria-selected={activeAdminTab === id}
            className={activeAdminTab === id ? 'active' : ''}
            key={id}
            onClick={() => setActiveAdminTab(id)}
            role="tab"
            type="button"
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {activeAdminTab === 'imports' && (
      <>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Migrar datos iniciales a Supabase</h3>
            <p className="muted">Carga la polla completa desde master_state.json usando UUID reales generados por Supabase.</p>
          </div>
          <Database size={18} />
        </div>
        <div className="admin-actions">
          <button className="primary-button" disabled={!isAdmin || initialMigration.loading} onClick={runInitialMigration} type="button">
            <Upload size={18} />
            {initialMigration.loading ? 'Migrando...' : 'Migrar datos iniciales a Supabase'}
          </button>
        </div>
        {initialMigration.status && <div className="notice">{initialMigration.status}</div>}
        {initialMigration.error && <div className="notice error-notice">{initialMigration.error}</div>}
        {initialMigration.summary && (
          <div className="stack-list tight">
            <div className="summary-grid">
              <article>
                <span>Participantes creados</span>
                <strong>{initialMigration.summary.participantsCreated}</strong>
              </article>
              <article>
                <span>Participantes actualizados</span>
                <strong>{initialMigration.summary.participantsUpdated}</strong>
              </article>
              <article>
                <span>Partidos creados</span>
                <strong>{initialMigration.summary.matchesCreated}</strong>
              </article>
              <article>
                <span>Partidos actualizados</span>
                <strong>{initialMigration.summary.matchesUpdated}</strong>
              </article>
              <article>
                <span>Predicciones creadas</span>
                <strong>{initialMigration.summary.predictionsCreated}</strong>
              </article>
              <article>
                <span>Predicciones actualizadas</span>
                <strong>{initialMigration.summary.predictionsUpdated}</strong>
              </article>
              <article>
                <span>Predicciones esperadas</span>
                <strong>{initialMigration.summary.predictionsExpected ?? 0}</strong>
              </article>
              <article>
                <span>Predicciones verificadas</span>
                <strong>{initialMigration.summary.predictionsStored ?? 0}</strong>
              </article>
              <article>
                <span>Predicciones faltantes</span>
                <strong>{initialMigration.summary.predictionsMissing ?? 0}</strong>
              </article>
              <article>
                <span>Faltantes recuperadas</span>
                <strong>{initialMigration.summary.predictionRepairCreated ?? 0}</strong>
              </article>
              <article>
                <span>Pagos creados</span>
                <strong>{initialMigration.summary.paymentsCreated}</strong>
              </article>
              <article>
                <span>Predicciones duplicadas limpiadas</span>
                <strong>{initialMigration.summary.duplicatePredictionsDeleted ?? 0}</strong>
              </article>
              <article>
                <span>Registros omitidos</span>
                <strong>{initialMigration.summary.omitted.length}</strong>
              </article>
            </div>
            {initialMigration.summary.errors.length > 0 && (
              <div className="notice error-notice">
                Errores: {initialMigration.summary.errors.slice(0, 6).join(' | ')}
                {initialMigration.summary.errors.length > 6 ? ` y ${initialMigration.summary.errors.length - 6} más.` : ''}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Importar CSV maestro</h3>
            <p className="muted">Crea participantes, partidos, predicciones, llaves y resultados finales desde el archivo maestro.</p>
          </div>
          <Upload size={18} />
        </div>
        <div className="admin-actions">
          <label className={isAdmin ? 'file-upload' : 'file-upload disabled'}>
            <Upload size={18} />
            Seleccionar CSV maestro
            <input accept=".csv,text/csv" disabled={!isAdmin} onChange={selectMasterFile} type="file" />
          </label>
          <button className="secondary-button" disabled={!isAdmin || !masterImport.csvText} onClick={validateMasterFile} type="button">
            <RefreshCcw size={18} />
            Validar archivo
          </button>
          <button className="primary-button" disabled={!isAdmin || !masterImport.validation?.ok} onClick={() => importMasterFile()} type="button">
            <Save size={18} />
            Importar definitivamente
          </button>
          <button className="danger-button" disabled={!isAdmin || !masterImport.validation?.ok} onClick={() => importMasterFile({ clearFirst: true })} type="button">
            <RotateCcw size={18} />
            Borrar datos actuales e importar desde cero
          </button>
          <button className="secondary-button" disabled={!masterImport.validation?.summary?.errors?.length} onClick={exportImportErrors} type="button">
            <Download size={18} />
            Exportar errores
          </button>
        </div>

        {masterImport.fileName && <p className="muted">Archivo seleccionado: <strong>{masterImport.fileName}</strong></p>}

        {masterImport.validation && (
          <div className="stack-list tight">
            <div className="summary-grid">
              <article>
                <span>Participantes detectados</span>
                <strong>{masterImport.validation.summary.participantCount}</strong>
              </article>
              <article>
                <span>Partidos por participante</span>
                <strong>{masterImport.validation.summary.matchesPerParticipant}</strong>
              </article>
              <article>
                <span>Predicciones</span>
                <strong>{masterImport.validation.summary.predictionsCount}</strong>
              </article>
              <article>
                <span>Errores</span>
                <strong>{masterImport.validation.summary.errors.length}</strong>
              </article>
            </div>
            {masterImport.validation.summary.warnings.length > 0 && (
              <div className="notice">
                Advertencias: {masterImport.validation.summary.warnings.join(' ')}
              </div>
            )}
            {masterImport.validation.summary.errors.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reporte de validación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterImport.validation.summary.errors.slice(0, 40).map((error) => (
                      <tr key={error}>
                        <td>{error}</td>
                      </tr>
                    ))}
                    {masterImport.validation.summary.errors.length > 40 && (
                      <tr>
                        <td>{masterImport.validation.summary.errors.length - 40} errores adicionales. Exporta el reporte para verlos todos.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="notice success-notice">Archivo válido. La importación dejará la polla lista para ingresar resultados reales.</div>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Importar Predicciones</h3>
            <p className="muted">Carga un CSV de fase de grupos para asignar marcadores, calcular tablas y generar dieciseisavos.</p>
          </div>
          <Upload size={18} />
        </div>
        <div className="import-format">
          <strong>Columnas aceptadas</strong>
          <code>Participante, Grupo, Equipo Local, Equipo Visitante, Goles Local, Goles Visitante</code>
          <code>participant, group, home_team, away_team, pred_home_goals, pred_away_goals</code>
        </div>
        <div className="admin-actions">
          <label className={isAdmin ? 'file-upload' : 'file-upload disabled'}>
            <Upload size={18} />
            Seleccionar CSV
            <input accept=".csv,text/csv" disabled={!isAdmin} onChange={importPredictionFile} type="file" />
          </label>
          <button className="secondary-button" disabled={!isAdmin} onClick={reprocessImportedBrackets} type="button">
            <RefreshCcw size={18} />
            Reprocesar clasificaciones y llaves
          </button>
        </div>
        {predictionImportSummary && (
          <div className="stack-list tight">
            <div className="summary-grid">
              <article>
                <span>Participantes encontrados</span>
                <strong>{predictionImportSummary.foundParticipantCount}</strong>
              </article>
              <article>
                <span>No encontrados</span>
                <strong>{predictionImportSummary.notFoundParticipants.length}</strong>
              </article>
              <article>
                <span>Importadas</span>
                <strong>{predictionImportSummary.imported}</strong>
              </article>
              <article>
                <span>Actualizadas</span>
                <strong>{predictionImportSummary.updated}</strong>
              </article>
            </div>
            {predictionImportSummary.notFoundParticipants.length > 0 && (
              <div className="notice">
                Participantes no encontrados: {predictionImportSummary.notFoundParticipants.join(', ')}
              </div>
            )}
            {predictionImportSummary.errors.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Errores encontrados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictionImportSummary.errors.slice(0, 30).map((error) => (
                      <tr key={error}>
                        <td>{error}</td>
                      </tr>
                    ))}
                    {predictionImportSummary.errors.length > 30 && (
                      <tr>
                        <td>{predictionImportSummary.errors.length - 30} errores adicionales.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Participante incompleto</th>
                    <th>Partidos faltantes</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionImportSummary.incompleteParticipants.length ? (
                    predictionImportSummary.incompleteParticipants.map((item) => (
                      <tr key={item.participant.id}>
                        <td><strong>{item.participant.name}</strong></td>
                        <td>
                          {item.missingMatches.length
            ? item.missingMatches.map((match) => `#${match.matchNumber} ${displayTeam(match.homeTeam)} vs ${displayTeam(match.awayTeam)}`).slice(0, 8).join(', ')
                            : 'Sin predicciones cargadas'}
                          {item.missingMatches.length > 8 ? ` y ${item.missingMatches.length - 8} mas` : ''}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">Todos los participantes tienen la fase de grupos completa.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {activeAdminTab === 'polls' && (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Control de pollas completas</h3>
            <p className="muted">Revisa quiénes completaron toda la predicción del torneo y quiénes tienen faltantes.</p>
          </div>
        </div>
        <div className="summary-grid">
          <article>
            <span>Completas</span>
            <strong>{tournamentStatus.filter((item) => item.complete).length}</strong>
          </article>
          <article>
            <span>Incompletas</span>
            <strong>{tournamentStatus.filter((item) => !item.complete).length}</strong>
          </article>
          <article>
            <span>Fecha limite</span>
            <strong>{settings.predictionDeadline || 'Sin definir'}</strong>
          </article>
          <article>
            <span>Total participantes</span>
            <strong>{participants.length}</strong>
          </article>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Estado</th>
                <th>Faltantes</th>
                <th>Fecha envío</th>
                <th>Campeón</th>
                <th>Segundo</th>
                <th>Tercero</th>
                <th>Cuarto</th>
              </tr>
            </thead>
            <tbody>
              {tournamentStatus.map((item) => (
                <tr key={item.participant.id}>
                  <td><strong>{item.participant.name}</strong></td>
                  <td>{item.complete ? 'Completa' : 'Incompleta'}</td>
                  <td>{item.missing}</td>
                  <td>{item.submittedAt ? new Date(item.submittedAt).toLocaleString('es-CO') : 'Sin envío'}</td>
                  <td>{item.finalResults.champion ? displayTeam(item.finalResults.champion) : '-'}</td>
                  <td>{item.finalResults.second ? displayTeam(item.finalResults.second) : '-'}</td>
                  <td>{item.finalResults.third ? displayTeam(item.finalResults.third) : '-'}</td>
                  <td>{item.finalResults.fourth ? displayTeam(item.finalResults.fourth) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {activeAdminTab === 'bracketActivation' && (
        <div className="panel bracket-activation-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Control de puntuación</span>
              <h3>Activación de llaves por fase</h3>
              <p className="muted">
                Activa los puntos de equipos clasificados, llaves y marcadores únicamente cuando todos los cruces reales de la fase estén definidos.
              </p>
            </div>
            <GitBranch size={22} />
          </div>

          <div className="notice">
            Al cambiar una fase, la tabla de posiciones y sus estadísticas se recalculan automáticamente para todos los participantes.
          </div>

          <div className="bracket-activation-grid">
            {knockoutPhaseOrder.map((stage) => {
              const status = getKnockoutPhaseReadiness(resolvedOfficialMatches, stage);
              const active = isKnockoutPhaseActivated(settings, stage);
              const phaseRules = settings.scoring?.[stage] ?? {};

              return (
                <article className={`bracket-activation-card ${active ? 'active' : ''}`} key={stage}>
                  <div className="bracket-activation-heading">
                    <div>
                      <span>{active ? 'Puntuación activa' : status.ready ? 'Lista para activar' : 'Esperando llaves'}</span>
                      <h4>{stage}</h4>
                    </div>
                    <span className={`activation-status ${active ? 'active' : status.ready ? 'ready' : 'waiting'}`}>
                      {active ? <CheckCircle2 size={16} /> : <Lock size={16} />}
                      {active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="activation-progress-copy">
                    <span>Llaves reales definidas</span>
                    <strong>{status.defined} / {status.expected}</strong>
                  </div>
                  <div className="activation-progress" aria-label={`${status.defined} de ${status.expected} llaves definidas`}>
                    <span style={{ width: `${status.expected ? Math.min((status.defined / status.expected) * 100, 100) : 0}%` }} />
                  </div>

                  <div className="activation-points">
                    <span><strong>{Number(phaseRules.qualifiedTeam ?? 0)}</strong> pts por equipo clasificado</span>
                    <span><strong>{Number(phaseRules.bracket ?? 0)}</strong> pts por llave</span>
                    <span><strong>{Number(phaseRules.exactScore ?? 0)}</strong> pts por marcador exacto</span>
                  </div>

                  {!status.ready && !active && (
                    <p className="activation-help">Faltan {Math.max(status.expected - status.defined, 0)} llaves por definir.</p>
                  )}

                  <button
                    className={active ? 'danger-button' : 'primary-button'}
                    disabled={!isAdmin || (!active && !status.ready)}
                    onClick={() => toggleKnockoutPhase(stage)}
                    type="button"
                  >
                    {active ? <Lock size={18} /> : <Power size={18} />}
                    {active ? 'Desactivar puntos' : 'Activar puntos'}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {activeAdminTab === 'dashboard' && (
      <>
      <div className="panel admin-dashboard-hero">
        <div>
          <span className="eyebrow">Centro de control</span>
          <h3>Resumen administrativo</h3>
          <p className="muted">Lo más importante de la polla en una vista rápida, sin listas interminables.</p>
        </div>
        <div className="admin-dashboard-kpis">
          <article>
            <span>Pendientes</span>
            <strong>{pendingMatches.length}</strong>
          </article>
          <article>
            <span>Finalizados</span>
            <strong>{finishedMatches.length}</strong>
          </article>
          <article>
            <span>Pollas completas</span>
            <strong>{tournamentStatus.filter((item) => item.complete).length}/{participants.length}</strong>
          </article>
          <article>
            <span>Líder</span>
            <strong>{leader ? `${leader.name} (${leader.totalPoints})` : 'Sin datos'}</strong>
          </article>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="panel admin-dashboard-card dashboard-card-wide">
          <div className="panel-heading">
            <div>
              <h3>Próximos pendientes</h3>
              <p className="muted">Ordenados por fecha y hora.</p>
            </div>
            <button className="secondary-button compact" onClick={() => setActiveAdminTab('results')} type="button">
              Ver resultados
            </button>
          </div>
          <div className="pending-list">
            {pendingMatches.length ? (
              pendingMatches.slice(0, 6).map((match) => (
                <article key={match.id}>
                  <span>{match.date} · {match.time}</span>
                  <strong>{displayMatch(match)}</strong>
                  <em>{match.stage}</em>
                </article>
              ))
            ) : (
              <p className="muted">No hay partidos pendientes.</p>
            )}
          </div>
          {pendingMatches.length > 6 && (
            <p className="dashboard-footnote">Mostrando 6 de {pendingMatches.length}. Entra a Resultados para verlos todos.</p>
          )}
        </div>

        <div className="panel admin-dashboard-card">
          <div className="panel-heading">
            <h3>Top 5 participantes</h3>
          </div>
          <div className="top-five-list">
            {topFive.map((participant) => (
              <article key={participant.id}>
                <span>{participant.position}</span>
                <strong>{participant.name}</strong>
                <em>{participant.totalPoints} pts</em>
              </article>
            ))}
          </div>
        </div>

        <div className="panel admin-dashboard-card">
          <div className="panel-heading">
            <h3>Recaudo</h3>
          </div>
          <div className="money-list">
            <p><span>Recaudo total</span><strong>{formatCop(collection.collectedTotal)}</strong></p>
            <p><span>Pagaron</span><strong>{collection.paidCount}/{participants.length}</strong></p>
            <p><span>Primer puesto</span><strong>{formatCop(prizes.firstPrize)}</strong></p>
            <p><span>Segundo puesto</span><strong>{formatCop(prizes.secondPrize)}</strong></p>
          </div>
        </div>

        <div className="panel admin-dashboard-card">
          <div className="panel-heading">
            <h3>Estado de pollas</h3>
          </div>
          <div className="poll-status-list">
            <article>
              <span>Completas</span>
              <strong>{tournamentStatus.filter((item) => item.complete).length}</strong>
            </article>
            <article>
              <span>Incompletas</span>
              <strong>{tournamentStatus.filter((item) => !item.complete).length}</strong>
            </article>
            <article>
              <span>Fecha límite</span>
              <strong>{settings.predictionDeadline || 'Sin definir'}</strong>
            </article>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Premios</h3>
          <span className="counter">{prizes.mode}</span>
        </div>
        <div className="prize-grid">
          <article>
            <span>Primer puesto</span>
            <strong>{prizes.firstPlace.map((item) => item.name).join(', ') || 'Sin datos'}</strong>
            <p>{formatCop(prizes.firstPrize)} por ganador</p>
          </article>
          <article>
            <span>Segundo puesto</span>
            <strong>{prizes.secondPlace.map((item) => item.name).join(', ') || 'No aplica'}</strong>
            <p>{formatCop(prizes.secondPrize)} por ganador</p>
          </article>
        </div>
      </div>
      </>
      )}

      {activeAdminTab === 'results' && (
      <>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Gestión de resultados oficiales</h3>
            <p className="muted">Ingresa resultados uno a uno o guarda varios partidos completos desde esta tabla.</p>
          </div>
          <button className="secondary-button" disabled={!isAdmin} onClick={saveAllCompleteResults} type="button">
            <Save size={18} />
            Guardar completos
          </button>
        </div>
        <div className="admin-result-toolbar">
          <label>
            Estado
            <select value={resultStatusFilter} onChange={(event) => setResultStatusFilter(event.target.value)}>
              <option value="pendiente">Pendientes</option>
              <option value="jugado">Finalizados</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <label>
            Fase
            <select value={resultStageFilter} onChange={(event) => setResultStageFilter(event.target.value)}>
              <option value="all">Todas las fases</option>
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </label>
          <span>{visibleResultMatches.length} partidos visibles</span>
        </div>
        <div className="table-wrap">
          <table className="official-results-table">
            <thead>
              <tr>
                <th>Partido</th>
                <th>Resultado oficial</th>
                <th>Clasificado</th>
                <th>Método</th>
                <th>Estado</th>
                <th>Guardar</th>
              </tr>
            </thead>
            <tbody>
              {visibleResultMatches.map((match) => {
                const draft = resultDrafts[match.id] ?? {};
                const knockout = isKnockoutStage(match.stage);
                const canSave = isAdmin && isValidResultDraft(match, completeKnockoutDraft(match, draft));
                const isDraw =
                  draft.realHomeScore !== '' &&
                  draft.realAwayScore !== '' &&
                  Number(draft.realHomeScore) === Number(draft.realAwayScore);

                return (
                  <tr key={match.id}>
                    <td>
                      <strong>{displayMatch(match)}</strong>
                      <span className="table-subtext">{match.date} · {match.time} · {match.stage}</span>
                    </td>
                    <td>
                      <div className="score-edit">
                        <input
                          aria-label={`Goles oficiales ${displayTeam(match.homeTeam)}`}
                          disabled={!isAdmin}
                          min="0"
                          onChange={(event) => updateResultDraft(match.id, 'realHomeScore', event.target.value)}
                          type="number"
                          value={draft.realHomeScore ?? ''}
                        />
                        <span>-</span>
                        <input
                          aria-label={`Goles oficiales ${displayTeam(match.awayTeam)}`}
                          disabled={!isAdmin}
                          min="0"
                          onChange={(event) => updateResultDraft(match.id, 'realAwayScore', event.target.value)}
                          type="number"
                          value={draft.realAwayScore ?? ''}
                        />
                      </div>
                    </td>
                    <td>
                      {knockout ? (
                        <select
                          disabled={!isAdmin}
                          onChange={(event) => updateResultDraft(match.id, 'qualifiedTeam', event.target.value)}
                          value={draft.qualifiedTeam ?? ''}
                        >
                          <option value="">Seleccionar</option>
                          <option value={match.homeTeam}>{displayTeam(match.homeTeam)}</option>
                          <option value={match.awayTeam}>{displayTeam(match.awayTeam)}</option>
                        </select>
                      ) : (
                        <span className="table-subtext">No aplica</span>
                      )}
                    </td>
                    <td>
                      {knockout ? (
                        <select
                          disabled={!isAdmin}
                          onChange={(event) => updateResultDraft(match.id, 'classificationMethod', event.target.value)}
                          value={draft.classificationMethod ?? ''}
                        >
                          <option value="">Seleccionar</option>
                          {classificationMethods.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="table-subtext">{methodLabels[draft.classificationMethod] || 'Tiempo reglamentario'}</span>
                      )}
                    </td>
                    <td>
                      <select
                        disabled={!isAdmin}
                        onChange={(event) => updateResultDraft(match.id, 'status', event.target.value)}
                        value={draft.status ?? match.status}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="jugado">Finalizado</option>
                      </select>
                    </td>
                    <td>
                      <button className="primary-button compact" disabled={!canSave} onClick={() => saveOfficialResult(match)} type="button">
                        <Save size={16} />
                        Guardar
                      </button>
                      {!canSave && isAdmin && (
                        <span className="table-subtext">
                          Completa marcador
                          {knockout ? (isDraw ? ', clasificado y penales/prórroga' : ', clasificado y método') : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visibleResultMatches.length && (
                <tr>
                  <td colSpan="6">No hay partidos con estos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Resultados finales reales</h3>
          <Save size={18} />
        </div>
        <div className="form-grid four-columns">
          {finalFields.map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                disabled={!isAdmin}
                onChange={(event) => updateFinalResults({ ...finalResults, [field]: event.target.value })}
                placeholder={label}
                value={displayTeam(finalResults[field] ?? '')}
              />
            </label>
          ))}
        </div>
      </div>
      </>
      )}

      {activeAdminTab === 'settings' && (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Configuración oficial</h3>
            <p className="muted">El administrador puede ajustar valores de inscripción, premios y puntos por fase.</p>
          </div>
        </div>
        <div className="form-grid three-columns">
          <label>
            Valor de inscripción
            <input
              disabled={!isAdmin}
              min="0"
              onChange={(event) => updateSetting('entryFee', event.target.value)}
              type="number"
              value={settings.entryFee}
            />
          </label>
          <label>
            % primer puesto
            <input
              disabled={!isAdmin}
              min="0"
              onChange={(event) => updateSetting('firstPrizePercent', event.target.value)}
              type="number"
              value={settings.firstPrizePercent}
            />
          </label>
          <label>
            % segundo puesto
            <input
              disabled={!isAdmin}
              min="0"
              onChange={(event) => updateSetting('secondPrizePercent', event.target.value)}
              type="number"
              value={settings.secondPrizePercent}
            />
          </label>
          <label>
            Fecha límite de pronósticos
            <input
              disabled={!isAdmin}
              onChange={(event) => updateSetting('predictionDeadline', event.target.value)}
              type="datetime-local"
              value={settings.predictionDeadline}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fase</th>
                <th>Ganador/empate</th>
                <th>Equipo clasificado</th>
                <th>Llave acertada</th>
                <th>Marcador exacto</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(settings.scoring).map(([stage, values]) => (
                <tr key={stage}>
                  <td><strong>{stage}</strong></td>
                  <td>
                    <input disabled={!isAdmin} min="0" onChange={(event) => updatePhasePoints(stage, 'result', event.target.value)} type="number" value={values.result} />
                  </td>
                  <td>
                    <input disabled={!isAdmin} min="0" onChange={(event) => updatePhasePoints(stage, 'qualifiedTeam', event.target.value)} type="number" value={values.qualifiedTeam} />
                  </td>
                  <td>
                    <input disabled={!isAdmin} min="0" onChange={(event) => updatePhasePoints(stage, 'bracket', event.target.value)} type="number" value={values.bracket} />
                  </td>
                  <td>
                    <input disabled={!isAdmin} min="0" onChange={(event) => updatePhasePoints(stage, 'exactScore', event.target.value)} type="number" value={values.exactScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-grid four-columns">
          {finalFields.map(([field, label]) => (
            <label key={field}>
              Puntos {label}
              <input
                disabled={!isAdmin}
                min="0"
                onChange={(event) => updateFinalPoints(field, event.target.value)}
                type="number"
                value={settings.finalResultsPoints[field]}
              />
            </label>
          ))}
        </div>
      </div>
      )}
    </section>
  );
}

export default AdminPanel;
