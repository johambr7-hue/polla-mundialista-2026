import { CalendarDays, FileUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { importMatches, parseMatchFile } from '../utils/importMatches';
import { displayMatch } from '../utils/localization';

function ImportCalendarPanel({ isAdmin, matches, updateMatches, updatePredictions }) {
  const [summary, setSummary] = useState(null);
  const [preview, setPreview] = useState([]);
  const [fileName, setFileName] = useState('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const text = await file.text();
      const rawMatches = parseMatchFile(text, file.name);
      const result = importMatches(rawMatches, matches);

      if (result.imported.length) {
        updateMatches([...matches, ...result.imported].sort((a, b) => Number(a.matchNumber ?? 9999) - Number(b.matchNumber ?? 9999)));
      }

      setPreview(result.imported);
      setSummary({
        imported: result.imported.length,
        duplicates: result.duplicates,
        errors: result.errors
      });
    } catch (error) {
      setPreview([]);
      setSummary({
        imported: 0,
        duplicates: [],
        errors: [error.message]
      });
    } finally {
      event.target.value = '';
    }
  };

  const importFromText = (text, filename) => {
    const rawMatches = parseMatchFile(text, filename);
    const result = importMatches(rawMatches, matches);

    if (result.imported.length) {
      updateMatches([...matches, ...result.imported].sort((a, b) => Number(a.matchNumber ?? 9999) - Number(b.matchNumber ?? 9999)));
    }

    setFileName(filename);
    setPreview(result.imported);
    setSummary({
      imported: result.imported.length,
      duplicates: result.duplicates,
      errors: result.errors
    });
  };

  const loadIncludedCalendar = async () => {
    try {
      const response = await fetch('/mundial2026_matches_completo.csv');
      if (!response.ok) throw new Error('No se pudo leer el CSV completo incluido.');
      const text = await response.text();
      const rawMatches = parseMatchFile(text, 'mundial2026_matches_completo.csv');
      const result = importMatches(rawMatches, []);

      updateMatches(result.imported);
      updatePredictions([]);
      setFileName('mundial2026_matches_completo.csv');
      setPreview(result.imported);
      setSummary({
        imported: result.imported.length,
        duplicates: result.duplicates,
        errors: result.errors
      });
    } catch (error) {
      setPreview([]);
      setSummary({
        imported: 0,
        duplicates: [],
        errors: [error.message]
      });
    }
  };

  const clearMatches = () => {
    updateMatches([]);
    updatePredictions([]);
    setPreview([]);
    setSummary({
      imported: 0,
      duplicates: [],
      errors: ['Se borraron todos los partidos y pronosticos asociados.']
    });
  };

  return (
    <section className="stack-list">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Importar calendario</h3>
            <p className="muted">Carga un CSV o JSON con el calendario completo. El importador esta preparado para los 104 partidos.</p>
          </div>
        </div>

        {!isAdmin && <div className="notice">Entra como administrador para importar o borrar partidos.</div>}

        <div className="import-actions">
          <label className={isAdmin ? 'file-upload' : 'file-upload disabled'}>
            <FileUp size={18} />
            Subir CSV o JSON
            <input accept=".csv,.json" disabled={!isAdmin} onChange={handleFile} type="file" />
          </label>
          <button className="primary-button" disabled={!isAdmin} onClick={loadIncludedCalendar} type="button">
            <CalendarDays size={18} />
            Cargar calendario completo
          </button>
          <a className="secondary-button" href="/mundial2026_matches_sample.csv" download>
            <FileUp size={18} />
            Descargar ejemplo
          </a>
          <button className="danger-button" disabled={!isAdmin || matches.length === 0} onClick={clearMatches} type="button">
            <Trash2 size={18} />
            Borrar todos los partidos
          </button>
        </div>

        <div className="import-format">
          <strong>Estructura requerida</strong>
          <code>match_number,date,time,stage,group,home_team,away_team,stadium,city,status</code>
        </div>
      </div>

      {summary && (
        <div className="summary-grid">
          <article>
            <span>Archivo</span>
            <strong>{fileName || 'Sin archivo'}</strong>
          </article>
          <article>
            <span>Partidos importados</span>
            <strong>{summary.imported}</strong>
          </article>
          <article>
            <span>Duplicados</span>
            <strong>{summary.duplicates.length}</strong>
          </article>
          <article>
            <span>Errores</span>
            <strong>{summary.errors.length}</strong>
          </article>
        </div>
      )}

      {summary && (summary.duplicates.length > 0 || summary.errors.length > 0) && (
        <div className="panel">
          <div className="panel-heading">
            <h3>Detalle de importación</h3>
          </div>
          {summary.duplicates.length > 0 && (
            <p className="muted">Duplicados por match_number: {summary.duplicates.join(', ')}</p>
          )}
          {summary.errors.map((error) => (
            <p className="form-error" key={error}>{error}</p>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Partidos cargados</h3>
            <p className="muted">Puedes editarlos manualmente desde el módulo Partidos después de importarlos.</p>
          </div>
          <span className="counter">{matches.length}</span>
        </div>
        <div className="table-wrap">
          <table className="import-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Fase</th>
                <th>Grupo</th>
                <th>Partido</th>
                <th>Estadio</th>
                <th>Ciudad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {[...matches]
                .sort((a, b) => Number(a.matchNumber ?? 9999) - Number(b.matchNumber ?? 9999))
                .map((match) => (
                  <tr key={match.id}>
                    <td>{match.matchNumber ?? '-'}</td>
                    <td>{match.date}</td>
                    <td>{match.time}</td>
                    <td>{match.stage}</td>
                    <td>{match.group}</td>
                    <td><strong>{displayMatch(match)}</strong></td>
                    <td>{match.stadium || '-'}</td>
                    <td>{match.city || '-'}</td>
                    <td><span className={`status ${match.status}`}>{match.status}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="panel">
          <div className="panel-heading">
            <h3>Última importación</h3>
          </div>
          <p className="muted">{preview.length} partidos nuevos fueron agregados correctamente.</p>
        </div>
      )}
    </section>
  );
}

export default ImportCalendarPanel;
