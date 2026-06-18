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
import PredictionPanel from './components/PredictionPanel';
import RankingTable from './components/RankingTable';
import RulesPanel from './components/RulesPanel';
import SearchPanel from './components/SearchPanel';
import TournamentPredictionPanel from './components/TournamentPredictionPanel';
import { loadState, resetState, saveState } from './services/storage';
import { downloadCsv } from './utils/exportCsv';
import { importMatches, parseMatchFile } from './utils/importMatches';
import { buildRanking, calculateCollection, calculatePrizes } from './utils/scoring';

const tabs = [
  { id: 'ranking', label: 'Tabla', icon: Trophy },
  { id: 'polla', label: 'Polla completa', icon: Trophy },
  { id: 'predicciones', label: 'Predicciones', icon: CalendarDays },
  { id: 'participantes', label: 'Participantes', icon: Users },
  { id: 'partidos', label: 'Partidos', icon: CalendarDays },
  { id: 'buscar', label: 'Buscar', icon: Search },
  { id: 'graficas', label: 'Gráficas', icon: BarChart3 },
  { id: 'reglas', label: 'Reglas', icon: FileText },
  { id: 'importar', label: 'Importar calendario', icon: Upload },
  { id: 'admin', label: 'Administración', icon: ShieldCheck }
];

const OFFICIAL_CALENDAR_FILE = '/mundial2026_matches_completo.csv';
const FIRST_ROUND_PREDICTIONS_FILE = '/first_round_predictions.json';
const MASTER_STATE_FILE = '/master_state.json';

const hasMasterState = (state) =>
  state.participants?.length >= 21 &&
  state.predictions?.filter((prediction) => prediction.id?.startsWith('master-')).length >= 2184 &&
  Object.values(state.tournamentEntries ?? {}).filter((entry) => Object.keys(entry.matchPredictions ?? {}).length >= 104).length >= 21;

const hasFirstRoundPredictions = (tournamentEntries = {}) => {
  const entries = Object.values(tournamentEntries);
  return entries.filter((entry) => Object.keys(entry.matchPredictions ?? {}).length >= 72).length >= 19;
};

const hasFlatGroupPredictions = (predictions = []) =>
  predictions.filter((prediction) => prediction.id?.startsWith('group-import-')).length >= 1300;

const hasMasterPredictions = (predictions = []) =>
  predictions.filter((prediction) => prediction.id?.startsWith('master-')).length >= 2184;

const buildFlatGroupPredictions = (tournamentEntries = {}, matches = []) => {
  const groupMatchesByNumber = new Map(
    matches
      .filter((match) => match.stage === 'Fase de grupos')
      .map((match) => [String(match.matchNumber), match])
  );

  return Object.entries(tournamentEntries).flatMap(([participantId, entry]) =>
    Object.entries(entry.matchPredictions ?? {}).flatMap(([matchNumber, prediction]) => {
      const match = groupMatchesByNumber.get(String(matchNumber));
      if (!match || prediction.homeScore === undefined || prediction.awayScore === undefined) return [];

      return [
        {
          id: `group-import-${participantId}-${match.id}`,
          participantId,
          matchId: match.id,
          homeScore: Number(prediction.homeScore),
          awayScore: Number(prediction.awayScore),
          qualifiedTeam: '',
          penaltyWinner: '',
          predictedHomeTeam: match.homeTeam,
          predictedAwayTeam: match.awayTeam,
          createdAt: new Date().toISOString()
        }
      ];
    })
  );
};

function App() {
  const [state, setState] = useState(loadState);
  const [activeTab, setActiveTab] = useState('ranking');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState(state.participants[0]?.id ?? '');

  const loadOfficialCalendar = async ({ force = false } = {}) => {
    const response = await fetch(OFFICIAL_CALENDAR_FILE);
    if (!response.ok) return;

    const rawMatches = parseMatchFile(await response.text(), 'mundial2026_matches_completo.csv');
    const result = importMatches(rawMatches, []);

    if (result.imported.length !== 104 || result.errors.length) return;

    setState((current) => {
      const hasCsvCalendar =
        current.matches.length === 104 &&
        current.matches.some((match) => Number(match.matchNumber) === 104) &&
        !current.matches.some((match) => match.homeTeam === 'Colombia' && match.awayTeam === 'Brasil');

      if (!force && hasCsvCalendar) return current;

      return {
        ...current,
        matches: result.imported,
        predictions: [],
        tournamentEntries: {}
      };
    });
  };

  const loadFirstRoundPredictions = async ({ force = false } = {}) => {
    const response = await fetch(FIRST_ROUND_PREDICTIONS_FILE);
    if (!response.ok) return;

    const firstRoundEntries = await response.json();

    setState((current) => {
      if (!force && hasFirstRoundPredictions(current.tournamentEntries)) return current;

      return {
        ...current,
        tournamentEntries: {
          ...(force ? {} : current.tournamentEntries),
          ...firstRoundEntries
        }
      };
    });
  };

  const loadMasterState = async ({ force = false } = {}) => {
    const response = await fetch(MASTER_STATE_FILE);
    if (!response.ok) return;

    const masterState = await response.json();

    setState((current) => {
      if (!force && hasMasterState(current)) return current;

      return {
        ...current,
        ...masterState,
        settings: {
          ...current.settings,
          ...(masterState.settings ?? {})
        }
      };
    });
    setCurrentParticipantId(masterState.participants?.[0]?.id ?? '');
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await loadOfficialCalendar();
      await loadMasterState();
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (hasMasterPredictions(state.predictions) || !hasFirstRoundPredictions(state.tournamentEntries) || hasFlatGroupPredictions(state.predictions)) return;

    const importedPredictions = buildFlatGroupPredictions(state.tournamentEntries, state.matches);
    if (!importedPredictions.length) return;

    setState((current) => {
      if (hasFlatGroupPredictions(current.predictions)) return current;

      const importedKeys = new Set(
        importedPredictions.map((prediction) => `${prediction.participantId}-${prediction.matchId}`)
      );
      const preservedPredictions = current.predictions.filter(
        (prediction) => !importedKeys.has(`${prediction.participantId}-${prediction.matchId}`)
      );

      return {
        ...current,
        predictions: [...preservedPredictions, ...importedPredictions]
      };
    });
  }, [state.matches, state.predictions, state.tournamentEntries]);

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

  const updateState = (partial) => setState((current) => ({ ...current, ...partial }));

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
    setState(resetState());
    setCurrentParticipantId(sampleCurrentParticipantId(state));
    loadOfficialCalendar({ force: true }).then(() => loadMasterState({ force: true }));
  };

  const ActiveIcon = tabs.find((tab) => tab.id === activeTab)?.icon ?? Trophy;

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
            <select
              aria-label="Participante actual"
              onChange={(event) => setCurrentParticipantId(event.target.value)}
              value={currentParticipantId}
            >
              {state.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
            <button className="secondary-button" onClick={exportAll} type="button">
              <Download size={18} />
              CSV
            </button>
          </div>
        </header>

        {activeTab === 'ranking' && <RankingTable collection={collection} prizes={prizes} ranking={ranking} />}
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
            updateFinalPredictions={(finalPredictions) => updateState({ finalPredictions })}
            updatePredictions={(predictions) => updateState({ predictions })}
          />
        )}
        {activeTab === 'participantes' && (
          <ParticipantPanel
            isAdmin={isAdmin}
            participants={state.participants}
            predictions={state.predictions}
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
            updateSettings={(settings) => updateState({ settings })}
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
            updateFinalResults={(finalResults) => updateState({ finalResults })}
            updateMasterState={(nextState) => {
              setState((current) => ({ ...current, ...nextState }));
              setCurrentParticipantId(nextState.participants[0]?.id ?? '');
            }}
            updateMatches={(matches) => updateState({ matches })}
            updateParticipants={(participants) => updateState({ participants })}
            updateSettings={(settings) => updateState({ settings })}
            updateTournamentEntries={(tournamentEntries) => updateState({ tournamentEntries })}
          />
        )}
      </main>
    </div>
  );
}

const sampleCurrentParticipantId = (state) => state.participants[0]?.id ?? '';

export default App;
