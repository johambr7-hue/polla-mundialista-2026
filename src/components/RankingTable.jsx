import { Fragment, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { formatCop } from '../utils/formatters';
import { displayTeam } from '../utils/localization';
import { getExactScoreDetails } from '../utils/exactScoreDetails';
import { PointsBar } from './ui';

const podiumConfig = [
  { medal: '🥇', label: 'Primer lugar', className: 'gold' },
  { medal: '🥈', label: 'Segundo lugar', className: 'silver' },
  { medal: '🥉', label: 'Tercer lugar', className: 'bronze' }
];

const finalPickConfig = [
  { icon: '🏆', key: 'champion', label: 'Campeón', pointsKey: 'champion' },
  { icon: '🥈', key: 'second', label: 'Subcampeón', pointsKey: 'second' },
  { icon: '🥉', key: 'third', label: 'Tercer lugar', pointsKey: 'third' },
  { icon: '4', key: 'fourth', label: 'Cuarto lugar', pointsKey: 'fourth' }
];

const getTrend = (participant) => {
  if (!participant.previousPosition) return '➡️';
  if (participant.previousPosition > participant.position) return '⬆️';
  if (participant.previousPosition < participant.position) return '⬇️';
  return '➡️';
};

const getRankingMeta = (participant, index, leaderPoints) => {
  const podiumItem = podiumConfig[index];
  const difference = participant.totalPoints - leaderPoints;
  const isLeader = participant.position === 1;
  const inTheFight = !isLeader && leaderPoints - participant.totalPoints > 0 && leaderPoints - participant.totalPoints < 20;

  return { podiumItem, difference, isLeader, inTheFight };
};

const getDifferenceClass = (difference) => {
  const gap = Math.abs(difference);
  if (difference === 0) return 'leader';
  if (gap <= 10) return 'near';
  if (gap <= 20) return 'fight';
  return 'far';
};

const formatScore = (score) => String(score || '-').replace('-', ' - ');

const normalizeTeamName = (value) =>
  String(displayTeam(value) || value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const isPlaceholderTeam = (team) => {
  const normalized = normalizeTeamName(team);
  return (
    !normalized ||
    normalized === 'por definir' ||
    normalized === 'a definir' ||
    normalized.includes('ganador grupo') ||
    normalized.includes('segundo grupo') ||
    normalized.includes('mejor tercero') ||
    normalized.includes('winner group') ||
    normalized.includes('runner-up') ||
    normalized.includes('best 3rd')
  );
};

const isKnockoutMatch = (match) => match?.stage && match.stage !== 'Fase de grupos';

const addLiveTeam = (teams, team) => {
  if (isPlaceholderTeam(team)) return;
  teams.set(normalizeTeamName(team), displayTeam(team) || team);
};

const mergeTeamMaps = (...maps) => {
  const teams = new Map();
  maps.forEach((map) => {
    map.forEach((name, normalizedName) => teams.set(normalizedName, name));
  });
  return teams;
};

const getMatchStage = (match) => match?.stage ?? match?.phase ?? '';

const getMatchTeams = (match) => [
  match?.homeTeam ?? match?.home_team ?? '',
  match?.awayTeam ?? match?.away_team ?? ''
];

const collectTeamsFromMatches = (matches, stages = [], pendingOnly = true) => {
  const teams = new Map();

  matches
    .filter((match) => isKnockoutMatch(match))
    .filter((match) => !stages.length || stages.includes(getMatchStage(match)))
    .filter((match) => !pendingOnly || match.status !== 'jugado')
    .forEach((match) => {
      getMatchTeams(match).forEach((team) => addLiveTeam(teams, team));
    });

  return teams;
};

const collectTeamsFromFinalPredictions = (finalPredictions) => {
  const teams = new Map();

  Object.values(finalPredictions ?? {}).forEach((prediction) => {
    finalPickConfig.forEach(({ key }) => addLiveTeam(teams, getFinalPredictionValue(prediction, key)));
  });

  return teams;
};

const collectLiveTeams = (matches, finalPredictions) => {
  const teams = collectTeamsFromMatches(matches);

  if (!teams.size) {
    return collectTeamsFromFinalPredictions(finalPredictions);
  }

  return teams;
};

const getFinalPredictionValue = (prediction, key) => {
  if (key === 'second') return prediction?.second ?? prediction?.runnerUp ?? prediction?.runner_up ?? '';
  if (key === 'third') return prediction?.third ?? prediction?.thirdPlace ?? prediction?.third_place ?? '';
  if (key === 'fourth') return prediction?.fourth ?? prediction?.fourthPlace ?? prediction?.fourth_place ?? '';
  return prediction?.[key] ?? '';
};

const finalResultsAreComplete = (finalResults = {}) =>
  finalPickConfig.every(({ key }) => Boolean(getFinalPredictionValue(finalResults, key)));

const buildFinalPickPools = ({ finalPredictions, finalResults = {}, matches = [] }) => {
  const fallbackTeams = collectLiveTeams(matches, finalPredictions);
  const finalTeams = collectTeamsFromMatches(matches, ['Final']);
  const thirdPlaceTeams = collectTeamsFromMatches(matches, ['Tercer puesto']);
  const semifinalTeams = collectTeamsFromMatches(matches, ['Semifinal', 'Semifinales']);
  const lateKnockoutTeams = mergeTeamMaps(finalTeams, thirdPlaceTeams, semifinalTeams);
  const predictionTeams = collectTeamsFromFinalPredictions(finalPredictions);

  const pools = finalPickConfig.reduce((accumulator, { key }) => {
    const officialTeam = getFinalPredictionValue(finalResults, key);
    const pool = new Map();

    if (officialTeam) {
      addLiveTeam(pool, officialTeam);
    } else if (key === 'champion' || key === 'second') {
      const sourceTeams = finalTeams.size ? finalTeams : lateKnockoutTeams.size ? lateKnockoutTeams : fallbackTeams;
      sourceTeams.forEach((team, normalizedTeam) =>
        pool.set(normalizedTeam, team)
      );
    } else {
      const sourceTeams = thirdPlaceTeams.size ? thirdPlaceTeams : semifinalTeams.size ? semifinalTeams : fallbackTeams;
      sourceTeams.forEach((team, normalizedTeam) =>
        pool.set(normalizedTeam, team)
      );
    }

    if (!pool.size) {
      predictionTeams.forEach((team, normalizedTeam) => pool.set(normalizedTeam, team));
    }

    return { ...accumulator, [key]: pool };
  }, {});

  return pools;
};

const getContenderStatus = ({ canReachLeader, championAlive, livePicks, position }) => {
  if (position === 1) return 'Favorito actual';
  if (!livePicks.length) return 'Sin picks vivos';
  if (canReachLeader && championAlive) return 'Aspirante fuerte';
  if (canReachLeader) return 'Sigue con vida';
  return 'Necesita milagro';
};

const buildTitleContenders = ({ finalPredictions = {}, finalResults = {}, matches = [], ranking = [], settings = {} }) => {
  const leaderPoints = ranking[0]?.totalPoints ?? 0;
  const pickPools = buildFinalPickPools({ finalPredictions, finalResults, matches });
  const finalPoints = settings.finalResultsPoints ?? {};
  const resultsComplete = finalResultsAreComplete(finalResults);

  const contenders = ranking.map((participant) => {
    const prediction = finalPredictions[participant.id] ?? {};
    const picks = finalPickConfig.map((config) => {
      const team = getFinalPredictionValue(prediction, config.key);
      const normalizedTeam = normalizeTeamName(team);
      const officialTeam = getFinalPredictionValue(finalResults, config.key);
      const officialTeamNormalized = normalizeTeamName(officialTeam);
      const officialResultSet = Boolean(officialTeam);
      const matchesOfficialResult = officialResultSet && normalizedTeam === officialTeamNormalized;
      const isStillPossible = Boolean(team) && (officialResultSet ? matchesOfficialResult : pickPools[config.key]?.has(normalizedTeam));
      const points = Number(finalPoints[config.pointsKey] ?? 0);
      const pointsInPlay = resultsComplete ? 0 : isStillPossible ? points : 0;

      return {
        ...config,
        isLive: isStillPossible && !resultsComplete,
        isSecured: matchesOfficialResult && !resultsComplete,
        pointsInPlay,
        points,
        team
      };
    });
    const livePicks = picks.filter((pick) => pick.isLive);
    const possibleFinalPoints = picks.reduce((sum, pick) => sum + pick.pointsInPlay, 0);
    const maximumPossible = participant.totalPoints + possibleFinalPoints;
    const gapToLeader = Math.max(leaderPoints - participant.totalPoints, 0);
    const canReachLeader = maximumPossible >= leaderPoints;
    const championAlive = livePicks.some((pick) => pick.key === 'champion');

    return {
      ...participant,
      canReachLeader,
      championAlive,
      gapToLeader,
      livePicks,
      maximumPossible,
      picks,
      possibleFinalPoints,
      status: getContenderStatus({ canReachLeader, championAlive, livePicks, position: participant.position })
    };
  });

  const bestMaximum = Math.max(...contenders.map((contender) => contender.maximumPossible), leaderPoints, 1);
  const contendersWithWeight = contenders.map((contender) => {
    const reachBonus = Math.max(contender.maximumPossible - leaderPoints, 0);
    const maxPenalty = Math.max(bestMaximum - contender.maximumPossible, 0) * 0.25;
    const currentStrength = Math.max(contender.totalPoints, 0) * 0.12;
    const finalStrength = contender.possibleFinalPoints * 1.25;
    const championBonus = contender.championAlive ? 55 : 0;
    const livePickBonus = contender.livePicks.length * 8;
    const leaderBonus = contender.position === 1 ? 35 : 0;
    const catchUpPenalty = contender.gapToLeader * 0.35;
    const probabilityWeight = resultsComplete
      ? Math.max(1, contender.totalPoints - leaderPoints + 100)
      : contender.canReachLeader
        ? Math.max(1, currentStrength + finalStrength + reachBonus + championBonus + livePickBonus + leaderBonus - catchUpPenalty - maxPenalty)
        : Math.max(0.1, contender.livePicks.length * 0.35 + contender.possibleFinalPoints * 0.03);

    return { ...contender, probabilityWeight };
  });

  const totalWeight = contendersWithWeight.reduce((sum, contender) => sum + contender.probabilityWeight, 0) || 1;

  return contendersWithWeight
    .map((contender) => ({
      ...contender,
      probability: Math.round((contender.probabilityWeight / totalWeight) * 100)
    }))
    .sort((a, b) => b.probability - a.probability || b.maximumPossible - a.maximumPossible || b.totalPoints - a.totalPoints);
};

const getKnockoutDetails = (participant, type) =>
  (participant?.pointsDetail ?? [])
    .map((phaseDetail) => ({
      phase: phaseDetail.fase,
      items: (phaseDetail.detail ?? []).filter((detail) => detail.tipo === type)
    }))
    .filter((phaseDetail) => phaseDetail.items.length);

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

function KnockoutHitList({ participant, type }) {
  const phaseDetails = getKnockoutDetails(participant, type);
  const isBracket = type === 'llave';

  return (
    <div className="knockout-hit-list">
      <div className="knockout-hit-header">
        <strong>{isBracket ? 'Llaves acertadas' : 'Equipos clasificados acertados'}</strong>
        <span>{participant.name}</span>
      </div>
      {phaseDetails.length ? (
        phaseDetails.map((phaseDetail) => (
          <section className="knockout-hit-phase" key={phaseDetail.phase}>
            <h4>{phaseDetail.phase}</h4>
            <div>
              {phaseDetail.items.map((detail, index) => (
                <article key={`${phaseDetail.phase}-${type}-${index}`}>
                  <strong>
                    {isBracket
                      ? (detail.equipos ?? []).map((team) => displayTeam(team)).join(' vs ')
                      : displayTeam(detail.equipo)}
                  </strong>
                  <em>{detail.puntos} pts</em>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="muted">
          {isBracket ? 'Todavía no tiene llaves acertadas.' : 'Todavía no tiene equipos clasificados acertados.'}
        </p>
      )}
    </div>
  );
}

const getPhaseTotal = (phaseDetail) =>
  Number(phaseDetail?.puntos_total_fase ?? phaseDetail?.points ?? 0);

function PodiumPointDetail({ participant }) {
  const phaseDetails = participant.pointsDetail ?? [];
  const finalDetail = phaseDetails.find((phaseDetail) => phaseDetail.fase === 'Resultados finales');
  const finalItems = finalDetail?.detail ?? [];

  return (
    <section className="podium-detail-panel">
      <div className="podium-detail-heading">
        <div>
          <span>Detalle de puntos</span>
          <strong>{participant.name}</strong>
        </div>
        <p>{participant.totalPoints} pts totales</p>
      </div>

      <div className="podium-detail-summary">
        <article>
          <strong>{participant.groupPoints}</strong>
          <span>Fase de grupos</span>
        </article>
        <article>
          <strong>{participant.knockoutPoints}</strong>
          <span>Eliminatorias</span>
        </article>
        <article>
          <strong>{participant.finalPoints}</strong>
          <span>Resultados finales</span>
        </article>
        <article>
          <strong>{participant.exactScores}</strong>
          <span>Marcadores exactos</span>
        </article>
        <article>
          <strong>{participant.bracketHits}</strong>
          <span>Llaves acertadas</span>
        </article>
        <article>
          <strong>{participant.qualifiedTeamHits}</strong>
          <span>Equipos clasificados</span>
        </article>
      </div>

      <div className="podium-detail-columns">
        <div>
          <h4>Puntos por fase</h4>
          <div className="podium-phase-list">
            {phaseDetails.length ? (
              phaseDetails.map((phaseDetail) => (
                <article key={phaseDetail.fase}>
                  <strong>{phaseDetail.fase}</strong>
                  <span>{getPhaseTotal(phaseDetail)} pts</span>
                </article>
              ))
            ) : (
              <p className="muted">Aún no hay detalle de fases.</p>
            )}
          </div>
        </div>

        <div>
          <h4>Resultados finales acertados</h4>
          <div className="podium-final-list">
            {finalItems.length ? (
              finalItems.map((detail) => (
                <article key={`${participant.id}-${detail.puesto}`}>
                  <span>{detail.puesto}</span>
                  <strong>{displayTeam(detail.equipo) || 'Por definir'}</strong>
                  <em>+{detail.puntos} pts</em>
                </article>
              ))
            ) : (
              <p className="muted">No tiene puntos por resultados finales.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RankingTable({ collection, finalPredictions = {}, finalResults = {}, matches = [], onViewCharts, prizes, ranking, settings = {} }) {
  const [openExactParticipantId, setOpenExactParticipantId] = useState('');
  const [openKnockoutDetail, setOpenKnockoutDetail] = useState({ participantId: '', type: '' });
  const [openPodiumParticipantId, setOpenPodiumParticipantId] = useState('');
  const leaderPoints = ranking[0]?.totalPoints ?? 0;
  const podium = ranking.slice(0, 3);
  const selectedPodiumParticipant = podium.find((participant) => participant.id === openPodiumParticipantId);
  const maxPoints = Math.max(...ranking.map((participant) => participant.totalPoints), 1);
  const maxExactScores = Math.max(...ranking.map((participant) => participant.exactScores), 0);
  const mostExact = ranking.find((participant) => participant.exactScores === maxExactScores && participant.exactScores > 0);
  const featuredParticipant = mostExact ?? ranking[0];
  const titleContenders = buildTitleContenders({ finalPredictions, finalResults, matches, ranking, settings });
  const championProbability = titleContenders.slice(0, 4);
  const otherProbability = Math.max(
    0,
    100 - championProbability.reduce((sum, participant) => sum + participant.probability, 0)
  );
  const visibleContenders = titleContenders
    .filter((participant) => participant.canReachLeader || participant.livePicks.length || participant.position <= 3)
    .slice(0, 6);

  return (
    <section className="stack-list">
      <div className="summary-grid">
        <article>
          <span>Inscripcion</span>
          <strong>{formatCop(collection.expectedTotal / Math.max(ranking.length, 1))}</strong>
        </article>
        <article>
          <span>Pagaron</span>
          <strong>{collection.paidCount} / {ranking.length}</strong>
        </article>
        <article>
          <span>Recaudo actual</span>
          <strong>{formatCop(collection.collectedTotal)}</strong>
        </article>
        <article>
          <span>Premios</span>
          <strong>{prizes.mode}</strong>
        </article>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Tabla de posiciones</h3>
            <p className="muted">Incluye fase de grupos, eliminatorias y resultados finales del torneo.</p>
          </div>
          {onViewCharts && (
            <button className="secondary-button" onClick={onViewCharts} type="button">
              <BarChart3 size={18} />
              Ver gráficas
            </button>
          )}
        </div>

        <div className="podium-section">
          <div className="podium-title">🏆 Podio actual</div>
          <div className="podium-grid">
            {podiumConfig.map((config, index) => {
              const participant = podium[index];
              return (
                <button
                  aria-expanded={openPodiumParticipantId === participant?.id}
                  className={`podium-card podium-card-button ${config.className}`}
                  disabled={!participant}
                  key={participant?.id ?? config.label}
                  onClick={() =>
                    setOpenPodiumParticipantId((current) => (current === participant?.id ? '' : participant?.id ?? ''))
                  }
                  type="button"
                >
                  <span>{config.medal} {config.label}</span>
                  <strong>{participant?.name ?? 'Por definir'}</strong>
                  <p>{participant ? `${participant.totalPoints} pts` : 'Sin datos'}</p>
                  {participant && <small>Ver detalle</small>}
                </button>
              );
            })}
          </div>
          {selectedPodiumParticipant && <PodiumPointDetail participant={selectedPodiumParticipant} />}
        </div>

        <div className="ranking-spotlight-grid">
          <article className="spotlight-card">
            <span>⭐ Participante destacado</span>
            <strong>{featuredParticipant?.name ?? 'Sin datos'}</strong>
            <p>
              {featuredParticipant
                ? `${featuredParticipant.exactScores} marcadores exactos y ${featuredParticipant.totalPoints} puntos`
                : 'Aún no hay datos suficientes'}
            </p>
          </article>
          <article className="spotlight-card champion-odds title-race-card">
            <span>🏆 Carrera por la polla</span>
            <strong>{championProbability[0]?.name ?? 'Sin datos'}</strong>
            <p>Estimación con resultados oficiales cargados, puntos actuales y máximo posible.</p>
            <div>
              {championProbability.map((participant) => (
                <div className="odds-row" key={participant.id}>
                  <strong>{participant.name}</strong>
                  <PointsBar color="#F4C542" max={100} value={participant.probability} />
                  <em>{participant.probability}%</em>
                </div>
              ))}
              <div className="odds-row">
                <strong>Otros</strong>
                <PointsBar color="#C0C6D4" max={100} value={otherProbability} />
                <em>{otherProbability}%</em>
              </div>
            </div>
          </article>
        </div>

        {visibleContenders.length > 0 && (
          <section className="title-contenders-panel">
            <div className="title-contenders-heading">
              <div>
                <span>🔥 Aspirantes al título</span>
                <h4>Quiénes todavía pueden ganar la polla</h4>
              </div>
              <p>
                Se calcula con los puntos actuales, resultados finales ya cargados y posiciones que todavía siguen vivas.
              </p>
            </div>
            <div className="title-contenders-grid">
              {visibleContenders.map((participant) => (
                <article
                  className={`title-contender-card ${participant.canReachLeader ? 'alive' : 'remote'}`}
                  key={participant.id}
                >
                  <div className="title-contender-top">
                    <strong>{participant.name}</strong>
                    <span>{participant.status}</span>
                  </div>
                  <div className="title-contender-metrics">
                    <span><strong>{participant.totalPoints}</strong> actuales</span>
                    <span><strong>{participant.maximumPossible}</strong> máximo</span>
                    <span><strong>{participant.probability}%</strong> opción</span>
                  </div>
                  <div className="live-picks-list">
                    {participant.livePicks.length ? (
                      participant.livePicks.map((pick) => (
                        <span key={`${participant.id}-${pick.key}`}>
                          {pick.icon} {pick.label}: {displayTeam(pick.team)}
                          <strong>+{pick.points}</strong>
                        </span>
                      ))
                    ) : (
                      <em>Sin posiciones finales vivas</em>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="table-wrap ranking-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>Posición</th>
                <th>Participante</th>
                <th>Tendencia</th>
                <th>Puntos totales</th>
                <th>Diferencia</th>
                <th>Puntos fase de grupos</th>
                <th>Marcadores exactos</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((participant, index) => {
                const { podiumItem, difference, isLeader, inTheFight } = getRankingMeta(participant, index, leaderPoints);
                const trend = getTrend(participant);
                const exactLeader = maxExactScores > 0 && participant.exactScores === maxExactScores;
                const exactDetails = getExactScoreDetails(participant);
                const exactExpanded = openExactParticipantId === participant.id;
                const knockoutExpanded = openKnockoutDetail.participantId === participant.id;

                return (
                  <Fragment key={participant.id}>
                    <tr className={podiumItem ? `podium-row ${podiumItem.className}` : ''}>
                      <td className="position-cell">
                        {podiumItem ? <span className="position-medal">{podiumItem.medal}</span> : participant.position}
                      </td>
                      <td>
                        <div className="ranking-name">
                          <strong>{participant.name}</strong>
                          {isLeader && <span className="rank-badge leader-badge">👑 Líder</span>}
                          {inTheFight && <span className="rank-badge fight-badge">🔥 En la pelea</span>}
                          {exactLeader && <span className="rank-badge exact-badge">🎯 Más exactos</span>}
                          {trend === '⬆️' && <span className="rank-badge up-badge">📈 Remontando</span>}
                          {trend === '⬇️' && <span className="rank-badge down-badge">📉 En descenso</span>}
                        </div>
                      </td>
                      <td className="trend-cell">{trend}</td>
                      <td>
                        <div className="rank-points-cell">
                          <strong>{participant.totalPoints}</strong>
                          <PointsBar color="#2563eb" max={maxPoints} value={participant.totalPoints} />
                        </div>
                      </td>
                      <td className={`difference-cell ${getDifferenceClass(difference)}`}>{difference}</td>
                      <td>{participant.groupPoints}</td>
                      <td>
                        <button
                          aria-expanded={exactExpanded}
                          className="count-button exact-count-button"
                          onClick={() => setOpenExactParticipantId((current) => (current === participant.id ? '' : participant.id))}
                          title={`Ver marcadores exactos de ${participant.name}`}
                          type="button"
                        >
                          {participant.exactScores}
                        </button>
                      </td>
                      <td>
                        <div className="ranking-detail-grid">
                          <span><strong>{participant.knockoutPoints}</strong> pts eliminatorias</span>
                          <span><strong>{participant.finalPoints}</strong> pts finales</span>
                          <button
                            aria-expanded={knockoutExpanded && openKnockoutDetail.type === 'llave'}
                            className="ranking-detail-button"
                            onClick={() =>
                              setOpenKnockoutDetail((current) =>
                                current.participantId === participant.id && current.type === 'llave'
                                  ? { participantId: '', type: '' }
                                  : { participantId: participant.id, type: 'llave' }
                              )
                            }
                            title={`Ver llaves acertadas de ${participant.name}`}
                            type="button"
                          >
                            <strong>{participant.bracketHits}</strong> llaves acertadas
                          </button>
                          <button
                            aria-expanded={knockoutExpanded && openKnockoutDetail.type === 'clasificado'}
                            className="ranking-detail-button"
                            onClick={() =>
                              setOpenKnockoutDetail((current) =>
                                current.participantId === participant.id && current.type === 'clasificado'
                                  ? { participantId: '', type: '' }
                                  : { participantId: participant.id, type: 'clasificado' }
                              )
                            }
                            title={`Ver clasificados acertados de ${participant.name}`}
                            type="button"
                          >
                            <strong>{participant.qualifiedTeamHits}</strong> equipos clasificados
                          </button>
                        </div>
                      </td>
                    </tr>
                    {exactExpanded && (
                      <tr className="ranking-expanded-row">
                        <td colSpan="8">
                          <ExactHitList details={exactDetails} />
                        </td>
                      </tr>
                    )}
                    {knockoutExpanded && (
                      <tr className="ranking-expanded-row">
                        <td colSpan="8">
                          <KnockoutHitList participant={participant} type={openKnockoutDetail.type} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="ranking-mobile-list">
          {ranking.map((participant, index) => {
            const { podiumItem, difference, isLeader, inTheFight } = getRankingMeta(participant, index, leaderPoints);
            const trend = getTrend(participant);
            const exactLeader = maxExactScores > 0 && participant.exactScores === maxExactScores;
            const exactDetails = getExactScoreDetails(participant);
            const exactExpanded = openExactParticipantId === participant.id;
            const knockoutExpanded = openKnockoutDetail.participantId === participant.id;

            return (
              <article className={podiumItem ? `ranking-mobile-card ${podiumItem.className}` : 'ranking-mobile-card'} key={participant.id}>
                <div className="mobile-rank-header">
                  <span className="mobile-rank-position">
                    {podiumItem ? podiumItem.medal : participant.position}
                  </span>
                  <div className="mobile-rank-name">
                    <strong>{participant.name}</strong>
                    <div className="mobile-rank-badges">
                      {isLeader && <span className="rank-badge leader-badge">👑 Líder</span>}
                      {inTheFight && <span className="rank-badge fight-badge">🔥 En la pelea</span>}
                      {exactLeader && <span className="rank-badge exact-badge">🎯 Más exactos</span>}
                      {trend === '⬆️' && <span className="rank-badge up-badge">📈 Remontando</span>}
                      {trend === '⬇️' && <span className="rank-badge down-badge">📉 En descenso</span>}
                    </div>
                  </div>
                </div>

                <div className="mobile-rank-stats">
                  <article>
                    <span>Puntos</span>
                    <strong>{participant.totalPoints}</strong>
                  </article>
                  <article>
                    <span>Diferencia</span>
                    <strong className={getDifferenceClass(difference)}>{difference}</strong>
                  </article>
                  <button
                    aria-expanded={exactExpanded}
                    className="mobile-rank-stat mobile-exacts-button"
                    onClick={() => setOpenExactParticipantId((current) => (current === participant.id ? '' : participant.id))}
                    title={`Ver marcadores exactos de ${participant.name}`}
                    type="button"
                  >
                    <span>Exactos</span>
                    <strong>{participant.exactScores}</strong>
                  </button>
                </div>

                {exactExpanded && (
                  <div className="mobile-exact-details">
                    <ExactHitList details={exactDetails} />
                  </div>
                )}

                <details className="mobile-rank-details">
                  <summary>Ver detalles</summary>
                  <div className="mobile-detail-grid">
                    <span><strong>{trend}</strong> Tendencia</span>
                    <span><strong>{participant.groupPoints}</strong> Fase grupos</span>
                    <span><strong>{participant.knockoutPoints}</strong> Eliminatorias</span>
                    <span><strong>{participant.finalPoints}</strong> Resultados finales</span>
                    <button
                      aria-expanded={knockoutExpanded && openKnockoutDetail.type === 'llave'}
                      className="mobile-detail-action"
                      onClick={() =>
                        setOpenKnockoutDetail((current) =>
                          current.participantId === participant.id && current.type === 'llave'
                            ? { participantId: '', type: '' }
                            : { participantId: participant.id, type: 'llave' }
                        )
                      }
                      type="button"
                    >
                      <strong>{participant.bracketHits}</strong> Llaves acertadas
                    </button>
                    <button
                      aria-expanded={knockoutExpanded && openKnockoutDetail.type === 'clasificado'}
                      className="mobile-detail-action"
                      onClick={() =>
                        setOpenKnockoutDetail((current) =>
                          current.participantId === participant.id && current.type === 'clasificado'
                            ? { participantId: '', type: '' }
                            : { participantId: participant.id, type: 'clasificado' }
                        )
                      }
                      type="button"
                    >
                      <strong>{participant.qualifiedTeamHits}</strong> Equipos clasificados
                    </button>
                  </div>
                  {knockoutExpanded && (
                    <KnockoutHitList participant={participant} type={openKnockoutDetail.type} />
                  )}
                </details>
              </article>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Premios calculados</h3>
        </div>
        <div className="prize-grid">
          <article>
            <span>Primer puesto</span>
            <strong>{prizes.firstPlace.map((item) => item.name).join(', ') || 'Sin datos'}</strong>
            <p>{formatCop(prizes.firstPrize)} por ganador</p>
          </article>
          <article>
            <span>Segundo puesto</span>
            <strong>{prizes.secondPlace.map((item) => item.name).join(', ') || 'No aplica'}</strong>
            <p>{formatCop(prizes.secondPrize)} por ganador</p>
          </article>
        </div>
      </div>
    </section>
  );
}

export default RankingTable;
