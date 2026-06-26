import { displayTeam } from './localization';

const normalizeSearch = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isSameTeam = (a, b) => normalizeSearch(displayTeam(a) || a) === normalizeSearch(displayTeam(b) || b);

const normalizeGroupKey = (group) => {
  const value = String(group ?? '').trim();
  const match = value.match(/([A-L])$/i);
  return match ? match[1].toUpperCase() : value;
};

const hasScoreValue = (value) => value !== '' && value !== null && value !== undefined;
const hasOfficialScore = (match) => hasScoreValue(match.realHomeScore) && hasScoreValue(match.realAwayScore);
const isOfficialComplete = (match) => match.status === 'jugado' && hasOfficialScore(match);

const emptyStanding = (team, group) => ({
  team,
  group,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0
});

const compareStandings = (a, b) =>
  b.points - a.points ||
  b.goalDifference - a.goalDifference ||
  b.goalsFor - a.goalsFor ||
  displayTeam(a.team).localeCompare(displayTeam(b.team), 'es');

const addGroupResult = (home, away, homeGoals, awayGoals) => {
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (homeGoals > awayGoals) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
    return;
  }

  if (homeGoals < awayGoals) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
    return;
  }

  home.drawn += 1;
  away.drawn += 1;
  home.points += 1;
  away.points += 1;
};

const buildOfficialGroupTables = (matches) => {
  const groups = new Map();

  matches
    .filter((match) => match.stage === 'Fase de grupos')
    .forEach((match) => {
      const group = normalizeGroupKey(match.group) || 'Sin grupo';
      if (!groups.has(group)) {
        groups.set(group, { completed: 0, rows: new Map(), total: 0 });
      }

      const groupData = groups.get(group);
      groupData.total += 1;
      [match.homeTeam, match.awayTeam].forEach((team) => {
        if (team && !groupData.rows.has(team)) {
          groupData.rows.set(team, emptyStanding(team, group));
        }
      });

      if (!isOfficialComplete(match)) return;

      const home = groupData.rows.get(match.homeTeam);
      const away = groupData.rows.get(match.awayTeam);
      if (!home || !away) return;

      addGroupResult(home, away, Number(match.realHomeScore), Number(match.realAwayScore));
      groupData.completed += 1;
    });

  return Object.fromEntries(
    [...groups.entries()].map(([group, groupData]) => [
      group,
      {
        complete: groupData.total > 0 && groupData.completed === groupData.total,
        standings: [...groupData.rows.values()].sort(compareStandings)
      }
    ])
  );
};

const buildOfficialQualifiers = (groupTables) => {
  const qualifiers = {};
  const thirdPlaces = [];
  const groups = Object.entries(groupTables);

  groups.forEach(([group, table]) => {
    if (!table.complete || table.standings.length < 3) return;

    qualifiers[`Winner Group ${group}`] = table.standings[0].team;
    qualifiers[`Runner-up Group ${group}`] = table.standings[1].team;
    thirdPlaces.push(table.standings[2]);
  });

  const allGroupsComplete = groups.length >= 12 && groups.every(([, table]) => table.complete);
  const bestThirds = allGroupsComplete ? [...thirdPlaces].sort(compareStandings).slice(0, 8) : [];

  return { bestThirds, qualifiers };
};

const resolveBestThird = (placeholder, context) => {
  const bestThird = String(placeholder ?? '').match(/^Best 3rd Group ([A-L/]+)$/i);
  if (!bestThird) return '';

  const candidateGroups = bestThird[1].split('/').map((group) => group.toUpperCase());
  const selected = context.bestThirds.find(
    (standing) => candidateGroups.includes(String(standing.group).toUpperCase()) && !context.usedBestThirdGroups.has(standing.group)
  );

  if (!selected) return '';
  context.usedBestThirdGroups.add(selected.group);
  return selected.team;
};

const resolveOfficialPlaceholder = (value, context) => {
  const team = String(value ?? '').trim();
  const winnerMatch = team.match(/^Winner Match (\d+)$/i);
  if (winnerMatch) return context.winners[winnerMatch[1]] ?? '';

  const loserMatch = team.match(/^Loser Match (\d+)$/i);
  if (loserMatch) return context.losers[loserMatch[1]] ?? '';

  const bestThird = resolveBestThird(team, context);
  if (bestThird) return bestThird;

  return context.qualifiers[team] ?? '';
};

const getOfficialWinner = (match, homeTeam, awayTeam) => {
  if (match.qualifiedTeam) return match.qualifiedTeam;
  if (!isOfficialComplete(match)) return '';

  const homeScore = Number(match.realHomeScore);
  const awayScore = Number(match.realAwayScore);
  if (homeScore > awayScore) return homeTeam;
  if (homeScore < awayScore) return awayTeam;
  return '';
};

const getOfficialLoser = (winner, homeTeam, awayTeam) => {
  if (!winner) return '';
  if (isSameTeam(winner, homeTeam)) return awayTeam;
  if (isSameTeam(winner, awayTeam)) return homeTeam;
  return '';
};

const confirmedOfficialMatchTeams = {
  73: {
    homeTeam: 'South Africa',
    awayTeam: 'Canada'
  },
  75: {
    homeTeam: 'Netherlands',
    awayTeam: 'Morocco'
  },
  76: {
    homeTeam: 'Brazil',
    awayTeam: 'Japan'
  },
  81: {
    homeTeam: 'United States',
    awayTeam: 'Bosnia and Herzegovina'
  }
};

export const buildOfficialBracketRounds = (matches) => {
  const groupTables = buildOfficialGroupTables(matches);
  const context = {
    ...buildOfficialQualifiers(groupTables),
    losers: {},
    usedBestThirdGroups: new Set(),
    winners: {}
  };
  const rounds = {};

  [...matches]
    .filter((match) => match.stage !== 'Fase de grupos')
    .sort((a, b) => Number(a.matchNumber ?? 999) - Number(b.matchNumber ?? 999))
    .forEach((match) => {
      const confirmedTeams = confirmedOfficialMatchTeams[Number(match.matchNumber)] ?? {};
      const homeTeam = confirmedTeams.homeTeam || resolveOfficialPlaceholder(match.homeTeam, context) || match.homeTeam;
      const awayTeam = confirmedTeams.awayTeam || resolveOfficialPlaceholder(match.awayTeam, context) || match.awayTeam;
      const winner = getOfficialWinner(match, homeTeam, awayTeam);
      const loser = getOfficialLoser(winner, homeTeam, awayTeam);
      const matchKey = String(match.matchNumber ?? match.id);

      context.winners[matchKey] = winner;
      context.losers[matchKey] = loser;
      rounds[match.stage] = [
        ...(rounds[match.stage] ?? []),
        { ...match, awayTeam, homeTeam, loser, winner }
      ];
    });

  return rounds;
};

export const resolveOfficialMatches = (matches) => {
  const resolvedKnockoutMatches = Object.values(buildOfficialBracketRounds(matches)).flat();
  const resolvedById = new Map(resolvedKnockoutMatches.map((match) => [match.id, match]));
  return matches.map((match) => resolvedById.get(match.id) ?? match);
};
