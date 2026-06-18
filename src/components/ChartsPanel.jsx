import { useMemo, useState } from 'react';
import { getPredictionDistribution } from '../utils/scoring';
import { displayMatch } from '../utils/localization';

const palette = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];

function Bar({ label, value, max, color }) {
  const width = max ? Math.max((value / max) * 100, value > 0 ? 6 : 0) : 0;
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${width}%`, background: color }} />
      </div>
      <strong>{value}</strong>
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
  const maxPoints = Math.max(...ranking.map((item) => item.totalPoints), 1);
  const maxExact = Math.max(...ranking.map((item) => item.exactScores), 1);
  const match = matchesWithPredictions.find((item) => item.id === selectedMatchId) ?? matchesWithPredictions[0] ?? matches[0];
  const distribution = match ? getPredictionDistribution(match, predictions) : [];
  const maxDistribution = Math.max(...distribution.map((item) => item.count), 1);
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
    <section className="section-grid">
      <div className="panel chart-panel">
        <div className="panel-heading">
          <h3>Puntos por participante</h3>
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
        {ranking.map((participant, index) => (
          <Bar
            color={palette[(index + 2) % palette.length]}
            key={participant.id}
            label={participant.name}
            max={maxExact}
            value={participant.exactScores}
          />
        ))}
      </div>

      <div className="panel chart-panel full-span">
        <div className="panel-heading">
          <div>
            <h3>Distribución de predicciones</h3>
            <p className="muted">{match ? displayMatch(match) : 'Sin partido seleccionado'}</p>
          </div>
          <label className="chart-match-selector">
            Partido
            <select
              onChange={(event) => {
                setSelectedMatchId(event.target.value);
                setOpenScore('');
              }}
              value={match?.id ?? ''}
            >
              {matchesWithPredictions.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.matchNumber ?? '-'} · {displayMatch(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {distribution.length ? (
          <div className="distribution-list">
            {distribution.map((item, index) => {
              const names = getParticipantsForScore(item.score);
              const width = maxDistribution ? Math.max((item.count / maxDistribution) * 100, item.count > 0 ? 6 : 0) : 0;
              const expanded = openScore === item.score;

              return (
                <div className="distribution-item" key={item.score}>
                  <div className="bar-row distribution-row">
                    <span>{item.score.replace('-', ' - ')}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${width}%`, background: palette[(index + 4) % palette.length] }} />
                    </div>
                    <button
                      aria-expanded={expanded}
                      className="count-button"
                      onClick={() => toggleScore(item.score)}
                      type="button"
                      title={`Ver participantes con marcador ${item.score.replace('-', ' - ')}`}
                    >
                      {item.count}
                    </button>
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
