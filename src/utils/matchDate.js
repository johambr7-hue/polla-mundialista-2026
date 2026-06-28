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
  if (!match.time || match.time === 'TBD') return null;
  const date = new Date(`${match.date}T${match.time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getMatchBogotaDateKey = (match) => match?.date ?? '';

export const getMatchBogotaTime = (match) => {
  if (!match?.time || match.time === 'TBD') return 'Hora por definir';
  return match.time;
};

export const getMatchSortKey = (match) =>
  `${match.date ?? ''} ${match.time ?? ''} ${String(match.matchNumber ?? '').padStart(3, '0')}`;
