import { useMemo, useState } from 'react';
import { getPredictionDistribution } from '../utils/scoring';
import { displayMatch, displayTeam } from '../utils/localization';
import { getExactScoreDetails } from '../utils/exactScoreDetails';

const palette = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];
const normalizeSearch = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const formatScore = (score) => String(score || '-').replace('-', ' - ');

function ExactHitList({ details }) {
  return (
    <div className="exact-hit-list">
      {details.length ? (
        details.map((detail) => (
          <article key={detail.id}>
            <span>{detail.phase}</span>
            <strong>
              {displayTeam(detail.teams[0]) || 'Equipo 1'} {formatScore(detail.predictedScore)} {displayTeam(detail.teams[1]) || 'Equipo 2'}
            </strong>
            <em>Real: {formatScore(detail.realScore)} · {detail.points} pts</em>
          </article>
        ))
      ) : (
        <p className="muted">No tiene marcadores exactos todavía.</p>
      )}
    </div>
  );
}

function Bar({ children, color, expanded = false, label, max, onClick, value }) {
  const width = max ? Math.max((value / max) * 100, value > 0 ? 6 : 0) : 0;
  const interactiveProps = onClick
    ? {
        'aria-expanded': expanded,
        onClick,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        },
        role: 'button',
        tabIndex: 0
      }
    : {};

  return (
    <div className={expanded ? 'chart-bar-item expanded' : 'chart-bar-item'}>
      <div className={onClick ? 'bar-row interactive' : 'bar-row'} {...interactiveProps}>
        <span>{label}</span>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${width}%`, background: color }} />
        </div>
        <strong>{value}</strong>
      </div>
      {expanded && children}
    </div>
  );
}

function ChartsPanel({ matches, participants, predictions, ranking }) {
  const matchesWithPredictions = useMemo(
    () => matches.filter((item) => predictions.some((prediction) => prediction.matchId === item.id)),
    [matches, predictions]
  );
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [openScore, setOpenScore] = useState('');
  const [openExactParticipantId, setOpenExactParticipantId] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('Todas las fases');
  const [groupFilter, setGroupFilter] = useState('Todos los grupos');
  const maxPoints = Math.max(...ranking.map((item) => item.totalPoints), 1);
  const maxExact = Math.max(...ranking.map((item) => item.exactScores), 1);
  const stageOptions = useMemo(
    () => ['Todas las fases', ...new Set(matchesWithPredictions.map((item) => item.stage).filter(Boolean))],
    [matchesWithPredictions]
  );
  const groupOptions = useMemo(
    () => ['Todos los grupos', ...new Set(matchesWithPredictions.map((item) => item.group).filter(Boolean).map((group) => `Grupo ${group}`))],
    [matchesWithPredictions]
  );
  const filteredMatches = useMemo(() => {
    const query = normalizeSearch(matchSearch);
    return matchesWithPredictions.filter((item) => {
      const stageMatches = stageFilter === 'Todas las fases' || item.stage === stageFilter;
      const groupMatches = groupFilter === 'Todos los grupos' || `Grupo ${item.group}` === groupFilter;
      const searchText = normalizeSearch(`#${item.matchNumber} ${displayMatch(item)} ${item.stage} Grupo ${item.group}`);
      return stageMatches && groupMatches && (!query || searchText.includes(query));
    });
  }, [groupFilter, matchSearch, matchesWithPredictions, stageFilter]);
  const match =
    matchesWithPredictions.find((item) => item.id === selectedMatchId) ??
    filteredMatches[0] ??
    matchesWithPredictions[0] ??
    matches[0];
  const visibleMatchOptions = filteredMatches.slice(0, 12);
  const distribution = match ? getPredictionDistribution(match, predictions) : [];
  const maxDistribution = Math.max(...distribution.map((item) => item.count), 1);
  const hasOfficialScore =
    match?.realHomeScore !== '' &&
    match?.realHomeScore !== null &&
    match?.realHomeScore !== undefined &&
    match?.realAwayScore !== '' &&
    match?.realAwayScore !== null &&
    match?.realAwayScore !== undefined;
  const officialScore = hasOfficialScore ? `${match.realHomeScore}-${match.realAwayScore}` : '';
  const officialScoreLabel = hasOfficialScore ? `${match.realHomeScore} - ${match.realAwayScore}` : 'Pendiente';
  const participantById = useMemo(
    () => Object.fromEntries(participants.map((participant) => [participant.id, participant])),
    [participants]
  );

  const getParticipantsForScore = (score) =>
    predictions
      .filter((prediction) => prediction.matchId === match?.id && `${prediction.homeScore}-${prediction.awayScore}` === score)
      .map((prediction) => participantById[prediction.participantId]?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));

  const toggleScore = (score) => {
    setOpenScore((current) => (current === score ? '' : score));
  };

  return (
    <section className="section-grid charts-layout">
      <div className="panel chart-panel">
        <div className="panel-heading">
          <h3>Ranking de puntos</h3>
        </div>
        {ranking.map((participant, index) => (
          <Bar
            color={palette[index % palette.length]}
            key={participant.id}
            label={participant.name}
            max={maxPoints}
            value={participant.totalPoints}
          />
        ))}
      </div>

      <div className="panel chart-panel">
        <div className="panel-heading">
          <h3>Marcadores exactos</h3>
        </div>
        {ranking.map((participant, index) => {
          const exactDetails = getExactScoreDetails(participant);
          const expanded = openExactParticipantId === participant.id;

          return (
            <Bar
              color={palette[(index + 2) % palette.length]}
              expanded={expanded}
              key={participant.id}
              label={participant.name}
              max={maxExact}
              onClick={() => setOpenExactParticipantId((current) => (current === participant.id ? '' : participant.id))}
              value={participant.exactScores}
            >
              <ExactHitList details={exactDetails} />
            </Bar>
          );
        })}
      </div>

      <div className="panel chart-panel full-span">
        <div className="panel-heading">
          <div>
            <h3>Distribución de predicciones</h3>
            <p className="muted">{match ? displayMatch(match) : 'Sin partido seleccionado'}</p>
            <p className="chart-real-score">
              Resultado real: <strong>{officialScoreLabel}</strong>
            </p>
          </div>
        </div>
        <div className="chart-match-browser">
          <div className="chart-match-filters">
            <label>
              Buscar
              <input
                onChange={(event) => setMatchSearch(event.target.value)}
                placeholder="Equipo o # partido"
                value={matchSearch}
              />
            </label>
            <label>
              Fase
              <select onChange={(event) => setStageFilter(event.target.value)} value={stageFilter}>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </label>
            <label>
              Grupo
              <select onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}>
                {groupOptions.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="match-picker-list" aria-label="Partidos filtrados">
            {visibleMatchOptions.map((item) => (
              <button
                className={item.id === match?.id ? 'match-picker active' : 'match-picker'}
                key={item.id}
                onClick={() => {
                  setSelectedMatchId(item.id);
                  setOpenScore('');
                }}
                type="button"
              >
                <strong>#{item.matchNumber ?? '-'}</strong>
                <span>{displayMatch(item)}</span>
              </button>
            ))}
          </div>
          {filteredMatches.length > visibleMatchOptions.length && (
            <p className="muted">Mostrando 12 de {filteredMatches.length}. Usa el buscador para reducir la lista.</p>
          )}
          {!filteredMatches.length && <p className="muted">No hay partidos con esos filtros.</p>}
        </div>
        {distribution.length ? (
          <div className="distribution-list">
            {distribution.map((item, index) => {
              const names = getParticipantsForScore(item.score);
              const width = maxDistribution ? Math.max((item.count / maxDistribution) * 100, item.count > 0 ? 6 : 0) : 0;
              const expanded = openScore === item.score;
              const isOfficialScore = item.score === officialScore;

              return (
                <div className={isOfficialScore ? 'distribution-item official-score-item' : 'distribution-item'} key={item.score}>
                  <div
                    aria-expanded={expanded}
                    className="bar-row distribution-row interactive"
                    onClick={() => toggleScore(item.score)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleScore(item.score);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title={`Ver participantes con marcador ${item.score.replace('-', ' - ')}`}
                  >
                    <span className="distribution-score">
                      {item.score.replace('-', ' - ')}
                      {isOfficialScore && <small>Resultado real</small>}
                    </span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${width}%`, background: palette[(index + 4) % palette.length] }} />
                    </div>
                    <span className="count-button count-display">
                      {item.count}
                    </span>
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
        ) : (
          <p className="muted">Todavía no hay predicciones para graficar.</p>
        )}
      </div>
    </section>
  );
}

export default ChartsPanel;
