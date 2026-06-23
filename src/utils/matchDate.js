const APP_TIME_ZONE = 'America/Bogota';

const getBogotaDateParts = (date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone: APP_TIME_ZONE,
      year: 'numeric'
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

export const getBogotaDateKey = (date = new Date()) => {
  const parts = getBogotaDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getYesterdayBogotaDateKey = (date = new Date()) => {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getBogotaDateKey(yesterday);
};

export const getMatchDateTime = (match) => {
  if (!match?.date) return null;
  const time = match.time && match.time !== 'TBD' ? match.time : '00:00';
  const date = new Date(`${match.date}T${time}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getMatchBogotaDateKey = (match) => {
  const date = getMatchDateTime(match);
  return date ? getBogotaDateKey(date) : match?.date ?? '';
};

export const getMatchBogotaTime = (match) => {
  const date = getMatchDateTime(match);
  if (!date) return match?.time || 'Hora por definir';
  return date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: APP_TIME_ZONE
  });
};

export const getMatchSortKey = (match) =>
  `${match.date ?? ''} ${match.time ?? ''} ${String(match.matchNumber ?? '').padStart(3, '0')}`;
