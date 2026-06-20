import { useMemo, useState } from 'react';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { displayTeam, getTeamFlag } from '../utils/localization';

const emptyMatch = {
  matchNumber: '',
  date: '',
  time: '',
  group: '',
  stage: 'Fase de grupos',
  homeTeam: '',
  awayTeam: '',
  stadium: '',
  city: '',
  realHomeScore: '',
  realAwayScore: '',
  qualifiedTeam: '',
  classificationMethod: '',
  status: 'pendiente'
};

const stageOptions = ['Fase de grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final', 'Tercer puesto'];
const knockoutStageOptions = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercer puesto', 'Final'];
const classificationMethods = [
  ['regulation', 'Tiempo reglamentario'],
  ['extraTime', 'Prórroga'],
  ['penalties', 'Penales']
];
const classificationMethodLabels = Object.fromEntries(classificationMethods);

const normalizeSearch = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isSameTeam = (a, b) => normalizeSearch(displayTeam(a) || a) === normalizeSearch(displayTeam(b) || b);
const normalizeGroupKey = (group) => {
  const value = String(group ?? '').trim();
  const match = value.match(/([A-L])$/i);
  return match ? match[1].toUpperCase() : value;
};

const hasScoreValue = (value) => value !== '' && value !== null && value !== undefined;
const hasOfficialScore = (match) => hasScoreValue(match.realHomeScore) && hasScoreValue(match.realAwayScore);
const isOfficialComplete = (match) => match.status === 'jugado' && hasOfficialScore(match);

const emptyStanding = (team, group) => ({
  team,
  group,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0
});

const compareStandings = (a, b) =>
  b.points - a.points ||
  b.goalDifference - a.goalDifference ||
  b.goalsFor - a.goalsFor ||
  displayTeam(a.team).localeCompare(displayTeam(b.team), 'es');

const addGroupResult = (home, away, homeGoals, awayGoals) => {
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (homeGoals > awayGoals) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
  } else if (homeGoals < awayGoals) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
};

const buildOfficialGroupTables = (matches) => {
  const groups = new Map();

  matches
    .filter((match) => match.stage === 'Fase de grupos')
    .forEach((match) => {
      const group = normalizeGroupKey(match.group) || 'Sin grupo';
      if (!groups.has(group)) {
        groups.set(group, { completed: 0, rows: new Map(), total: 0 });
      }

      const groupData = groups.get(group);
      groupData.total += 1;
      [match.homeTeam, match.awayTeam].forEach((team) => {
        if (team && !groupData.rows.has(team)) {
          groupData.rows.set(team, emptyStanding(team, group));
        }
      });

      if (!isOfficialComplete(match)) return;

      const home = groupData.rows.get(match.homeTeam);
      const away = groupData.rows.get(match.awayTeam);
      if (!home || !away) return;

      addGroupResult(home, away, Number(match.realHomeScore), Number(match.realAwayScore));
      groupData.completed += 1;
    });

  return Object.fromEntries(
    [...groups.entries()].map(([group, groupData]) => [
      group,
      {
        complete: groupData.total > 0 && groupData.completed === groupData.total,
        standings: [...groupData.rows.values()].sort(compareStandings)
      }
    ])
  );
};

const buildOfficialQualifiers = (groupTables) => {
  const qualifiers = {};
  const thirdPlaces = [];
  const groups = Object.entries(groupTables);

  groups.forEach(([group, table]) => {
    if (!table.complete || table.standings.length < 3) return;

    qualifiers[`Winner Group ${group}`] = table.standings[0].team;
    qualifiers[`Runner-up Group ${group}`] = table.standings[1].team;
    thirdPlaces.push(table.standings[2]);
  });

  const allGroupsComplete = groups.length >= 12 && groups.every(([, table]) => table.complete);
  const bestThirds = allGroupsComplete ? [...thirdPlaces].sort(compareStandings).slice(0, 8) : [];

  return { bestThirds, qualifiers };
};

const resolveBestThird = (placeholder, context) => {
  const bestThird = String(placeholder ?? '').match(/^Best 3rd Group ([A-L/]+)$/i);
  if (!bestThird) return '';

  const candidateGroups = bestThird[1].split('/').map((group) => group.toUpperCase());
  const selected = context.bestThirds.find(
    (standing) => candidateGroups.includes(String(standing.group).toUpperCase()) && !context.usedBestThirdGroups.has(standing.group)
  );

  if (!selected) return '';
  context.usedBestThirdGroups.add(selected.group);
  return selected.team;
};

const resolveOfficialPlaceholder = (value, context) => {
  const team = String(value ?? '').trim();
  const winnerMatch = team.match(/^Winner Match (\d+)$/i);
  if (winnerMatch) return context.winners[winnerMatch[1]] ?? '';

  const loserMatch = team.match(/^Loser Match (\d+)$/i);
  if (loserMatch) return context.losers[loserMatch[1]] ?? '';

  const bestThird = resolveBestThird(team, context);
  if (bestThird) return bestThird;

  return context.qualifiers[team] ?? '';
};

const getOfficialWinner = (match, homeTeam, awayTeam) => {
  if (match.qualifiedTeam) return match.qualifiedTeam;
  if (!isOfficialComplete(match)) return '';

  const homeScore = Number(match.realHomeScore);
  const awayScore = Number(match.realAwayScore);
  if (homeScore > awayScore) return homeTeam;
  if (homeScore < awayScore) return awayTeam;
  return '';
};

const getOfficialLoser = (winner, homeTeam, awayTeam) => {
  if (!winner) return '';
  if (isSameTeam(winner, homeTeam)) return awayTeam;
  if (isSameTeam(winner, awayTeam)) return homeTeam;
  return '';
};

const buildOfficialBracketRounds = (matches) => {
  const groupTables = buildOfficialGroupTables(matches);
  const context = {
    ...buildOfficialQualifiers(groupTables),
    losers: {},
    usedBestThirdGroups: new Set(),
    winners: {}
  };
  const rounds = {};

  [...matches]
    .filter((match) => match.stage !== 'Fase de grupos')
    .sort((a, b) => Number(a.matchNumber ?? 999) - Number(b.matchNumber ?? 999))
    .forEach((match) => {
      const homeTeam = resolveOfficialPlaceholder(match.homeTeam, context) || match.homeTeam;
      const awayTeam = resolveOfficialPlaceholder(match.awayTeam, context) || match.awayTeam;
      const winner = getOfficialWinner(match, homeTeam, awayTeam);
      const loser = getOfficialLoser(winner, homeTeam, awayTeam);
      const matchKey = String(match.matchNumber ?? match.id);

      context.winners[matchKey] = winner;
      context.losers[matchKey] = loser;
      rounds[match.stage] = [
        ...(rounds[match.stage] ?? []),
        { ...match, awayTeam, homeTeam, loser, winner }
      ];
    });

  return rounds;
};

function MatchPanel({ isAdmin, matches, predictions, updateMatches, updatePredictions }) {
  const [activeView, setActiveView] = useState('list');
  const [form, setForm] = useState(emptyMatch);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ date: '', group: 'all', stage: 'Fase de grupos' });
  const [bracketFilters, setBracketFilters] = useState({ query: '', stage: 'all' });
  const [scoreDrafts, setScoreDrafts] = useState({});

  const filteredMatches = useMemo(
    () =>
      matches
        .filter((match) => !filters.date || match.date === filters.date)
        .filter((match) => filters.group === 'all' || match.group === filters.group)
        .filter((match) => filters.stage === 'all' || match.stage === filters.stage)
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [matches, filters]
  );

  const groupOptions = useMemo(
    () =>
      [...new Set(matches.filter((match) => match.stage === 'Fase de grupos').map((match) => match.group).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es')),
    [matches]
  );

  const matchesByGroup = useMemo(
    () =>
      groupOptions.map((group) => ({
        group,
        matches: filteredMatches.filter((match) => match.group === group)
      })).filter((item) => item.matches.length),
    [filteredMatches, groupOptions]
  );

  const knockoutSections = useMemo(
    () =>
      stageOptions
        .filter((stage) => stage !== 'Fase de grupos')
        .map((stage) => ({
          stage,
          matches: filteredMatches.filter((match) => match.stage === stage)
        }))
        .filter((item) => item.matches.length),
    [filteredMatches]
  );

  const officialBracketRounds = useMemo(() => buildOfficialBracketRounds(matches), [matches]);
  const visibleBracketRounds = useMemo(
    () =>
      knockoutStageOptions
        .map((stage) => ({
          stage,
          matches: (officialBracketRounds[stage] ?? []).filter((match) => {
            const query = normalizeSearch(bracketFilters.query);
            if (bracketFilters.stage !== 'all' && match.stage !== bracketFilters.stage) return false;
            if (!query) return true;

            const searchableText = [
              `#${match.matchNumber}`,
              match.matchNumber,
              match.stage,
              match.homeTeam,
              match.awayTeam,
              match.winner,
              match.loser
            ]
              .map((value) => normalizeSearch(displayTeam(value) || value))
              .join(' ');
            return searchableText.includes(query);
          })
        }))
        .filter((section) => section.matches.length),
    [bracketFilters, officialBracketRounds]
  );

  const submitMatch = (event) => {
    event.preventDefault();
    if (!form.date || !form.time || !form.homeTeam.trim() || !form.awayTeam.trim()) return;

    const normalized = {
      ...form,
      matchNumber: form.matchNumber === '' ? '' : Number(form.matchNumber),
      homeTeam: form.homeTeam.trim(),
      awayTeam: form.awayTeam.trim(),
      stadium: form.stadium.trim(),
      city: form.city.trim(),
      realHomeScore: form.realHomeScore === '' ? '' : Number(form.realHomeScore),
      realAwayScore: form.realAwayScore === '' ? '' : Number(form.realAwayScore)
    };

    if (editingId) {
      updateMatches(matches.map((match) => (match.id === editingId ? { ...match, ...normalized } : match)));
    } else {
      updateMatches([...matches, normalized]);
    }

    setForm(emptyMatch);
    setEditingId(null);
    setActiveView('list');
  };

  const editMatch = (match) => {
    setEditingId(match.id);
    setForm(match);
    setActiveView('form');
  };

  const removeMatch = (matchId) => {
    updateMatches(matches.filter((match) => match.id !== matchId));
    updatePredictions(predictions.filter((prediction) => prediction.matchId !== matchId));
  };

  const getScoreDraft = (match) => ({
    realHomeScore: scoreDrafts[match.id]?.realHomeScore ?? match.realHomeScore ?? '',
    realAwayScore: scoreDrafts[match.id]?.realAwayScore ?? match.realAwayScore ?? '',
    status: scoreDrafts[match.id]?.status ?? match.status ?? 'pendiente'
  });

  const updateScoreDraft = (matchId, field, value) => {
    setScoreDrafts((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] ?? {}),
        [field]: value
      }
    }));
  };

  const saveQuickScore = (match) => {
    const draft = getScoreDraft(match);
    if (draft.realHomeScore === '' || draft.realAwayScore === '') return;

    updateMatches(
      matches.map((item) =>
        item.id === match.id
          ? {
              ...item,
              realHomeScore: Number(draft.realHomeScore),
              realAwayScore: Number(draft.realAwayScore),
              status: draft.status
            }
          : item
      )
    );

    setScoreDrafts((current) => {
      const next = { ...current };
      delete next[match.id];
      return next;
    });
  };

  const clearQuickScore = (match) => {
    updateMatches(
      matches.map((item) =>
        item.id === match.id
          ? {
              ...item,
              realHomeScore: '',
              realAwayScore: '',
              qualifiedTeam: '',
              classificationMethod: '',
              status: 'pendiente'
            }
          : item
      )
    );

    setScoreDrafts((current) => ({
      ...current,
      [match.id]: {
        realHomeScore: '',
        realAwayScore: '',
        status: 'pendiente'
      }
    }));
  };

  const renderMatchCard = (match) => (
    <article className="match-card result-match-card" key={match.id ?? `${match.matchNumber}-${match.date}-${match.homeTeam}-${match.awayTeam}`}>
      <div className="match-meta">
        <span>{match.matchNumber ? `#${match.matchNumber} · ` : ''}{match.date} · {match.time}</span>
        <span>{match.group || match.stage}</span>
      </div>
      <div className="result-scoreboard">
        <strong>{displayTeam(match.homeTeam)}</strong>
        <span>{match.realHomeScore === '' ? '-' : match.realHomeScore} : {match.realAwayScore === '' ? '-' : match.realAwayScore}</span>
        <strong>{displayTeam(match.awayTeam)}</strong>
      </div>
      <div className="result-info-strip">
        <span>📅 {match.date || 'Sin fecha'}</span>
        <span>🏟️ {match.stadium || match.city || 'Sede por definir'}</span>
        <span>🏁 {match.qualifiedTeam ? `Clasifica ${displayTeam(match.qualifiedTeam)}` : 'Sin clasificado'}</span>
      </div>
      <div className="quick-score-form">
        <label>
          Goles {displayTeam(match.homeTeam)}
          <input
            disabled={!isAdmin}
            min="0"
            onChange={(event) => updateScoreDraft(match.id, 'realHomeScore', event.target.value)}
            type="number"
            value={getScoreDraft(match).realHomeScore}
          />
        </label>
        <label>
          Goles {displayTeam(match.awayTeam)}
          <input
            disabled={!isAdmin}
            min="0"
            onChange={(event) => updateScoreDraft(match.id, 'realAwayScore', event.target.value)}
            type="number"
            value={getScoreDraft(match).realAwayScore}
          />
        </label>
        <label>
          Estado
          <select
            disabled={!isAdmin}
            onChange={(event) => updateScoreDraft(match.id, 'status', event.target.value)}
            value={getScoreDraft(match).status}
          >
            <option value="pendiente">Pendiente</option>
            <option value="jugado">Jugado</option>
          </select>
        </label>
        <button
          className="primary-button compact"
          disabled={!isAdmin || getScoreDraft(match).realHomeScore === '' || getScoreDraft(match).realAwayScore === ''}
          onClick={() => saveQuickScore(match)}
          type="button"
        >
          <Save size={16} />
          Guardar marcador
        </button>
        <button
          className="secondary-button compact"
          disabled={!isAdmin}
          onClick={() => clearQuickScore(match)}
          type="button"
        >
          Limpiar
        </button>
      </div>
      <div className="card-footer">
        <span className={`status ${match.status}`}>{match.status}</span>
        <span>{match.stadium ? `${match.stadium}, ${match.city}` : match.stage}</span>
        <div className="row-actions">
          <button className="icon-button" disabled={!isAdmin} onClick={() => editMatch(match)} type="button" title="Editar partido">
            <Edit2 size={18} />
          </button>
          <button className="icon-button danger" disabled={!isAdmin} onClick={() => removeMatch(match.id)} type="button" title="Eliminar partido">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </article>
  );

  const renderBracketMatch = (match) => {
    const homeIsWinner = isSameTeam(match.winner, match.homeTeam);
    const awayIsWinner = isSameTeam(match.winner, match.awayTeam);
    const officialScore = hasOfficialScore(match)
      ? `${match.realHomeScore} - ${match.realAwayScore}`
      : 'Por definir';

    return (
      <article className={`bracket-match real-bracket-match ${match.winner ? 'decided' : ''}`} key={match.id ?? `${match.stage}-${match.matchNumber}`}>
        <span>#{match.matchNumber || '-'} · {match.date || 'Fecha por definir'} · {match.time || 'TBD'}</span>
        <div className="bracket-team-row-grid">
          <div className={homeIsWinner ? 'bracket-team-row winner' : 'bracket-team-row'}>
            <span>{getTeamFlag(match.homeTeam)}</span>
            <strong>{displayTeam(match.homeTeam)}</strong>
            <em>{hasScoreValue(match.realHomeScore) ? match.realHomeScore : '-'}</em>
          </div>
          <div className={awayIsWinner ? 'bracket-team-row winner' : 'bracket-team-row'}>
            <span>{getTeamFlag(match.awayTeam)}</span>
            <strong>{displayTeam(match.awayTeam)}</strong>
            <em>{hasScoreValue(match.realAwayScore) ? match.realAwayScore : '-'}</em>
          </div>
        </div>
        <div className="bracket-status-note">
          <span className="bracket-score-chip">{officialScore}</span>
          <strong>{match.winner ? `Clasifica ${displayTeam(match.winner)}` : 'Clasificado por definir'}</strong>
        </div>
        <small>{match.classificationMethod ? classificationMethodLabels[match.classificationMethod] : 'Método por definir'}</small>
      </article>
    );
  };

  return (
    <section className="stack-list">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Partidos</h3>
            <p className="muted">Consulta el calendario por fase o crea/edita partidos cuando sea necesario.</p>
          </div>
          <span className="counter">{matches.length}</span>
        </div>
        <div className="tab-strip">
          <button
            className={activeView === 'list' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveView('list')}
            type="button"
          >
            Ver partidos
          </button>
          <button
            className={activeView === 'bracket' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveView('bracket')}
            type="button"
          >
            Llaves
          </button>
          <button
            className={activeView === 'form' ? 'tab-button active' : 'tab-button'}
            disabled={!isAdmin && !editingId}
            onClick={() => {
              setActiveView('form');
              if (!editingId) setForm(emptyMatch);
            }}
            type="button"
          >
            {editingId ? 'Editar partido' : 'Crear partido'}
          </button>
        </div>
      </div>

      {activeView === 'form' && (
      <form className="panel match-form-panel" onSubmit={submitMatch}>
        <div className="panel-heading">
          <h3>{editingId ? 'Editar partido' : 'Crear partido'}</h3>
          {editingId && (
            <button
              className="icon-button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyMatch);
                setActiveView('list');
              }}
              type="button"
              title="Cancelar"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="form-grid">
          <label>
            Fecha
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, date: event.target.value })} required type="date" value={form.date} />
          </label>
          <label>
            Hora
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, time: event.target.value })} required type="time" value={form.time} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Numero de partido
            <input disabled={!isAdmin} min="1" onChange={(event) => setForm({ ...form, matchNumber: event.target.value })} type="number" value={form.matchNumber ?? ''} />
          </label>
          <label>
            Grupo
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, group: event.target.value })} placeholder="Grupo A" value={form.group} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Estadio
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, stadium: event.target.value })} placeholder="Estadio Azteca" value={form.stadium ?? ''} />
          </label>
          <label>
            Ciudad
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Ciudad de México" value={form.city ?? ''} />
          </label>
        </div>
        <label>
          Fase
          <select disabled={!isAdmin} onChange={(event) => setForm({ ...form, stage: event.target.value })} value={form.stage}>
            {stageOptions.map((stage) => <option key={stage}>{stage}</option>)}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Equipo local
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, homeTeam: event.target.value })} required value={displayTeam(form.homeTeam)} />
          </label>
          <label>
            Equipo visitante
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, awayTeam: event.target.value })} required value={displayTeam(form.awayTeam)} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Marcador local
            <input disabled={!isAdmin} min="0" onChange={(event) => setForm({ ...form, realHomeScore: event.target.value })} type="number" value={form.realHomeScore} />
          </label>
          <label>
            Marcador visitante
            <input disabled={!isAdmin} min="0" onChange={(event) => setForm({ ...form, realAwayScore: event.target.value })} type="number" value={form.realAwayScore} />
          </label>
        </div>
        <label>
          Equipo clasificado
          <input
            disabled={!isAdmin}
            onChange={(event) => setForm({ ...form, qualifiedTeam: event.target.value })}
            placeholder="Solo aplica para eliminatorias"
            value={displayTeam(form.qualifiedTeam)}
          />
        </label>
        <label>
          Método de clasificación
          <select
            disabled={!isAdmin}
            onChange={(event) => setForm({ ...form, classificationMethod: event.target.value })}
            value={form.classificationMethod ?? ''}
          >
            <option value="">No aplica / sin definir</option>
            {classificationMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Estado
          <select disabled={!isAdmin} onChange={(event) => setForm({ ...form, status: event.target.value })} value={form.status}>
            <option value="pendiente">Pendiente</option>
            <option value="jugado">Jugado</option>
          </select>
        </label>
        <button className="primary-button" disabled={!isAdmin} type="submit">
          {editingId ? <Save size={18} /> : <Plus size={18} />}
          {editingId ? 'Guardar' : 'Crear'}
        </button>
      </form>
      )}

      {activeView === 'list' && (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Centro de resultados</h3>
            <p className="muted">Ingresa marcadores reales, revisa estado y clasificados por fase.</p>
          </div>
          <span className="counter">{filteredMatches.length}</span>
        </div>
        <div className="match-filters">
          <label>
            Fase
            <select
              onChange={(event) => setFilters({ ...filters, stage: event.target.value, group: 'all' })}
              value={filters.stage}
            >
              <option value="all">Todas las fases</option>
              {stageOptions.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </label>
          <label>
            Grupo
            <select
              disabled={filters.stage !== 'Fase de grupos'}
              onChange={(event) => setFilters({ ...filters, group: event.target.value })}
              value={filters.group}
            >
              <option value="all">Todos los grupos</option>
              {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label>
            Fecha
            <input onChange={(event) => setFilters({ ...filters, date: event.target.value })} type="date" value={filters.date} />
          </label>
        </div>

        {filters.stage === 'Fase de grupos' && filters.group === 'all' ? (
          <div className="accordion-list">
            {matchesByGroup.map((section, index) => (
              <details className="accordion-panel" key={section.group} open={index < 2}>
                <summary>
                  {section.group}
                  <span>{section.matches.length} partidos</span>
                </summary>
                <div className="match-list compact-grid">
                  {section.matches.map(renderMatchCard)}
                </div>
              </details>
            ))}
            {!matchesByGroup.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        ) : filters.stage === 'Fase de grupos' ? (
          <div className="match-list compact-grid">
            {filteredMatches.map(renderMatchCard)}
            {!filteredMatches.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        ) : filters.stage === 'all' ? (
          <div className="accordion-list">
            {matchesByGroup.length > 0 && (
              <details className="accordion-panel" open>
                <summary>
                  Fase de grupos
                  <span>{matchesByGroup.reduce((total, section) => total + section.matches.length, 0)} partidos</span>
                </summary>
                <div className="accordion-list nested-accordion">
                  {matchesByGroup.map((section, index) => (
                    <details className="accordion-panel" key={section.group} open={index < 1}>
                      <summary>
                        {section.group}
                        <span>{section.matches.length} partidos</span>
                      </summary>
                      <div className="match-list compact-grid">
                        {section.matches.map(renderMatchCard)}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )}
            {knockoutSections.map((section) => (
              <details className="accordion-panel" key={section.stage}>
                <summary>
                  {section.stage}
                  <span>{section.matches.length} partidos</span>
                </summary>
                <div className="match-list compact-grid">
                  {section.matches.map(renderMatchCard)}
                </div>
              </details>
            ))}
            {!filteredMatches.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        ) : (
          <div className="match-list compact-grid">
            {filteredMatches.map(renderMatchCard)}
            {!filteredMatches.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        )}
      </div>
      )}

      {activeView === 'bracket' && (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Llaves reales</h3>
            <p className="muted">Consulta cómo se van formando los cruces oficiales con los resultados ingresados.</p>
          </div>
          <span className="counter">{visibleBracketRounds.reduce((total, section) => total + section.matches.length, 0)}</span>
        </div>

        <div className="bracket-toolbar">
          <label>
            Buscar selección o partido
            <input
              onChange={(event) => setBracketFilters({ ...bracketFilters, query: event.target.value })}
              placeholder="Ej: Colombia, #73, final"
              value={bracketFilters.query}
            />
          </label>
          <div className="phase-filter-card">
            <span>Fase</span>
            <div className="phase-chip-row" role="group" aria-label="Filtrar llaves reales por fase">
              <button
                className={bracketFilters.stage === 'all' ? 'phase-chip active' : 'phase-chip'}
                onClick={() => setBracketFilters({ ...bracketFilters, stage: 'all' })}
                type="button"
              >
                Todas
              </button>
              {knockoutStageOptions.map((stage) => (
                <button
                  className={bracketFilters.stage === stage ? 'phase-chip active' : 'phase-chip'}
                  key={stage}
                  onClick={() => setBracketFilters({ ...bracketFilters, stage })}
                  type="button"
                >
                  {stage === 'Semifinal' ? 'Semifinales' : stage}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleBracketRounds.length ? (
          <div className="bracket-board responsive-bracket-board">
            {visibleBracketRounds.map((section) => (
              <div className="bracket-round" key={section.stage}>
                <h4>{section.stage === 'Semifinal' ? 'Semifinales' : section.stage}</h4>
                {section.matches.map(renderBracketMatch)}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Todavía no hay llaves con esos filtros.</p>
        )}
      </div>
      )}
    </section>
  );
}

export default MatchPanel;
