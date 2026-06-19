import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Lock,
  LogIn,
  Upload,
  Search,
  ShieldCheck,
  Trophy,
  Users
} from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import ChartsPanel from './components/ChartsPanel';
import ImportCalendarPanel from './components/ImportCalendarPanel';
import MatchPanel from './components/MatchPanel';
import ParticipantPanel from './components/ParticipantPanel';
import ParticipantSelector from './components/ParticipantSelector';
import PredictionPanel from './components/PredictionPanel';
import RankingTable from './components/RankingTable';
import RulesPanel from './components/RulesPanel';
import SearchPanel from './components/SearchPanel';
import TournamentPredictionPanel from './components/TournamentPredictionPanel';
import { defaultSettings } from './data/sampleData';
import {
  deleteParticipant as deleteParticipantFromSupabase,
  getSupabaseDataCounts,
  isSupabaseConfigured,
  loadSupabaseState,
  migrateInitialDataToSupabase,
  saveScoreDetails,
  saveStateSection
} from './services/supabaseService';
import { downloadCsv } from './utils/exportCsv';
import { buildRanking, calculateCollection, calculatePrizes } from './utils/scoring';

const tabs = [
  { id: 'ranking', label: 'Tabla', icon: Trophy },
  { id: 'polla', label: 'Polla completa', icon: Trophy },
  { id: 'predicciones', label: 'Predicciones', icon: CalendarDays },
  { id: 'participantes', label: 'Participantes', icon: Users },
  { id: 'partidos', label: 'Resultados reales', icon: CalendarDays },
  { id: 'buscar', label: 'Buscar', icon: Search },
  { id: 'graficas', label: 'Gráficas', icon: BarChart3 },
  { id: 'reglas', label: 'Reglas', icon: FileText },
  { id: 'importar', label: 'Importar calendario', icon: Upload },
  { id: 'admin', label: 'Administración', icon: ShieldCheck }
];

const emptyState = {
  participants: [],
  matches: [],
  predictions: [],
  tournamentEntries: {},
  finalPredictions: {},
  finalResults: { champion: '', second: '', third: '', fourth: '' },
  importAudits: [],
  payments: [],
  scoreDetails: [],
  settings: defaultSettings
};

const paymentsFromParticipants = (participants, entryFee) =>
  participants.map((participant) => ({
    id: participant.id,
    participantId: participant.id,
    paid: Boolean(participant.paid),
    paymentMethod: participant.paymentMethod ?? '',
    amount: participant.paid ? Number(entryFee) : 0,
    paidAt: ''
  }));

const enrichPredictionsForSupabase = (predictions, matches) =>
  predictions.map((prediction) => {
    const match = matches.find((item) => item.id === prediction.matchId);
    return {
      ...prediction,
      phase: prediction.phase ?? match?.stage ?? '',
      groupName: prediction.groupName ?? match?.group ?? '',
      predictedHomeTeam: prediction.predictedHomeTeam ?? match?.homeTeam ?? '',
      predictedAwayTeam: prediction.predictedAwayTeam ?? match?.awayTeam ?? ''
    };
  });

const formatError = (error, fallback) => {
  if (!error) return fallback;
  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
  return parts.length ? parts.join(' | ') : String(error);
};

function App() {
  const [state, setState] = useState(emptyState);
  const [activeTab, setActiveTab] = useState('ranking');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [saveError, setSaveError] = useState('');

  const loadData = async ({ preferredParticipantId = currentParticipantId, showLoading = false } = {}) => {
    if (showLoading) setIsLoadingData(true);

    if (!isSupabaseConfigured) {
      setConnectionError('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para conectar Supabase.');
      setIsLoadingData(false);
      return null;
    }

    try {
      const supabaseState = await loadSupabaseState();
      const nextState = {
        ...emptyState,
        ...supabaseState,
        finalPredictions: {
          ...(supabaseState.settings.finalPredictions ?? {}),
          ...(supabaseState.finalPredictions ?? {})
        },
        finalResults: supabaseState.settings.finalResults ?? supabaseState.finalResults ?? emptyState.finalResults
      };
      setState(nextState);
      setCurrentParticipantId(
        nextState.participants.some((participant) => participant.id === preferredParticipantId)
          ? preferredParticipantId
          : nextState.participants[0]?.id ?? ''
      );
      setConnectionError('');
      return nextState;
    } catch (error) {
      setConnectionError(formatError(error, 'No se pudo cargar la información desde Supabase.'));
      return null;
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData({ preferredParticipantId: '', showLoading: true });
  }, []);

  const ranking = useMemo(
    () =>
      buildRanking(
        state.participants,
        state.matches,
        state.predictions,
        state.finalPredictions,
        state.finalResults,
        state.settings
      ),
    [state.participants, state.matches, state.predictions, state.finalPredictions, state.finalResults, state.settings]
  );

  const collection = useMemo(
    () => calculateCollection(state.participants, state.settings.entryFee),
    [state.participants, state.settings.entryFee]
  );

  const prizes = useMemo(
    () => calculatePrizes(ranking, collection.collectedTotal, state.settings),
    [ranking, collection.collectedTotal, state.settings]
  );

  useEffect(() => {
    if (isLoadingData || connectionError) return;

    const scoreDetails = ranking.flatMap((participant) =>
      (participant.pointsDetail ?? []).map((detail) => ({
        participantId: participant.id,
        phase: detail.fase,
        totalPoints: detail.puntos_total_fase,
        detail
      }))
    );

    if (!scoreDetails.length) return;

    saveScoreDetails(scoreDetails).catch((error) => {
      setSaveError(formatError(error, 'No se pudo guardar el detalle de puntos.'));
    });
  }, [ranking, isLoadingData, connectionError]);

  const persistSection = async (section, value) => {
    try {
      setSaveError('');
      const savedValue = await saveStateSection(section, value);

      if (section === 'participants' && Array.isArray(savedValue)) {
        setState((current) => ({ ...current, participants: savedValue }));
        setCurrentParticipantId((currentId) =>
          savedValue.some((participant) => participant.id === currentId) ? currentId : savedValue[0]?.id ?? ''
        );
        await saveStateSection('payments', paymentsFromParticipants(savedValue, state.settings.entryFee));
      }

      if (section === 'matches' && Array.isArray(savedValue)) {
        setState((current) => ({ ...current, matches: savedValue }));
      }

      if (section === 'predictions' && Array.isArray(savedValue)) {
        setState((current) => ({ ...current, predictions: savedValue }));
      }
    } catch (error) {
      setSaveError(formatError(error, `No se pudo guardar ${section} en Supabase.`));
    }
  };

  const updateState = (partial, persistKeys = Object.keys(partial)) => {
    setState((current) => ({ ...current, ...partial }));
    persistKeys.forEach((key) => {
      if (key === 'participants') {
        persistSection('participants', partial.participants);
        return;
      }

      if (key === 'predictions') {
        persistSection('predictions', enrichPredictionsForSupabase(partial.predictions, state.matches));
        return;
      }

      persistSection(key, partial[key]);
    });
  };

  const updateFinalPredictions = (finalPredictions) => {
    const nextSettings = { ...state.settings, finalPredictions };
    const nextTournamentEntries = {
      ...state.tournamentEntries,
      ...Object.fromEntries(
        Object.entries(finalPredictions).map(([participantId, prediction]) => [
          participantId,
          {
            ...(state.tournamentEntries?.[participantId] ?? {}),
            finalResults: {
              champion: prediction.champion ?? '',
              second: prediction.second ?? '',
              third: prediction.third ?? '',
              fourth: prediction.fourth ?? ''
            }
          }
        ])
      )
    };
    setState((current) => ({
      ...current,
      finalPredictions,
      tournamentEntries: nextTournamentEntries,
      settings: nextSettings
    }));
    persistSection('settings', nextSettings);
    persistSection('tournamentEntries', nextTournamentEntries);
  };

  const updateFinalResults = (finalResults) => {
    const nextSettings = { ...state.settings, finalResults };
    setState((current) => ({ ...current, finalResults, settings: nextSettings }));
    persistSection('settings', nextSettings);
  };

  const updateSettingsState = (settings) => {
    const nextSettings = {
      ...settings,
      finalPredictions: state.finalPredictions,
      finalResults: state.finalResults
    };
    setState((current) => ({ ...current, settings: nextSettings }));
    persistSection('settings', nextSettings);
    persistSection('payments', paymentsFromParticipants(state.participants, nextSettings.entryFee));
  };

  const reloadFromSupabase = async () => {
    await loadData({ preferredParticipantId: currentParticipantId, showLoading: true });
  };

  const deleteParticipant = async (participantId) => {
    try {
      setSaveError('');
      await deleteParticipantFromSupabase(participantId);
      await loadData({
        preferredParticipantId: currentParticipantId === participantId ? '' : currentParticipantId,
        showLoading: true
      });
    } catch (error) {
      setSaveError(formatError(error, 'No se pudo eliminar el participante en Supabase.'));
    }
  };

  const migrateInitialData = async (onProgress = () => {}) => {
    setSaveError('');
    onProgress('Revisando datos existentes en Supabase...');
    const counts = await getSupabaseDataCounts();
    if (
      (counts.participants > 0 || counts.matches > 0) &&
      !window.confirm('Ya existen datos en Supabase. ¿Deseas actualizar los datos existentes sin duplicarlos?')
    ) {
      return null;
    }

    onProgress('Leyendo archivo maestro local...');
    const response = await fetch('/master_state.json');
    if (!response.ok) throw new Error('No se pudo leer master_state.json para la migración inicial.');

    const sourceState = await response.json();
    onProgress('Enviando datos a Supabase...');
    const summary = await migrateInitialDataToSupabase(sourceState, onProgress);
    onProgress('Recargando información desde Supabase...');
    await loadData({ preferredParticipantId: currentParticipantId, showLoading: true });
    return summary;
  };

  const exportAll = () => {
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

  const handleAdminLogin = (event) => {
    event.preventDefault();
    const normalizedPassword = adminPassword.trim();

    if (normalizedPassword === 'Dura20738') {
      setIsAdmin(true);
      setAdminPassword('');
      setAdminError('');
      return;
    }

    setIsAdmin(false);
    setAdminError('Clave incorrecta.');
  };

  const handleReset = () => {
    reloadFromSupabase();
  };

  const ActiveIcon = tabs.find((tab) => tab.id === activeTab)?.icon ?? Trophy;
  const showParticipantSelector = ['predicciones', 'polla'].includes(activeTab);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/logo-polla.png" alt="Logo La Polla Mundialista" />
          <div>
            <h1>Polla Mundialista</h1>
            <p>Predicciones, puntos y tabla</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Secciones">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={activeTab === tab.id ? 'nav-item active' : 'nav-item'}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                title={tab.label}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <form className="admin-login" onSubmit={handleAdminLogin}>
          <div className="mode-badge">
            {isAdmin ? <ShieldCheck size={16} /> : <Lock size={16} />}
            <span>{isAdmin ? 'Modo administrador' : 'Modo participante'}</span>
          </div>
          {!isAdmin && (
            <div className="inline-form">
              <input
                aria-label="Clave de administrador"
                onChange={(event) => {
                  setAdminPassword(event.target.value);
                  setAdminError('');
                }}
                placeholder="Clave admin"
                type="password"
                value={adminPassword}
              />
              <button className="primary-button admin-login-button" type="submit">
                <LogIn size={18} />
                Entrar
              </button>
            </div>
          )}
          {adminError && !isAdmin && <p className="form-error">{adminError}</p>}
          {isAdmin && (
            <button className="ghost-button" onClick={() => setIsAdmin(false)} type="button">
              Salir de admin
            </button>
          )}
          <p className="creator-credit">Creado por Joham Bohorquez Rueda</p>
        </form>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Panel</span>
            <h2>
              <ActiveIcon size={24} />
              {tabs.find((tab) => tab.id === activeTab)?.label}
            </h2>
          </div>
          <div className="topbar-actions">
            {showParticipantSelector && (
              <ParticipantSelector
                onChange={setCurrentParticipantId}
                participants={state.participants}
                value={currentParticipantId}
              />
            )}
            <button className="secondary-button" onClick={exportAll} type="button">
              <Download size={18} />
              CSV
            </button>
          </div>
        </header>

        {isLoadingData && <div className="notice">Cargando datos desde Supabase...</div>}
        {connectionError && <div className="notice error-notice">{connectionError}</div>}
        {saveError && <div className="notice error-notice">{saveError}</div>}

        {!isLoadingData && activeTab === 'ranking' && (
          <RankingTable
            collection={collection}
            onViewCharts={() => setActiveTab('graficas')}
            prizes={prizes}
            ranking={ranking}
          />
        )}
        {activeTab === 'polla' && (
          <TournamentPredictionPanel
            currentParticipantId={currentParticipantId}
            isAdmin={isAdmin}
            matches={state.matches}
            participants={state.participants}
            settings={state.settings}
            tournamentEntries={state.tournamentEntries ?? {}}
            updateTournamentEntries={(tournamentEntries) => updateState({ tournamentEntries })}
          />
        )}
        {activeTab === 'predicciones' && (
          <PredictionPanel
            currentParticipantId={currentParticipantId}
            finalPredictions={state.finalPredictions}
            isAdmin={isAdmin}
            matches={state.matches}
            participants={state.participants}
            predictions={state.predictions}
            settings={state.settings}
            updateFinalPredictions={updateFinalPredictions}
            updatePredictions={(predictions) => updateState({ predictions })}
          />
        )}
        {activeTab === 'participantes' && (
          <ParticipantPanel
            isAdmin={isAdmin}
            participants={state.participants}
            predictions={state.predictions}
            deleteParticipant={deleteParticipant}
            updateParticipants={(participants) => updateState({ participants })}
            updatePredictions={(predictions) => updateState({ predictions })}
          />
        )}
        {activeTab === 'partidos' && (
          <MatchPanel
            isAdmin={isAdmin}
            matches={state.matches}
            predictions={state.predictions}
            updateMatches={(matches) => updateState({ matches })}
            updatePredictions={(predictions) => updateState({ predictions })}
          />
        )}
        {activeTab === 'buscar' && (
          <SearchPanel
            matches={state.matches}
            participants={state.participants}
            predictions={state.predictions}
          />
        )}
        {activeTab === 'graficas' && (
          <ChartsPanel matches={state.matches} participants={state.participants} predictions={state.predictions} ranking={ranking} />
        )}
        {activeTab === 'reglas' && (
          <RulesPanel
            isAdmin={isAdmin}
            settings={state.settings}
            updateSettings={updateSettingsState}
          />
        )}
        {activeTab === 'importar' && (
          <ImportCalendarPanel
            isAdmin={isAdmin}
            matches={state.matches}
            updateMatches={(matches) => updateState({ matches })}
            updatePredictions={(predictions) => updateState({ predictions })}
          />
        )}
        {activeTab === 'admin' && (
          <AdminPanel
            adminError={adminError}
            adminPassword={adminPassword}
            collection={collection}
            finalResults={state.finalResults}
            handleAdminLogin={handleAdminLogin}
            isAdmin={isAdmin}
            migrateInitialData={migrateInitialData}
            matches={state.matches}
            participants={state.participants}
            predictions={state.predictions}
            tournamentEntries={state.tournamentEntries ?? {}}
            prizes={prizes}
            ranking={ranking}
            resetData={handleReset}
            setAdminError={setAdminError}
            setAdminPassword={setAdminPassword}
            settings={state.settings}
            updateFinalResults={updateFinalResults}
            updateMasterState={(nextState) => {
              setState((current) => ({ ...current, ...nextState }));
              setCurrentParticipantId(nextState.participants[0]?.id ?? '');
              persistSection('participants', nextState.participants ?? []);
              persistSection('payments', paymentsFromParticipants(nextState.participants ?? [], nextState.settings?.entryFee ?? state.settings.entryFee));
              persistSection('matches', nextState.matches ?? []);
              persistSection('predictions', enrichPredictionsForSupabase(nextState.predictions ?? [], nextState.matches ?? []));
              persistSection('tournamentEntries', nextState.tournamentEntries ?? {});
              persistSection('settings', nextState.settings ?? state.settings);
            }}
            updateMatches={(matches) => updateState({ matches })}
            updateParticipants={(participants) => updateState({ participants })}
            updateSettings={updateSettingsState}
            updateTournamentEntries={(tournamentEntries) => updateState({ tournamentEntries })}
          />
        )}
      </main>
    </div>
  );
}

export default App;
