import { formatCop } from '../utils/formatters';

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

function RankingTable({ collection, prizes, ranking }) {
  const leaderPoints = ranking[0]?.totalPoints ?? 0;
  const podium = ranking.slice(0, 3);

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

        <div className="table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>Posición</th>
                <th>Participante</th>
                <th>Tendencia</th>
                <th>Puntos totales</th>
                <th>Diferencia</th>
                <th>Puntos fase de grupos</th>
                <th>Puntos fases eliminatorias</th>
                <th>Puntos resultados finales</th>
                <th>Marcadores exactos</th>
                <th>Llaves acertadas</th>
                <th>Equipos clasificados acertados</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((participant, index) => {
                const podiumItem = podiumConfig[index];
                const difference = participant.totalPoints - leaderPoints;
                const isLeader = participant.position === 1;
                const inTheFight = !isLeader && leaderPoints - participant.totalPoints > 0 && leaderPoints - participant.totalPoints < 20;

                return (
                  <tr className={podiumItem ? `podium-row ${podiumItem.className}` : ''} key={participant.id}>
                    <td className="position-cell">
                      {podiumItem ? <span className="position-medal">{podiumItem.medal}</span> : participant.position}
                    </td>
                    <td>
                      <div className="ranking-name">
                        <strong>{participant.name}</strong>
                        {isLeader && <span className="rank-badge leader-badge">👑 Líder</span>}
                        {inTheFight && <span className="rank-badge fight-badge">🔥 En la pelea</span>}
                      </div>
                    </td>
                    <td className="trend-cell">{getTrend(participant)}</td>
                    <td>{participant.totalPoints}</td>
                    <td className={difference === 0 ? 'difference-cell leader' : 'difference-cell'}>{difference}</td>
                    <td>{participant.groupPoints}</td>
                    <td>{participant.knockoutPoints}</td>
                    <td>{participant.finalPoints}</td>
                    <td>{participant.exactScores}</td>
                    <td>{participant.bracketHits}</td>
                    <td>{participant.qualifiedTeamHits}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
