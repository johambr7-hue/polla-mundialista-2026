import { useMemo, useState } from 'react';
import { displayTeam } from '../utils/localization';

function SearchPanel({ matches, participants, predictions }) {
  const [participantQuery, setParticipantQuery] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id ?? '');
  const [scoreQuery, setScoreQuery] = useState({ home: '', away: '' });

  const selectedMatch = matches.find((match) => match.id === selectedMatchId);

  const participantResults = useMemo(
    () => participants.filter((participant) => participant.name.toLowerCase().includes(participantQuery.toLowerCase())),
    [participants, participantQuery]
  );

  const matchPredictions = predictions
    .filter((prediction) => prediction.matchId === selectedMatchId)
    .map((prediction) => ({
      ...prediction,
      participant: participants.find((participant) => participant.id === prediction.participantId)
    }));

  const scoreResults = matchPredictions.filter((prediction) => {
    const hasHome = scoreQuery.home !== '';
    const hasAway = scoreQuery.away !== '';
    return (!hasHome || Number(scoreQuery.home) === Number(prediction.homeScore)) &&
      (!hasAway || Number(scoreQuery.away) === Number(prediction.awayScore));
  });

  return (
    <section className="section-grid two-columns">
      <div className="panel">
        <div className="panel-heading">
          <h3>Buscar participante</h3>
        </div>
        <input
          onChange={(event) => setParticipantQuery(event.target.value)}
          placeholder="Nombre del participante"
          value={participantQuery}
        />
        <div className="stack-list">
          {participantResults.map((participant) => (
            <article className="list-item" key={participant.id}>
              <div>
                <strong>{participant.name}</strong>
                <span>{participant.email || 'Sin correo'}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Predicciones por partido</h3>
        </div>
        <select onChange={(event) => setSelectedMatchId(event.target.value)} value={selectedMatchId}>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {displayTeam(match.homeTeam)} vs {displayTeam(match.awayTeam)}
            </option>
          ))}
        </select>
        {selectedMatch && (
          <div className="search-score">
            <strong>{displayTeam(selectedMatch.homeTeam)}</strong>
            <input
              aria-label="Buscar marcador local"
              min="0"
              onChange={(event) => setScoreQuery({ ...scoreQuery, home: event.target.value })}
              placeholder="Local"
              type="number"
              value={scoreQuery.home}
            />
            <span>-</span>
            <input
              aria-label="Buscar marcador visitante"
              min="0"
              onChange={(event) => setScoreQuery({ ...scoreQuery, away: event.target.value })}
              placeholder="Visitante"
              type="number"
              value={scoreQuery.away}
            />
            <strong>{displayTeam(selectedMatch.awayTeam)}</strong>
          </div>
        )}
        <div className="stack-list">
          {(scoreQuery.home || scoreQuery.away ? scoreResults : matchPredictions).map((prediction) => (
            <article className="list-item" key={prediction.id}>
              <div>
                <strong>{prediction.participant?.name ?? 'Participante eliminado'}</strong>
                <span>{prediction.homeScore} - {prediction.awayScore}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SearchPanel;
