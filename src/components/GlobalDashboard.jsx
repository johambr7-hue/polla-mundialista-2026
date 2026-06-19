import { useMemo } from 'react';
import { displayMatch } from '../utils/localization';
import { formatCop } from '../utils/formatters';

const getMatchDate = (match) => {
  if (!match?.date) return null;
  const time = match.time && match.time !== 'TBD' ? match.time : '00:00';
  const date = new Date(`${match.date}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

function GlobalDashboard({ collection, matches, participants, ranking }) {
  const playedMatches = matches.filter((match) => match.status === 'jugado').length;
  const leader = ranking[0];

  const nextMatch = useMemo(() => {
    const upcoming = matches
      .filter((match) => match.status !== 'jugado')
      .map((match) => ({ match, date: getMatchDate(match) }))
      .sort((a, b) => {
        const dateA = a.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const dateB = b.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      });

    return upcoming[0] ?? null;
  }, [matches]);

  return (
    <section className="world-dashboard" aria-label="Resumen Mundial 2026">
      <div className="world-dashboard-title">
        <span>🏆</span>
        <div>
          <strong>Mundial 2026</strong>
          <p>Centro de seguimiento de la polla</p>
        </div>
      </div>

      <div className="world-dashboard-grid">
        <article>
          <span>⚽ Partidos jugados</span>
          <strong>{playedMatches} / {matches.length || 0}</strong>
        </article>
        <article>
          <span>👥 Participantes</span>
          <strong>{participants.length}</strong>
        </article>
        <article>
          <span>💰 Recaudo</span>
          <strong>{formatCop(collection.collectedTotal)}</strong>
        </article>
        <article>
          <span>👑 Líder</span>
          <strong>{leader ? leader.name : 'Sin líder'}</strong>
        </article>
        <article className="next-match-card">
          <span>📅 Próximo partido</span>
          <strong>{nextMatch?.match ? displayMatch(nextMatch.match) : 'Sin partido pendiente'}</strong>
        </article>
      </div>
    </section>
  );
}

export default GlobalDashboard;
