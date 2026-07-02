import { useMemo, useState } from 'react';
import { getPredictionDistribution, getPredictionsForMatchDistribution, getPredictionScoreKeyForMatch } from '../utils/scoring';
import { displayMatch, displayTeam, getTeamFlag } from '../utils/localization';
import {
  getBogotaDateKey,
  getMatchBogotaDateKey,
  getMatchBogotaTime,
  getMatchSortKey,
  getYesterdayBogotaDateKey
} from '../utils/matchDate';

const palette = ['#f97316', '#2563eb', '#16a34a', '#7c3aed', '#dc2626', '#0891b2', '#f59e0b'];

const hasRealScore = (match) =>
  match?.realHomeScore !== '' &&
  match?.realHomeScore !== null &&
  match?.realHomeScore !== undefined &&
  match?.realAwayScore !== '' &&
  match?.realAwayScore !== null &&
  match?.realAwayScore !== undefined;

const getScoreParts = (score) => {
  const [homeGoals = '-', awayGoals = '-'] = String(score ?? '').split('-');
  return { awayGoals, homeGoals };
};

function DayScoreLabel({ isOfficialScore, match, score }) {
  const { awayGoals, homeGoals } = getScoreParts(score);

  return (
    <span className="today-score-label">
      <span className="score-team-score">
        <span className="team-flag">{getTeamFlag(match.homeTeam)}</span>
        <strong>{displayTeam(match.homeTeam)}</strong>
        <em>{homeGoals}</em>
      </span>
      <span className="score-separator">-</span>
      <span className="score-team-score">
        <em>{awayGoals}</em>
        <span className="team-flag">{getTeamFlag(match.awayTeam)}</span>
        <strong>{displayTeam(match.awayTeam)}</strong>
      </span>
      {isOfficialScore && <small>Resultado real</small>}
    </span>
  );
}

function MatchPredictionChart({ match, openScoreKey, participantById, predictions, setOpenScoreKey }) {
  const distribution = getPredictionDistribution(match, predictions).filter(
    (item) => !String(item.score).includes('undefined') && !String(item.score).includes('null')
  );
  const max = Math.max(...distribution.map((item) => item.count), 1);
  const officialScore = hasRealScore(match) ? `${match.realHomeScore}-${match.realAwayScore}` : '';

  const getParticipantsForScore = (score) =>
    getPredictionsForMatchDistribution(match, predictions)
      .filter((prediction) => getPredictionScoreKeyForMatch(prediction, match) === score)
      .map((prediction) => participantById[prediction.participantId]?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));

  if (!distribution.length) {
    return <p className="muted">Todavía no hay pronósticos registrados para este partido.</p>;
  }

  return (
    <div className="today-distribution-list">
      {distribution.map((item, index) => {
        const key = `${match.id}-${item.score}`;
        const expanded = openScoreKey === key;
        const names = getParticipantsForScore(item.score);
        const width = max ? Math.max((item.count / max) * 100, item.count > 0 ? 8 : 0) : 0;
        const isOfficialScore = item.score === officialScore;

        return (
          <div className={isOfficialScore ? 'today-distribution-item official-score-item' : 'today-distribution-item'} key={item.score}>
            <div
              aria-expanded={expanded}
              className="bar-row today-distribution-row interactive"
              onClick={() => setOpenScoreKey((current) => (current === key ? '' : key))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setOpenScoreKey((current) => (current === key ? '' : key));
                }
              }}
              role="button"
              tabIndex={0}
            >
              <DayScoreLabel isOfficialScore={isOfficialScore} match={match} score={item.score} />
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${width}%`, background: palette[index % palette.length] }} />
              </div>
              <strong>{item.count}</strong>
            </div>
            {expanded && (
              <div className="prediction-name-list">
                {names.map((name) => <span key={name}>{name}</span>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TodayMatchesPanel({ matches, participants, predictions }) {
  const [activeDay, setActiveDay] = useState('today');
  const [openScoreKey, setOpenScoreKey] = useState('');
  const todayKey = useMemo(() => getBogotaDateKey(), []);
  const yesterdayKey = useMemo(() => getYesterdayBogotaDateKey(), []);
  const activeDateKey = activeDay === 'today' ? todayKey : yesterdayKey;
  const dayMatches = useMemo(
    () =>
      matches
        .filter((match) => getMatchBogotaDateKey(match) === activeDateKey)
        .sort((a, b) => getMatchSortKey(a).localeCompare(getMatchSortKey(b))),
    [activeDateKey, matches]
  );
  const participantById = useMemo(
    () => Object.fromEntries(participants.map((participant) => [participant.id, participant])),
    [participants]
  );
  const finishedCount = dayMatches.filter((match) => match.status === 'jugado').length;
  const dayPredictionCount = dayMatches.reduce(
    (total, match) => total + getPredictionsForMatchDistribution(match, predictions).length,
    0
  );

  const dayTabs = [
    { id: 'today', label: 'Partidos de hoy', date: todayKey },
    { id: 'yesterday', label: 'Partidos de ayer', date: yesterdayKey }
  ];

  return (
    <section className="stack-list today-page">
      <div className="today-hero-card">
        <div>
          <span className="today-kicker">Entra aquí</span>
          <h3>{activeDay === 'today' ? 'Partidos de hoy' : 'Partidos de ayer'}</h3>
          <p>Consulta el calendario del día y cómo se repartieron los marcadores pronosticados.</p>
        </div>
        <div className="today-hero-stats">
          <article>
            <span>Partidos</span>
            <strong>{dayMatches.length}</strong>
          </article>
          <article>
            <span>Finalizados</span>
            <strong>{finishedCount}</strong>
          </article>
          <article>
            <span>Pronósticos</span>
            <strong>{dayPredictionCount}</strong>
          </article>
        </div>
      </div>

      <div className="panel today-tabs-panel">
        <div className="today-tabs" role="tablist" aria-label="Consultar partidos por día">
          {dayTabs.map((tab) => (
            <button
              aria-selected={activeDay === tab.id}
              className={activeDay === tab.id ? 'today-tab active' : 'today-tab'}
              key={tab.id}
              onClick={() => {
                setActiveDay(tab.id);
                setOpenScoreKey('');
              }}
              role="tab"
              type="button"
            >
              <strong>{tab.label}</strong>
              <span>{tab.date}</span>
            </button>
          ))}
        </div>
      </div>

      {dayMatches.length ? (
        <div className="today-match-grid">
          {dayMatches.map((match) => {
            const realScore = hasRealScore(match)
              ? `${match.realHomeScore} - ${match.realAwayScore}`
              : 'Pendiente';

            return (
              <article className="panel today-match-card" key={match.id}>
                <div className="today-match-heading">
                  <div>
                    <span>#{match.matchNumber ?? '-'} · {match.stage}{match.group ? ` · Grupo ${match.group}` : ''}</span>
                    <h3>{displayMatch(match)}</h3>
                  </div>
                  <strong>{getMatchBogotaTime(match)}</strong>
                </div>

                <div className="today-scoreboard">
                  <div>
                    <span>{getTeamFlag(match.homeTeam)}</span>
                    <strong>{displayTeam(match.homeTeam)}</strong>
                  </div>
                  <em>{realScore}</em>
                  <div>
                    <span>{getTeamFlag(match.awayTeam)}</span>
                    <strong>{displayTeam(match.awayTeam)}</strong>
                  </div>
                </div>

                <div className="today-match-meta">
                  <span className={`status ${match.status}`}>{match.status}</span>
                  <span>{match.stadium || match.city || 'Sede por definir'}</span>
                </div>

                <div className="today-chart-block">
                  <h4>Pronósticos de los participantes</h4>
                  <MatchPredictionChart
                    match={match}
                    openScoreKey={openScoreKey}
                    participantById={participantById}
                    predictions={predictions}
                    setOpenScoreKey={setOpenScoreKey}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel empty-today-panel">
          <h3>No hay partidos para esta fecha</h3>
          <p className="muted">Cuando el calendario tenga partidos en hora Colombia para este día, aparecerán aquí automáticamente.</p>
        </div>
      )}
    </section>
  );
}

export default TodayMatchesPanel;
