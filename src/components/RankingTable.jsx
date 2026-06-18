import { formatCop } from '../utils/formatters';

function RankingTable({ collection, prizes, ranking }) {
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Posicion</th>
                <th>Participante</th>
                <th>Puntos totales</th>
                <th>Puntos fase de grupos</th>
                <th>Puntos fases eliminatorias</th>
                <th>Puntos resultados finales</th>
                <th>Marcadores exactos</th>
                <th>Llaves acertadas</th>
                <th>Equipos clasificados acertados</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((participant) => (
                <tr key={participant.id}>
                  <td>{participant.position}</td>
                  <td><strong>{participant.name}</strong></td>
                  <td>{participant.totalPoints}</td>
                  <td>{participant.groupPoints}</td>
                  <td>{participant.knockoutPoints}</td>
                  <td>{participant.finalPoints}</td>
                  <td>{participant.exactScores}</td>
                  <td>{participant.bracketHits}</td>
                  <td>{participant.qualifiedTeamHits}</td>
                </tr>
              ))}
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
