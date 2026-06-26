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

function RankingTable({ collection, matches = [], onViewCharts, prizes, ranking }) {
  const [openExactParticipantId, setOpenExactParticipantId] = useState('');
  const [openKnockoutDetail, setOpenKnockoutDetail] = useState({ participantId: '', type: '' });
  const leaderPoints = ranking[0]?.totalPoints ?? 0;
  const podium = ranking.slice(0, 3);
  const maxPoints = Math.max(...ranking.map((participant) => participant.totalPoints), 1);
  const maxExactScores = Math.max(...ranking.map((participant) => participant.exactScores), 0);
  const mostExact = ranking.find((participant) => participant.exactScores === maxExactScores && participant.exactScores > 0);
  const pendingMatches = matches.filter((match) => match.status !== 'jugado').length;
  const featuredParticipant = mostExact ?? ranking[0];
  const probabilityScores = ranking.map((participant) => {
    const gap = Math.max(leaderPoints - participant.totalPoints, 0);
    return {
      ...participant,
      probabilityWeight: Math.max(8, participant.totalPoints + pendingMatches * 1.4 - gap * 0.8 + participant.exactScores * 6)
    };
  });
  const totalProbabilityWeight = probabilityScores.reduce((sum, item) => sum + item.probabilityWeight, 0) || 1;
  const championProbability = probabilityScores.slice(0, 3).map((participant) => ({
    ...participant,
    probability: Math.round((participant.probabilityWeight / totalProbabilityWeight) * 100)
  }));
  const otherProbability = Math.max(
    0,
    100 - championProbability.reduce((sum, participant) => sum + participant.probability, 0)
  );

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
                <article className={`podium-card ${config.className}`} key={config.label}>
                  <span>{config.medal} {config.label}</span>
                  <strong>{participant?.name ?? 'Por definir'}</strong>
                  <p>{participant ? `${participant.totalPoints} pts` : 'Sin datos'}</p>
                </article>
              );
            })}
          </div>
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
          <article className="spotlight-card champion-odds">
            <span>🏆 Probabilidad de campeón</span>
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
                          <span><strong>{participant.knockoutPoints}</strong> elim.</span>
                          <span><strong>{participant.finalPoints}</strong> finales</span>
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
                            <strong>{participant.bracketHits}</strong> llaves
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
                            <strong>{participant.qualifiedTeamHits}</strong> clasif.
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
                  <div>
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
