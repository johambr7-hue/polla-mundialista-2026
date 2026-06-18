import { formatCop } from '../utils/formatters';

const finalLabels = {
  champion: 'Campeón',
  second: 'Segundo lugar',
  third: 'Tercer lugar',
  fourth: 'Cuarto lugar'
};

function RulesPanel({ isAdmin, settings, updateSettings }) {
  const updatePhasePoints = (stage, field, value) => {
    updateSettings({
      ...settings,
      scoring: {
        ...settings.scoring,
        [stage]: {
          ...settings.scoring[stage],
          [field]: Number(value)
        }
      }
    });
  };

  const updateFinalPoints = (field, value) => {
    updateSettings({
      ...settings,
      finalResultsPoints: {
        ...settings.finalResultsPoints,
        [field]: Number(value)
      }
    });
  };

  return (
    <section className="stack-list">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Como funciona el sistema de puntos</h3>
            <p className="muted">Reglas oficiales de la polla mundialista.</p>
          </div>
        </div>
        <div className="rules-grid">
          <article>
            <span>Valor de inscripcion</span>
            <strong>{formatCop(settings.entryFee)}</strong>
            <p>El recaudo se calcula con los participantes marcados como pagados.</p>
          </article>
          <article>
            <span>Premios con ganador unico</span>
            <strong>{settings.firstPrizePercent}% / {settings.secondPrizePercent}%</strong>
            <p>Primer puesto recibe el porcentaje mayor y segundo puesto recibe el restante.</p>
          </article>
          <article>
            <span>Empate en primer puesto</span>
            <strong>100%</strong>
            <p>Si hay dos o mas ganadores empatados, no hay segundo premio.</p>
          </article>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Puntos por fase</h3>
            {isAdmin && <p className="muted">Los cambios se recalculan automáticamente en la tabla.</p>}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fase</th>
                <th>Ganador/empate</th>
                <th>Equipo clasificado</th>
                <th>Llave acertada</th>
                <th>Marcador exacto</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(settings.scoring).map(([stage, values]) => (
                <tr key={stage}>
                  <td><strong>{stage}</strong></td>
                  <td>
                    {isAdmin ? (
                      <input className="points-input" min="0" onChange={(event) => updatePhasePoints(stage, 'result', event.target.value)} type="number" value={values.result} />
                    ) : values.result}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input className="points-input" min="0" onChange={(event) => updatePhasePoints(stage, 'qualifiedTeam', event.target.value)} type="number" value={values.qualifiedTeam} />
                    ) : values.qualifiedTeam}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input className="points-input" min="0" onChange={(event) => updatePhasePoints(stage, 'bracket', event.target.value)} type="number" value={values.bracket} />
                    ) : values.bracket}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input className="points-input" min="0" onChange={(event) => updatePhasePoints(stage, 'exactScore', event.target.value)} type="number" value={values.exactScore} />
                    ) : values.exactScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Reglas especiales</h3>
        </div>
        <div className="rules-list">
          <p>En fase de grupos se suma por marcador exacto o, si no fue exacto, por acertar ganador o empate.</p>
          <p>En dieciseisavos, octavos, cuartos, semifinal, final y tercer puesto, los puntos de marcador exacto solo aplican si la llave fue acertada.</p>
          <p>En eliminatorias, el marcador pronosticado siempre corresponde a los 90 minutos.</p>
          <p>Si el usuario pronostica empate en eliminatorias, debe seleccionar obligatoriamente quien gana por penales.</p>
          <p>Si un partido termina empatado y se define por penales, el marcador valido para puntos es el resultado antes de penales.</p>
          <p>Los penales no modifican el marcador ni dan puntos adicionales; solo determinan el equipo clasificado.</p>
          <p>Si el marcador empatado es correcto pero el ganador por penales es incorrecto, recibe puntos de marcador si aplica, pero no recibe puntos de clasificado ni llave.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h3>Resultados finales del torneo</h3>
        </div>
        <div className="rules-grid">
          {Object.entries(settings.finalResultsPoints).map(([field, points]) => (
            <article key={field}>
              <span>{finalLabels[field]}</span>
              {isAdmin ? (
                <label>
                  Puntos
                  <input min="0" onChange={(event) => updateFinalPoints(field, event.target.value)} type="number" value={points} />
                </label>
              ) : (
                <strong>{points} pts</strong>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RulesPanel;
