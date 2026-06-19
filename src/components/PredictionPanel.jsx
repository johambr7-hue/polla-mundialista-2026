import { useMemo, useState } from 'react';
import { Lock, Save } from 'lucide-react';
import {
  calculatePredictionBreakdown,
  calculatePredictionPoints,
  getPredictedQualifiedTeam,
  isMatchScorable,
  isPredictionDraw
} from '../utils/scoring';
import { displayTeam } from '../utils/localization';

const isGroupStage = (stage) => stage === 'Fase de grupos';
const finalFields = [
  ['champion', 'Campeón'],
  ['second', 'Segundo lugar'],
  ['third', 'Tercer lugar'],
  ['fourth', 'Cuarto lugar']
];
const phases = ['Fase de grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercer puesto', 'Final'];
const groupOptions = ['Todos los grupos', ...'ABCDEFGHIJKL'.split('').map((group) => `Grupo ${group}`)];

const getMatchGroupLabel = (match) => `Grupo ${match.group}`;

function PredictionPanel({
  currentParticipantId,
  finalPredictions,
  isAdmin,
  matches,
  participants,
  predictions,
  settings,
  updateFinalPredictions,
  updatePredictions
}) {
  const [selectedParticipantId, setSelectedParticipantId] = useState(currentParticipantId);
  const [phaseFilter, setPhaseFilter] = useState('Fase de grupos');
  const [groupFilter, setGroupFilter] = useState('Todos los grupos');
  const participantId = isAdmin ? selectedParticipantId : currentParticipantId;
  const predictionsClosed = Boolean(settings.predictionsLocked) && !isAdmin;
  const adminCanEditPlayedMatches = isAdmin && !settings.predictionsLocked;
  const participant = participants.find((item) => item.id === participantId);
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [matches]
  );
  const participantPredictions = predictions.filter((prediction) => prediction.participantId === participantId);
  const participantSummary = participantPredictions.reduce(
    (acc, prediction) => {
      const match = matches.find((item) => item.id === prediction.matchId);
      if (!match) return acc;
      const breakdown = calculatePredictionBreakdown(prediction, match, settings);
      acc.points += breakdown.total;
      if (breakdown.exactScoreHit) acc.exactScores += 1;
      if (breakdown.resultHit && isGroupStage(match.stage)) acc.resultHits += 1;
      if (breakdown.qualifiedTeamHit) acc.qualifiedTeamHits += 1;
      if (breakdown.bracketHit) acc.bracketHits += 1;
      return acc;
    },
    { points: 0, exactScores: 0, resultHits: 0, qualifiedTeamHits: 0, bracketHits: 0 }
  );

  const finalPrediction = finalPredictions[participantId] ?? {};

  const normalizeValue = (field, value) => {
    if (field === 'homeScore' || field === 'awayScore') return value === '' ? '' : Number(value);
    return value;
  };

  const upsertPrediction = (match, field, value) => {
    if (predictionsClosed || (match.status === 'jugado' && !adminCanEditPlayedMatches)) return;

    const existing = predictions.find(
      (prediction) => prediction.matchId === match.id && prediction.participantId === participantId
    );

    if (existing) {
      updatePredictions(
        predictions.map((prediction) => {
          const samePrediction = prediction.id && existing.id
            ? prediction.id === existing.id
            : prediction.matchId === match.id && prediction.participantId === participantId;
          if (!samePrediction) return prediction;

          const nextPrediction = { ...prediction, [field]: normalizeValue(field, value) };
          if (!isGroupStage(match.stage) && !isPredictionDraw(nextPrediction)) {
            nextPrediction.penaltyWinner = '';
          }
          return nextPrediction;
        })
      );
      return;
    }

    updatePredictions([
      ...predictions,
      {
        participantId,
        matchId: match.id,
        homeScore: field === 'homeScore' ? normalizeValue(field, value) : '',
        awayScore: field === 'awayScore' ? normalizeValue(field, value) : '',
        qualifiedTeam: field === 'qualifiedTeam' ? value : '',
        penaltyWinner: field === 'penaltyWinner' ? value : '',
        predictedHomeTeam: field === 'predictedHomeTeam' ? value : match.homeTeam,
        predictedAwayTeam: field === 'predictedAwayTeam' ? value : match.awayTeam,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const updateFinalPrediction = (field, value) => {
    if (predictionsClosed) return;

    updateFinalPredictions({
      ...finalPredictions,
      [participantId]: {
        ...(finalPredictions[participantId] ?? {}),
        [field]: value
      }
    });
  };

  const renderMatchCard = (match) => {
    const prediction = predictions.find(
      (item) => item.matchId === match.id && item.participantId === participantId
    );
    const locked = predictionsClosed || (match.status === 'jugado' && !adminCanEditPlayedMatches);
    const points = calculatePredictionPoints(prediction, match, settings);
    const knockout = !isGroupStage(match.stage);
    const predictedTeams = {
      home: prediction?.predictedHomeTeam || match.homeTeam,
      away: prediction?.predictedAwayTeam || match.awayTeam
    };
    const predictedDraw = knockout && isPredictionDraw(prediction);
    const predictedQualifiedTeam = knockout ? getPredictedQualifiedTeam(prediction, match) : '';
    const needsPenaltyWinner = predictedDraw && !prediction?.penaltyWinner;

    return (
      <article className="match-card compact-card" key={match.id}>
        <div className="match-meta">
          <span>#{match.matchNumber} · {match.stage === 'Fase de grupos' ? getMatchGroupLabel(match) : match.stage}</span>
          <span className={`status ${match.status}`}>{match.status}</span>
        </div>
        <div className="score-line">
          <strong>{displayTeam(knockout ? predictedTeams.home : match.homeTeam)}</strong>
          <span>vs</span>
          <strong>{displayTeam(knockout ? predictedTeams.away : match.awayTeam)}</strong>
        </div>
        {knockout && (
          <div className="prediction-inputs">
            <label>
              Equipo llave 1
              <input
                disabled={locked || !participantId}
                onChange={(event) => upsertPrediction(match, 'predictedHomeTeam', event.target.value)}
                value={displayTeam(predictedTeams.home)}
              />
            </label>
            <label>
              Equipo llave 2
              <input
                disabled={locked || !participantId}
                onChange={(event) => upsertPrediction(match, 'predictedAwayTeam', event.target.value)}
                value={displayTeam(predictedTeams.away)}
              />
            </label>
          </div>
        )}
        <div className="prediction-inputs">
          <label>
            Goles {displayTeam(knockout ? predictedTeams.home : match.homeTeam)}
            <input disabled={locked || !participantId} min="0" onChange={(event) => upsertPrediction(match, 'homeScore', event.target.value)} type="number" value={prediction?.homeScore ?? ''} />
          </label>
          <label>
            Goles {displayTeam(knockout ? predictedTeams.away : match.awayTeam)}
            <input disabled={locked || !participantId} min="0" onChange={(event) => upsertPrediction(match, 'awayScore', event.target.value)} type="number" value={prediction?.awayScore ?? ''} />
          </label>
        </div>
        {knockout && (
          <div className="knockout-summary">
            <span>Marcador pronosticado</span>
            <strong>
              {prediction?.homeScore === '' || prediction?.homeScore === undefined ? '-' : prediction.homeScore}
              {' - '}
              {prediction?.awayScore === '' || prediction?.awayScore === undefined ? '-' : prediction.awayScore}
            </strong>
            {predictedDraw ? (
              <fieldset className={needsPenaltyWinner ? 'penalty-box required' : 'penalty-box'}>
                <legend>¿Quién gana en penales?</legend>
                {[predictedTeams.home, predictedTeams.away].map((team) => (
                  <label className="radio-label" key={team}>
                    <input checked={prediction?.penaltyWinner === team} disabled={locked || !participantId} name={`penalty-${participantId}-${match.id}`} onChange={() => upsertPrediction(match, 'penaltyWinner', team)} required={predictedDraw} type="radio" />
                    {displayTeam(team)}
                  </label>
                ))}
                {needsPenaltyWinner && <p>Selecciona ganador por penales para completar el pronóstico.</p>}
              </fieldset>
            ) : (
              <p className="muted">Clasificado pronosticado: {predictedQualifiedTeam ? displayTeam(predictedQualifiedTeam) : 'Completa el marcador'}</p>
            )}
            {predictedDraw && prediction?.penaltyWinner && <p className="muted">Ganador por penales: {displayTeam(prediction.penaltyWinner)}</p>}
          </div>
        )}
        <div className="card-footer">
          <span>Real: {match.realHomeScore === '' ? '-' : match.realHomeScore} : {match.realAwayScore === '' ? '-' : match.realAwayScore}</span>
          {prediction?.excludedFromScoring ? (
            <span className="warning-pill">Sin puntaje</span>
          ) : locked ? (
            <span className="points-pill">{isMatchScorable(match) ? `${points} pts` : 'Cerrado'}</span>
          ) : needsPenaltyWinner ? (
            <span className="warning-pill">Falta penales</span>
          ) : (
            <span className="save-note"><Save size={14} /> Guardado automático</span>
          )}
        </div>
        {prediction?.excludedFromScoring && <p className="muted lock-note">{prediction.exclusionReason}</p>}
        {locked && (
          <p className="muted lock-note">
            <Lock size={14} />{' '}
            {predictionsClosed ? 'Edición bloqueada porque los pronósticos están cerrados.' : 'Edición bloqueada porque el partido está jugado.'}
          </p>
        )}
        {adminCanEditPlayedMatches && match.status === 'jugado' && (
          <p className="muted lock-note">Modo administrador: puedes corregir este pronóstico porque los pronósticos están abiertos.</p>
        )}
      </article>
    );
  };

  const phaseMatches = sortedMatches.filter((match) => match.stage === phaseFilter);
  const visibleGroupMatches = phaseMatches.filter((match) => groupFilter === 'Todos los grupos' || getMatchGroupLabel(match) === groupFilter);
  const groupedMatches = groupOptions.slice(1).map((groupLabel) => ({
    groupLabel,
    matches: phaseMatches.filter((match) => getMatchGroupLabel(match) === groupLabel)
  })).filter((group) => group.matches.length);

  return (
    <section className="stack-list">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Predicciones de {participant?.name}</h3>
            <p className="muted">Consulta una fase o grupo sin navegar una página interminable.</p>
          </div>
          {isAdmin && (
            <select onChange={(event) => setSelectedParticipantId(event.target.value)} value={participantId}>
              {participants.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="participant-summary">
          <article><span>Puntos actuales</span><strong>{participantSummary.points}</strong></article>
          <article><span>Marcadores exactos</span><strong>{participantSummary.exactScores}</strong></article>
          <article><span>Aciertos de ganador</span><strong>{participantSummary.resultHits}</strong></article>
          <article><span>Aciertos de clasificados</span><strong>{participantSummary.qualifiedTeamHits}</strong></article>
          <article><span>Llaves acertadas</span><strong>{participantSummary.bracketHits}</strong></article>
        </div>
        {predictionsClosed && (
          <div className="notice">
            Pronósticos cerrados. Ya no puedes modificar marcadores ni resultados finales.
          </div>
        )}

        <div className="final-picks-strip">
          <span>🏆 {displayTeam(finalPrediction.champion) || 'Campeón por definir'}</span>
          <span>🥈 {displayTeam(finalPrediction.second) || 'Subcampeón por definir'}</span>
          <span>🥉 {displayTeam(finalPrediction.third) || 'Tercer lugar por definir'}</span>
          <span>4 {displayTeam(finalPrediction.fourth) || 'Cuarto lugar por definir'}</span>
        </div>

        <div className="filter-bar">
          <label>
            Fase
            <select onChange={(event) => setPhaseFilter(event.target.value)} value={phaseFilter}>
              {phases.map((phase) => <option key={phase} value={phase}>{phase === 'Semifinal' ? 'Semifinales' : phase}</option>)}
            </select>
          </label>
          {phaseFilter === 'Fase de grupos' && (
            <label>
              Grupo
              <select onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}>
                {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
          )}
        </div>

        {phaseFilter === 'Fase de grupos' && groupFilter === 'Todos los grupos' ? (
          <div className="accordion-list">
            {groupedMatches.map((group, index) => (
              <details className="accordion-panel" key={group.groupLabel} open={index < 2}>
                <summary>{group.groupLabel} <span>{group.matches.length} partidos</span></summary>
                <div className="prediction-grid compact-grid">
                  {group.matches.map(renderMatchCard)}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="prediction-grid compact-grid">
            {visibleGroupMatches.map(renderMatchCard)}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Resultados finales del torneo</h3>
            <p className="muted">Campeón, segundo, tercero y cuarto lugar suman puntos especiales.</p>
          </div>
        </div>
        <div className="form-grid four-columns">
          {finalFields.map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                disabled={predictionsClosed || !participantId}
                onChange={(event) => updateFinalPrediction(field, event.target.value)}
                placeholder={label}
                value={displayTeam(finalPredictions[participantId]?.[field] ?? '')}
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PredictionPanel;
