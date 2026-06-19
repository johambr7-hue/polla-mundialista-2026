import { useEffect, useMemo, useState } from 'react';
import { displayMatch } from '../utils/localization';
import { formatCop } from '../utils/formatters';

const getMatchDate = (match) => {
  if (!match?.date) return null;
  const time = match.time && match.time !== 'TBD' ? match.time : '00:00';
  const date = new Date(`${match.date}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatCountdown = (targetDate, now) => {
  if (!targetDate) return 'Por definir';
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return 'En curso / por actualizar';

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

function GlobalDashboard({ collection, matches, participants, ranking }) {
  const [now, setNow] = useState(() => new Date());
  const playedMatches = matches.filter((match) => match.status === 'jugado').length;
  const leader = ranking[0];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
        <article>
          <span>⏳ Cuenta regresiva</span>
          <strong>{formatCountdown(nextMatch?.date, now)}</strong>
        </article>
      </div>
    </section>
  );
}

export default GlobalDashboard;
