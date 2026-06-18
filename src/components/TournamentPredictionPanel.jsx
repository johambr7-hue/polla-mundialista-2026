import { useState } from 'react';
import { CheckCircle2, Lock, Save } from 'lucide-react';
import {
  buildBracket,
  createEmptyTournamentEntry,
  getGroupMatches,
  getPrediction,
  getTieGroups,
  isKnockoutPredictionComplete,
  updateTournamentMatchPrediction,
  validateTournamentEntry
} from '../utils/tournament';
import { displayTeam } from '../utils/localization';
import { calculatePredictionBreakdown } from '../utils/scoring';

const roundOrder = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercer puesto', 'Final'];
const viewTabs = ['Grupos', ...roundOrder, 'Ver llave'];
const finalLabels = {
  champion: 'Campeón',
  second: 'Segundo lugar',
  third: 'Tercer lugar',
  fourth: 'Cuarto lugar'
};

const isDeadlinePassed = (deadline) => deadline && new Date(deadline).getTime() < Date.now();

function TournamentPredictionPanel({
  currentParticipantId,
  isAdmin,
  matches,
  participants,
  settings,
  tournamentEntries,
  updateTournamentEntries
}) {
  const participant = participants.find((item) => item.id === currentParticipantId);
  const entry = tournamentEntries[currentParticipantId] ?? createEmptyTournamentEntry();
  const bracket = buildBracket(matches, entry);
  const validation = validateTournamentEntry(matches, entry);
  const locked = isDeadlinePassed(settings.predictionDeadline) && !isAdmin;
  const [activeView, setActiveView] = useState('Grupos');
  const participantSummary = Object.entries(entry.matchPredictions ?? {}).reduce(
    (acc, [matchNumber, prediction]) => {
      const match = matches.find((item) => String(item.matchNumber) === String(matchNumber));
      if (!match) return acc;
      const breakdown = calculatePredictionBreakdown(prediction, match, settings);
      acc.points += breakdown.total;
      if (breakdown.exactScoreHit) acc.exactScores += 1;
      if (breakdown.resultHit && match.stage === 'Fase de grupos') acc.resultHits += 1;
      if (breakdown.qualifiedTeamHit) acc.qualifiedTeamHits += 1;
      if (breakdown.bracketHit) acc.bracketHits += 1;
      return acc;
    },
    { points: 0, exactScores: 0, resultHits: 0, qualifiedTeamHits: 0, bracketHits: 0 }
  );
  const finalResults = entry.finalResults ?? bracket.finalResults;

  const updateEntry = (nextEntry) => {
    const nextValidation = validateTournamentEntry(matches, nextEntry);
    updateTournamentEntries({
      ...tournamentEntries,
      [currentParticipantId]: {
        ...nextEntry,
        complete: nextValidation.complete,
        finalResults: nextValidation.bracket.finalResults
      }
    });
  };

  const updateMatch = (matchNumber, field, value) => {
    updateEntry(updateTournamentMatchPrediction(entry, matchNumber, field, value));
  };

  const updateTieOrder = (group, teams, index, value) => {
    const currentOrder = entry.tieBreakOrders?.[group] ?? teams;
    const nextOrder = [...currentOrder];
    nextOrder[index] = value;
    updateEntry({
      ...entry,
      tieBreakOrders: {
        ...(entry.tieBreakOrders ?? {}),
        [group]: [...new Set(nextOrder)]
      }
    });
  };

  const submitEntry = () => {
    if (!validation.complete) return;
    updateTournamentEntries({
      ...tournamentEntries,
      [currentParticipantId]: {
        ...entry,
        complete: true,
        submittedAt: new Date().toISOString(),
        finalResults: bracket.finalResults
      }
    });
  };

  const renderGroupMatch = (match) => {
    const prediction = getPrediction(entry, match.matchNumber);
    return (
      <article className="match-card compact-card" key={match.id}>
        <div className="match-meta">
          <span>#{match.matchNumber} · Grupo {match.group}</span>
          <span>{match.date}</span>
        </div>
        <div className="score-line">
          <strong>{displayTeam(match.homeTeam)}</strong>
          <span>vs</span>
          <strong>{displayTeam(match.awayTeam)}</strong>
        </div>
        <div className="prediction-inputs">
          <label>
            Goles {displayTeam(match.homeTeam)}
            <input disabled={locked} min="0" onChange={(event) => updateMatch(match.matchNumber, 'homeScore', event.target.value)} type="number" value={prediction.homeScore ?? ''} />
          </label>
          <label>
            Goles {displayTeam(match.awayTeam)}
            <input disabled={locked} min="0" onChange={(event) => updateMatch(match.matchNumber, 'awayScore', event.target.value)} type="number" value={prediction.awayScore ?? ''} />
          </label>
        </div>
        {prediction.excludedFromScoring && <p className="muted lock-note">{prediction.exclusionReason}</p>}
      </article>
    );
  };

  const renderKnockoutMatch = (match) => {
    const prediction = getPrediction(entry, match.matchNumber);
    const complete = isKnockoutPredictionComplete(prediction, match.homeTeam, match.awayTeam);
    const draw = prediction.homeScore !== '' && prediction.awayScore !== '' && Number(prediction.homeScore) === Number(prediction.awayScore);
    return (
      <article className="bracket-match compact-card" key={match.id}>
        <span>#{match.matchNumber}</span>
        <strong>{match.homeTeam ? displayTeam(match.homeTeam) : 'Por definir'}</strong>
        <strong>{match.awayTeam ? displayTeam(match.awayTeam) : 'Por definir'}</strong>
        <div className="prediction-inputs">
          <input disabled={locked || !match.homeTeam || !match.awayTeam} min="0" onChange={(event) => updateMatch(match.matchNumber, 'homeScore', event.target.value)} type="number" value={prediction.homeScore ?? ''} />
          <input disabled={locked || !match.homeTeam || !match.awayTeam} min="0" onChange={(event) => updateMatch(match.matchNumber, 'awayScore', event.target.value)} type="number" value={prediction.awayScore ?? ''} />
        </div>
        {draw && (
          <fieldset className={prediction.penaltyWinner ? 'penalty-box' : 'penalty-box required'}>
            <legend>Ganador por penales</legend>
            {[match.homeTeam, match.awayTeam].map((team) => (
              <label className="radio-label" key={team}>
                <input checked={prediction.penaltyWinner === team} disabled={locked} name={`tp-${currentParticipantId}-${match.matchNumber}`} onChange={() => updateMatch(match.matchNumber, 'penaltyWinner', team)} type="radio" />
                {displayTeam(team)}
              </label>
            ))}
          </fieldset>
        )}
        <p className="muted">
          {prediction.excludedFromScoring ? 'Sin puntaje' : complete ? <><CheckCircle2 size={14} /> Clasifica {displayTeam(match.winner)}</> : 'Completa marcador y clasificado'}
        </p>
        {prediction.excludedFromScoring && <p className="muted lock-note">{prediction.exclusionReason}</p>}
      </article>
    );
  };

  return (
    <section className="stack-list">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Polla completa de {participant?.name}</h3>
            <p className="muted">Llena todos los marcadores. Las llaves se construyen con tus propios resultados.</p>
          </div>
          <div className="row-actions">
            {locked && <span className="warning-pill"><Lock size={14} /> Bloqueada</span>}
            <button className="primary-button" disabled={locked || !validation.complete} onClick={submitEntry} type="button">
              <Save size={18} />
              Guardar polla completa
            </button>
          </div>
        </div>
        <div className="summary-grid">
          <article>
            <span>Participante</span>
            <strong>{participant?.name}</strong>
          </article>
          <article>
            <span>Puntos actuales</span>
            <strong>{participantSummary.points}</strong>
          </article>
          <article>
            <span>Marcadores exactos</span>
            <strong>{participantSummary.exactScores}</strong>
          </article>
          <article>
            <span>Aciertos de ganador</span>
            <strong>{participantSummary.resultHits}</strong>
          </article>
          <article>
            <span>Aciertos de clasificados</span>
            <strong>{participantSummary.qualifiedTeamHits}</strong>
          </article>
          <article>
            <span>Llaves acertadas</span>
            <strong>{participantSummary.bracketHits}</strong>
          </article>
        </div>
        <div className="final-picks-strip">
          <span>🏆 {displayTeam(finalResults.champion) || 'Campeón por definir'}</span>
          <span>🥈 {displayTeam(finalResults.second) || 'Subcampeón por definir'}</span>
          <span>🥉 {displayTeam(finalResults.third) || 'Tercer lugar por definir'}</span>
          <span>4 {displayTeam(finalResults.fourth) || 'Cuarto lugar por definir'}</span>
        </div>
        {!validation.complete && (
          <div className="notice">No se puede guardar como completa mientras falten marcadores, clasificados o posiciones finales.</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Consulta por fase</h3>
        </div>
        <div className="tab-strip">
          {viewTabs.map((tab) => (
            <button className={activeView === tab ? 'tab-button active' : 'tab-button'} key={tab} onClick={() => setActiveView(tab)} type="button">
              {tab === 'Semifinal' ? 'Semifinales' : tab}
            </button>
          ))}
        </div>

        {activeView === 'Grupos' && (
          <div className="accordion-list">
            {Object.entries(bracket.groupTables).map(([group, rows], index) => (
              <details className="accordion-panel" key={group} open={index < 2}>
                <summary>Grupo {group} <span>{getGroupMatches(matches).filter((match) => match.group === group).length} partidos</span></summary>
                <div className="prediction-grid compact-grid">
                  {getGroupMatches(matches).filter((match) => match.group === group).map(renderGroupMatch)}
                </div>
                <div className="mini-table-wrap">
                  <table>
                    <thead>
                      <tr><th>Equipo</th><th>Pts</th><th>DG</th><th>GF</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.team}>
                          <td>{displayTeam(row.team)}</td>
                          <td>{row.points}</td>
                          <td>{row.goalDifference}</td>
                          <td>{row.goalsFor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {getTieGroups(rows).map((teams) => (
                  <div className="tie-break-box" key={teams.join('-')}>
                    <strong>Desempate manual</strong>
                    {teams.map((team, teamIndex) => (
                      <label key={`${team}-${teamIndex}`}>
                        Puesto {teamIndex + 1}
                        <select disabled={locked} onChange={(event) => updateTieOrder(group, teams, teamIndex, event.target.value)} value={entry.tieBreakOrders?.[group]?.[teamIndex] ?? team}>
                          {teams.map((option) => <option key={option} value={option}>{displayTeam(option)}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                ))}
              </details>
            ))}
          </div>
        )}

        {roundOrder.includes(activeView) && (
          <div className="prediction-grid compact-grid">
            {(bracket.rounds[activeView] ?? []).map(renderKnockoutMatch)}
          </div>
        )}

        {activeView === 'Ver llave' && (
          <div className="bracket-board visual-bracket">
            {roundOrder.filter((round) => round !== 'Tercer puesto').map((round) => (
              <section className="bracket-round" key={round}>
                <h4>{round === 'Semifinal' ? 'Semifinales' : round}</h4>
                {(bracket.rounds[round] ?? []).map((match) => (
                  <article className={round === 'Final' ? 'bracket-match champion-path' : 'bracket-match'} key={match.id}>
                    <span>#{match.matchNumber}</span>
                    <strong>{displayTeam(match.homeTeam)}</strong>
                    <strong>{displayTeam(match.awayTeam)}</strong>
                    <p className="muted">Clasifica {displayTeam(match.winner) || 'Por definir'}</p>
                  </article>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Resultado final proyectado</h3>
        </div>
        <div className="summary-grid">
          {Object.entries(bracket.finalResults).map(([field, value]) => (
            <article key={field}>
              <span>{finalLabels[field]}</span>
              <strong>{value ? displayTeam(value) : 'Por definir'}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TournamentPredictionPanel;
