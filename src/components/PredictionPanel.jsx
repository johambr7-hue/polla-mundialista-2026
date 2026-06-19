import { useMemo, useState } from 'react';
import { Lock, Save } from 'lucide-react';
import { Avatar, SportBadge } from './ui';
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
const normalizeSearch = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const teamFlags = {
  mexico: '🇲🇽',
  'corea del sur': '🇰🇷',
  'republica checa': '🇨🇿',
  sudafrica: '🇿🇦',
  canada: '🇨🇦',
  suiza: '🇨🇭',
  catar: '🇶🇦',
  'bosnia y herzegovina': '🇧🇦',
  brasil: '🇧🇷',
  marruecos: '🇲🇦',
  haiti: '🇭🇹',
  escocia: '🏴',
  'estados unidos': '🇺🇸',
  paraguay: '🇵🇾',
  australia: '🇦🇺',
  turquia: '🇹🇷',
  alemania: '🇩🇪',
  curazao: '🇨🇼',
  'costa de marfil': '🇨🇮',
  ecuador: '🇪🇨',
  'paises bajos': '🇳🇱',
  japon: '🇯🇵',
  suecia: '🇸🇪',
  tunez: '🇹🇳',
  belgica: '🇧🇪',
  egipto: '🇪🇬',
  iran: '🇮🇷',
  'nueva zelanda': '🇳🇿',
  espana: '🇪🇸',
  'cabo verde': '🇨🇻',
  'arabia saudita': '🇸🇦',
  uruguay: '🇺🇾',
  francia: '🇫🇷',
  senegal: '🇸🇳',
  noruega: '🇳🇴',
  irak: '🇮🇶',
  argentina: '🇦🇷',
  argelia: '🇩🇿',
  austria: '🇦🇹',
  jordania: '🇯🇴',
  colombia: '🇨🇴',
  portugal: '🇵🇹',
  'rd congo': '🇨🇩',
  uzbekistan: '🇺🇿',
  inglaterra: '🏴',
  croacia: '🇭🇷',
  ghana: '🇬🇭',
  panama: '🇵🇦'
};

const getTeamFlag = (team) => teamFlags[normalizeSearch(displayTeam(team) || team)] ?? '⚽';
const formatScoreValue = (value) => (value === '' || value === undefined || value === null ? '-' : value);

function PredictionPanel({
  currentParticipantId,
  finalPredictions,
  isAdmin,
  matches,
  participants,
  predictions,
  ranking,
  settings,
  updateFinalPredictions,
  updatePredictions
}) {
  const [selectedParticipantId, setSelectedParticipantId] = useState(currentParticipantId);
  const [phaseFilter, setPhaseFilter] = useState('Fase de grupos');
  const [groupFilter, setGroupFilter] = useState('Todos los grupos');
  const [teamSearch, setTeamSearch] = useState('');
  const participantId = isAdmin ? selectedParticipantId : currentParticipantId;
  const predictionsClosed = Boolean(settings.predictionsLocked) && !isAdmin;
  const adminCanEditPlayedMatches = isAdmin && !settings.predictionsLocked;
  const participant = participants.find((item) => item.id === participantId);
  const participantStanding = ranking?.find((item) => item.id === participantId);
  const leaderPoints = ranking?.[0]?.totalPoints ?? 0;
  const leaderGap = participantStanding ? Math.max(leaderPoints - participantStanding.totalPoints, 0) : 0;
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
    const isScorable = isMatchScorable(match);
    const knockout = !isGroupStage(match.stage);
    const predictedTeams = {
      home: prediction?.predictedHomeTeam || match.homeTeam,
      away: prediction?.predictedAwayTeam || match.awayTeam
    };
    const predictedDraw = knockout && isPredictionDraw(prediction);
    const predictedQualifiedTeam = knockout ? getPredictedQualifiedTeam(prediction, match) : '';
    const needsPenaltyWinner = predictedDraw && !prediction?.penaltyWinner;
    const stateClass = !isScorable ? 'pending' : points > 0 ? 'hit' : 'miss';
    const stateLabel = !isScorable ? '🟡 Pendiente' : points > 0 ? '🟢 Acertado' : '🔴 Fallado';
    const predictionScore = `${formatScoreValue(prediction?.homeScore)} - ${formatScoreValue(prediction?.awayScore)}`;
    const realScore = `${formatScoreValue(match.realHomeScore)} - ${formatScoreValue(match.realAwayScore)}`;

    return (
      <article className={`match-card compact-card sports-match-card ${stateClass}`} key={match.id}>
        <div className="match-meta">
          <span>#{match.matchNumber} · {match.stage === 'Fase de grupos' ? getMatchGroupLabel(match) : match.stage}</span>
          <span className={`status ${match.status}`}>{match.status}</span>
        </div>

        <div className="sports-match-board">
          <div className="team-block home">
            <span>{getTeamFlag(knockout ? predictedTeams.home : match.homeTeam)}</span>
            <strong>{displayTeam(knockout ? predictedTeams.home : match.homeTeam)}</strong>
          </div>
          <span className="vs-chip">VS</span>
          <div className="team-block away">
            <span>{getTeamFlag(knockout ? predictedTeams.away : match.awayTeam)}</span>
            <strong>{displayTeam(knockout ? predictedTeams.away : match.awayTeam)}</strong>
          </div>
        </div>

        <div className="match-insight-row">
          <span>Pronóstico <strong>{predictionScore}</strong></span>
          <span>Real <strong>{realScore}</strong></span>
          <span className={`prediction-state ${stateClass}`}>{stateLabel}</span>
          <span className="points-chip">{points} pts</span>
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

  const teamSearchQuery = normalizeSearch(teamSearch);
  const matchIncludesTeam = (match) => {
    if (!teamSearchQuery) return true;
    const prediction = predictions.find((item) => item.matchId === match.id && item.participantId === participantId);
    const text = [
      match.homeTeam,
      match.awayTeam,
      prediction?.predictedHomeTeam,
      prediction?.predictedAwayTeam,
      prediction?.qualifiedTeam,
      prediction?.penaltyWinner
    ]
      .map((value) => normalizeSearch(displayTeam(value) || value))
      .join(' ');
    return text.includes(teamSearchQuery);
  };
  const phaseMatches = sortedMatches.filter((match) => match.stage === phaseFilter && matchIncludesTeam(match));
  const visibleGroupMatches = phaseMatches.filter((match) => groupFilter === 'Todos los grupos' || getMatchGroupLabel(match) === groupFilter);
  const groupedMatches = groupOptions.slice(1).map((groupLabel) => ({
    groupLabel,
    matches: phaseMatches.filter((match) => getMatchGroupLabel(match) === groupLabel)
  })).filter((group) => group.matches.length);
  const showingTeamResults = Boolean(teamSearchQuery);

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

        <div className="participant-hero">
          <Avatar name={participant?.name} size="lg" />
          <div>
            <strong>{participant?.name ?? 'Participante'}</strong>
            <span>#{participantStanding?.position ?? '-'} del torneo</span>
          </div>
          <div className="participant-hero-stats">
            <SportBadge tone="blue">{participantSummary.points} puntos</SportBadge>
            <SportBadge tone={leaderGap <= 20 ? 'gold' : 'neutral'}>🔥 A {leaderGap} puntos del líder</SportBadge>
            <SportBadge tone="green">🎯 {participantSummary.exactScores} exactos</SportBadge>
            <SportBadge tone="neutral">{participantSummary.resultHits} partidos acertados</SportBadge>
          </div>
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
            Buscar selección
            <input
              onChange={(event) => setTeamSearch(event.target.value)}
              placeholder="Ej: Colombia, Brasil, Francia"
              value={teamSearch}
            />
          </label>
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

        {showingTeamResults && (
          <p className="muted">
            {visibleGroupMatches.length} partidos encontrados para “{teamSearch}”.
          </p>
        )}

        {phaseFilter === 'Fase de grupos' && groupFilter === 'Todos los grupos' && !showingTeamResults ? (
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
        {!visibleGroupMatches.length && <p className="muted">No hay predicciones para esa selección con los filtros actuales.</p>}
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
