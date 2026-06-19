import { useMemo, useState } from 'react';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { displayTeam } from '../utils/localization';

const emptyMatch = {
  matchNumber: '',
  date: '',
  time: '',
  group: '',
  stage: 'Fase de grupos',
  homeTeam: '',
  awayTeam: '',
  stadium: '',
  city: '',
  realHomeScore: '',
  realAwayScore: '',
  qualifiedTeam: '',
  classificationMethod: '',
  status: 'pendiente'
};

const stageOptions = ['Fase de grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final', 'Tercer puesto'];
const classificationMethods = [
  ['regulation', 'Tiempo reglamentario'],
  ['extraTime', 'Prórroga'],
  ['penalties', 'Penales']
];

function MatchPanel({ isAdmin, matches, predictions, updateMatches, updatePredictions }) {
  const [activeView, setActiveView] = useState('list');
  const [form, setForm] = useState(emptyMatch);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ date: '', group: 'all', stage: 'Fase de grupos' });
  const [scoreDrafts, setScoreDrafts] = useState({});

  const filteredMatches = useMemo(
    () =>
      matches
        .filter((match) => !filters.date || match.date === filters.date)
        .filter((match) => filters.group === 'all' || match.group === filters.group)
        .filter((match) => filters.stage === 'all' || match.stage === filters.stage)
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [matches, filters]
  );

  const groupOptions = useMemo(
    () =>
      [...new Set(matches.filter((match) => match.stage === 'Fase de grupos').map((match) => match.group).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es')),
    [matches]
  );

  const matchesByGroup = useMemo(
    () =>
      groupOptions.map((group) => ({
        group,
        matches: filteredMatches.filter((match) => match.group === group)
      })).filter((item) => item.matches.length),
    [filteredMatches, groupOptions]
  );

  const knockoutSections = useMemo(
    () =>
      stageOptions
        .filter((stage) => stage !== 'Fase de grupos')
        .map((stage) => ({
          stage,
          matches: filteredMatches.filter((match) => match.stage === stage)
        }))
        .filter((item) => item.matches.length),
    [filteredMatches]
  );

  const submitMatch = (event) => {
    event.preventDefault();
    if (!form.date || !form.time || !form.homeTeam.trim() || !form.awayTeam.trim()) return;

    const normalized = {
      ...form,
      matchNumber: form.matchNumber === '' ? '' : Number(form.matchNumber),
      homeTeam: form.homeTeam.trim(),
      awayTeam: form.awayTeam.trim(),
      stadium: form.stadium.trim(),
      city: form.city.trim(),
      realHomeScore: form.realHomeScore === '' ? '' : Number(form.realHomeScore),
      realAwayScore: form.realAwayScore === '' ? '' : Number(form.realAwayScore)
    };

    if (editingId) {
      updateMatches(matches.map((match) => (match.id === editingId ? { ...match, ...normalized } : match)));
    } else {
      updateMatches([...matches, normalized]);
    }

    setForm(emptyMatch);
    setEditingId(null);
    setActiveView('list');
  };

  const editMatch = (match) => {
    setEditingId(match.id);
    setForm(match);
    setActiveView('form');
  };

  const removeMatch = (matchId) => {
    updateMatches(matches.filter((match) => match.id !== matchId));
    updatePredictions(predictions.filter((prediction) => prediction.matchId !== matchId));
  };

  const getScoreDraft = (match) => ({
    realHomeScore: scoreDrafts[match.id]?.realHomeScore ?? match.realHomeScore ?? '',
    realAwayScore: scoreDrafts[match.id]?.realAwayScore ?? match.realAwayScore ?? '',
    status: scoreDrafts[match.id]?.status ?? match.status ?? 'pendiente'
  });

  const updateScoreDraft = (matchId, field, value) => {
    setScoreDrafts((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] ?? {}),
        [field]: value
      }
    }));
  };

  const saveQuickScore = (match) => {
    const draft = getScoreDraft(match);
    if (draft.realHomeScore === '' || draft.realAwayScore === '') return;

    updateMatches(
      matches.map((item) =>
        item.id === match.id
          ? {
              ...item,
              realHomeScore: Number(draft.realHomeScore),
              realAwayScore: Number(draft.realAwayScore),
              status: draft.status
            }
          : item
      )
    );

    setScoreDrafts((current) => {
      const next = { ...current };
      delete next[match.id];
      return next;
    });
  };

  const clearQuickScore = (match) => {
    updateMatches(
      matches.map((item) =>
        item.id === match.id
          ? {
              ...item,
              realHomeScore: '',
              realAwayScore: '',
              qualifiedTeam: '',
              classificationMethod: '',
              status: 'pendiente'
            }
          : item
      )
    );

    setScoreDrafts((current) => ({
      ...current,
      [match.id]: {
        realHomeScore: '',
        realAwayScore: '',
        status: 'pendiente'
      }
    }));
  };

  const renderMatchCard = (match) => (
    <article className="match-card result-match-card" key={match.id ?? `${match.matchNumber}-${match.date}-${match.homeTeam}-${match.awayTeam}`}>
      <div className="match-meta">
        <span>{match.matchNumber ? `#${match.matchNumber} · ` : ''}{match.date} · {match.time}</span>
        <span>{match.group || match.stage}</span>
      </div>
      <div className="result-scoreboard">
        <strong>{displayTeam(match.homeTeam)}</strong>
        <span>{match.realHomeScore === '' ? '-' : match.realHomeScore} : {match.realAwayScore === '' ? '-' : match.realAwayScore}</span>
        <strong>{displayTeam(match.awayTeam)}</strong>
      </div>
      <div className="result-info-strip">
        <span>📅 {match.date || 'Sin fecha'}</span>
        <span>🏟️ {match.stadium || match.city || 'Sede por definir'}</span>
        <span>🏁 {match.qualifiedTeam ? `Clasifica ${displayTeam(match.qualifiedTeam)}` : 'Sin clasificado'}</span>
      </div>
      <div className="quick-score-form">
        <label>
          Goles {displayTeam(match.homeTeam)}
          <input
            disabled={!isAdmin}
            min="0"
            onChange={(event) => updateScoreDraft(match.id, 'realHomeScore', event.target.value)}
            type="number"
            value={getScoreDraft(match).realHomeScore}
          />
        </label>
        <label>
          Goles {displayTeam(match.awayTeam)}
          <input
            disabled={!isAdmin}
            min="0"
            onChange={(event) => updateScoreDraft(match.id, 'realAwayScore', event.target.value)}
            type="number"
            value={getScoreDraft(match).realAwayScore}
          />
        </label>
        <label>
          Estado
          <select
            disabled={!isAdmin}
            onChange={(event) => updateScoreDraft(match.id, 'status', event.target.value)}
            value={getScoreDraft(match).status}
          >
            <option value="pendiente">Pendiente</option>
            <option value="jugado">Jugado</option>
          </select>
        </label>
        <button
          className="primary-button compact"
          disabled={!isAdmin || getScoreDraft(match).realHomeScore === '' || getScoreDraft(match).realAwayScore === ''}
          onClick={() => saveQuickScore(match)}
          type="button"
        >
          <Save size={16} />
          Guardar marcador
        </button>
        <button
          className="secondary-button compact"
          disabled={!isAdmin}
          onClick={() => clearQuickScore(match)}
          type="button"
        >
          Limpiar
        </button>
      </div>
      <div className="card-footer">
        <span className={`status ${match.status}`}>{match.status}</span>
        <span>{match.stadium ? `${match.stadium}, ${match.city}` : match.stage}</span>
        <div className="row-actions">
          <button className="icon-button" disabled={!isAdmin} onClick={() => editMatch(match)} type="button" title="Editar partido">
            <Edit2 size={18} />
          </button>
          <button className="icon-button danger" disabled={!isAdmin} onClick={() => removeMatch(match.id)} type="button" title="Eliminar partido">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <section className="stack-list">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Partidos</h3>
            <p className="muted">Consulta el calendario por fase o crea/edita partidos cuando sea necesario.</p>
          </div>
          <span className="counter">{matches.length}</span>
        </div>
        <div className="tab-strip">
          <button
            className={activeView === 'list' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveView('list')}
            type="button"
          >
            Ver partidos
          </button>
          <button
            className={activeView === 'form' ? 'tab-button active' : 'tab-button'}
            disabled={!isAdmin && !editingId}
            onClick={() => {
              setActiveView('form');
              if (!editingId) setForm(emptyMatch);
            }}
            type="button"
          >
            {editingId ? 'Editar partido' : 'Crear partido'}
          </button>
        </div>
      </div>

      {activeView === 'form' && (
      <form className="panel match-form-panel" onSubmit={submitMatch}>
        <div className="panel-heading">
          <h3>{editingId ? 'Editar partido' : 'Crear partido'}</h3>
          {editingId && (
            <button
              className="icon-button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyMatch);
                setActiveView('list');
              }}
              type="button"
              title="Cancelar"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="form-grid">
          <label>
            Fecha
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, date: event.target.value })} required type="date" value={form.date} />
          </label>
          <label>
            Hora
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, time: event.target.value })} required type="time" value={form.time} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Numero de partido
            <input disabled={!isAdmin} min="1" onChange={(event) => setForm({ ...form, matchNumber: event.target.value })} type="number" value={form.matchNumber ?? ''} />
          </label>
          <label>
            Grupo
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, group: event.target.value })} placeholder="Grupo A" value={form.group} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Estadio
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, stadium: event.target.value })} placeholder="Estadio Azteca" value={form.stadium ?? ''} />
          </label>
          <label>
            Ciudad
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Ciudad de México" value={form.city ?? ''} />
          </label>
        </div>
        <label>
          Fase
          <select disabled={!isAdmin} onChange={(event) => setForm({ ...form, stage: event.target.value })} value={form.stage}>
            {stageOptions.map((stage) => <option key={stage}>{stage}</option>)}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Equipo local
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, homeTeam: event.target.value })} required value={displayTeam(form.homeTeam)} />
          </label>
          <label>
            Equipo visitante
            <input disabled={!isAdmin} onChange={(event) => setForm({ ...form, awayTeam: event.target.value })} required value={displayTeam(form.awayTeam)} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Marcador local
            <input disabled={!isAdmin} min="0" onChange={(event) => setForm({ ...form, realHomeScore: event.target.value })} type="number" value={form.realHomeScore} />
          </label>
          <label>
            Marcador visitante
            <input disabled={!isAdmin} min="0" onChange={(event) => setForm({ ...form, realAwayScore: event.target.value })} type="number" value={form.realAwayScore} />
          </label>
        </div>
        <label>
          Equipo clasificado
          <input
            disabled={!isAdmin}
            onChange={(event) => setForm({ ...form, qualifiedTeam: event.target.value })}
            placeholder="Solo aplica para eliminatorias"
            value={displayTeam(form.qualifiedTeam)}
          />
        </label>
        <label>
          Método de clasificación
          <select
            disabled={!isAdmin}
            onChange={(event) => setForm({ ...form, classificationMethod: event.target.value })}
            value={form.classificationMethod ?? ''}
          >
            <option value="">No aplica / sin definir</option>
            {classificationMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Estado
          <select disabled={!isAdmin} onChange={(event) => setForm({ ...form, status: event.target.value })} value={form.status}>
            <option value="pendiente">Pendiente</option>
            <option value="jugado">Jugado</option>
          </select>
        </label>
        <button className="primary-button" disabled={!isAdmin} type="submit">
          {editingId ? <Save size={18} /> : <Plus size={18} />}
          {editingId ? 'Guardar' : 'Crear'}
        </button>
      </form>
      )}

      {activeView === 'list' && (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Centro de resultados</h3>
            <p className="muted">Ingresa marcadores reales, revisa estado y clasificados por fase.</p>
          </div>
          <span className="counter">{filteredMatches.length}</span>
        </div>
        <div className="match-filters">
          <label>
            Fase
            <select
              onChange={(event) => setFilters({ ...filters, stage: event.target.value, group: 'all' })}
              value={filters.stage}
            >
              <option value="all">Todas las fases</option>
              {stageOptions.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </label>
          <label>
            Grupo
            <select
              disabled={filters.stage !== 'Fase de grupos'}
              onChange={(event) => setFilters({ ...filters, group: event.target.value })}
              value={filters.group}
            >
              <option value="all">Todos los grupos</option>
              {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label>
            Fecha
            <input onChange={(event) => setFilters({ ...filters, date: event.target.value })} type="date" value={filters.date} />
          </label>
        </div>

        {filters.stage === 'Fase de grupos' && filters.group === 'all' ? (
          <div className="accordion-list">
            {matchesByGroup.map((section, index) => (
              <details className="accordion-panel" key={section.group} open={index < 2}>
                <summary>
                  {section.group}
                  <span>{section.matches.length} partidos</span>
                </summary>
                <div className="match-list compact-grid">
                  {section.matches.map(renderMatchCard)}
                </div>
              </details>
            ))}
            {!matchesByGroup.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        ) : filters.stage === 'Fase de grupos' ? (
          <div className="match-list compact-grid">
            {filteredMatches.map(renderMatchCard)}
            {!filteredMatches.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        ) : filters.stage === 'all' ? (
          <div className="accordion-list">
            {matchesByGroup.length > 0 && (
              <details className="accordion-panel" open>
                <summary>
                  Fase de grupos
                  <span>{matchesByGroup.reduce((total, section) => total + section.matches.length, 0)} partidos</span>
                </summary>
                <div className="accordion-list nested-accordion">
                  {matchesByGroup.map((section, index) => (
                    <details className="accordion-panel" key={section.group} open={index < 1}>
                      <summary>
                        {section.group}
                        <span>{section.matches.length} partidos</span>
                      </summary>
                      <div className="match-list compact-grid">
                        {section.matches.map(renderMatchCard)}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )}
            {knockoutSections.map((section) => (
              <details className="accordion-panel" key={section.stage}>
                <summary>
                  {section.stage}
                  <span>{section.matches.length} partidos</span>
                </summary>
                <div className="match-list compact-grid">
                  {section.matches.map(renderMatchCard)}
                </div>
              </details>
            ))}
            {!filteredMatches.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        ) : (
          <div className="match-list compact-grid">
            {filteredMatches.map(renderMatchCard)}
            {!filteredMatches.length && <p className="muted">No hay partidos con estos filtros.</p>}
          </div>
        )}
      </div>
      )}
    </section>
  );
}

export default MatchPanel;
