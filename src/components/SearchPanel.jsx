import { useMemo, useState } from 'react';
import { displayMatch, displayTeam } from '../utils/localization';
import { getPredictionsForMatchDistribution } from '../utils/scoring';

const normalizeSearch = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function SearchPanel({ matches, participants, predictions }) {
  const [globalQuery, setGlobalQuery] = useState('');
  const [participantQuery, setParticipantQuery] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id ?? '');
  const [scoreQuery, setScoreQuery] = useState({ home: '', away: '' });

  const selectedMatch = matches.find((match) => match.id === selectedMatchId);

  const participantResults = useMemo(
    () => participants.filter((participant) => normalizeSearch(participant.name).includes(normalizeSearch(participantQuery))),
    [participants, participantQuery]
  );

  const smartResults = useMemo(() => {
    const query = normalizeSearch(globalQuery);
    if (!query) return [];

    const participantMatches = participants
      .filter((participant) => normalizeSearch(participant.name).includes(query))
      .slice(0, 6)
      .map((participant) => ({
        id: `participant-${participant.id}`,
        type: 'Participante',
        title: participant.name,
        description: participant.paid ? 'Pago confirmado' : 'Pago pendiente'
      }));

    const matchMatches = matches
      .filter((match) => {
        const text = normalizeSearch(`#${match.matchNumber} ${displayMatch(match)} ${match.stage} Grupo ${match.group}`);
        return text.includes(query);
      })
      .slice(0, 8)
      .map((match) => ({
        id: `match-${match.id}`,
        type: 'Partido',
        title: displayMatch(match),
        description: `#${match.matchNumber ?? '-'} · ${match.stage}${match.group ? ` · Grupo ${match.group}` : ''}`
      }));

    const groupMatches = [...new Set(matches.map((match) => match.group).filter(Boolean))]
      .filter((group) => normalizeSearch(`Grupo ${group}`).includes(query))
      .map((group) => ({
        id: `group-${group}`,
        type: 'Grupo',
        title: `Grupo ${group}`,
        description: `${matches.filter((match) => match.group === group).length} partidos`
      }));

    return [...participantMatches, ...matchMatches, ...groupMatches].slice(0, 14);
  }, [globalQuery, matches, participants]);

  const matchPredictions = getPredictionsForMatchDistribution(selectedMatch, predictions)
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
      <div className="panel full-span smart-search-panel">
        <div className="panel-heading">
          <div>
            <h3>Búsqueda inteligente</h3>
            <p className="muted">Busca por participante, selección, partido o grupo.</p>
          </div>
        </div>
        <input
          onChange={(event) => setGlobalQuery(event.target.value)}
          placeholder="Ej: Joham, Colombia, México, Grupo A, Brasil vs Marruecos"
          value={globalQuery}
        />
        {globalQuery && (
          <div className="smart-results-grid">
            {smartResults.map((result) => (
              <article className="smart-result-card" key={result.id}>
                <span>{result.type}</span>
                <strong>{result.title}</strong>
                <p>{result.description}</p>
              </article>
            ))}
            {!smartResults.length && <p className="muted">No encontré resultados con esa búsqueda.</p>}
          </div>
        )}
      </div>

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
