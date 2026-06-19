export const getInitials = (name = '') =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || 'PM';

export function Avatar({ name, size = 'md' }) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}

export function SportBadge({ children, tone = 'neutral', className = '' }) {
  return <span className={`sport-badge ${tone} ${className}`.trim()}>{children}</span>;
}

export function StatCard({ icon, label, value, accent = 'blue' }) {
  return (
    <article className={`stat-card ${accent}`}>
      <span>{icon} {label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function PointsBar({ value, max, color = '#2563eb' }) {
  const width = max > 0 ? Math.max((Number(value) / max) * 100, Number(value) > 0 ? 5 : 0) : 0;

  return (
    <div className="points-meter" aria-hidden="true">
      <span style={{ width: `${width}%`, background: color }} />
    </div>
  );
}
