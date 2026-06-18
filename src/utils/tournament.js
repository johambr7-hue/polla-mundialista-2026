const GROUP_STAGE = 'Fase de grupos';

const normalizeScore = (value) => (value === '' || value === undefined || value === null ? '' : Number(value));

const hasScore = (prediction) => prediction?.homeScore !== '' && prediction?.awayScore !== '' && prediction?.homeScore !== undefined && prediction?.awayScore !== undefined;

const compareRows = (a, b) =>
  b.points - a.points ||
  b.goalDifference - a.goalDifference ||
  b.goalsFor - a.goalsFor ||
  a.team.localeCompare(b.team);

const emptyRow = (team, group) => ({
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

export const getGroupMatches = (matches) =>
  matches
    .filter((match) => match.stage === GROUP_STAGE)
    .sort((a, b) => Number(a.matchNumber) - Number(b.matchNumber));

export const getKnockoutMatches = (matches) =>
  matches
    .filter((match) => match.stage !== GROUP_STAGE)
    .sort((a, b) => Number(a.matchNumber) - Number(b.matchNumber));

export const getPrediction = (entry, matchNumber) => entry?.matchPredictions?.[matchNumber] ?? {};

export const buildGroupTables = (matches, entry) => {
  const groups = {};

  getGroupMatches(matches).forEach((match) => {
    if (!groups[match.group]) groups[match.group] = {};
    if (!groups[match.group][match.homeTeam]) groups[match.group][match.homeTeam] = emptyRow(match.homeTeam, match.group);
    if (!groups[match.group][match.awayTeam]) groups[match.group][match.awayTeam] = emptyRow(match.awayTeam, match.group);

    const prediction = getPrediction(entry, match.matchNumber);
    if (!hasScore(prediction)) return;

    const home = groups[match.group][match.homeTeam];
    const away = groups[match.group][match.awayTeam];
    const homeScore = Number(prediction.homeScore);
    const awayScore = Number(prediction.awayScore);

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (homeScore < awayScore) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  });

  return Object.fromEntries(
    Object.entries(groups).map(([group, rows]) => {
      const manualOrder = entry?.tieBreakOrders?.[group] ?? [];
      const ordered = Object.values(rows).sort((a, b) => {
        const base = compareRows(a, b);
        if (base !== 0) return base;
        const aIndex = manualOrder.indexOf(a.team);
        const bIndex = manualOrder.indexOf(b.team);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.team.localeCompare(b.team);
      });
      return [group, ordered];
    })
  );
};

export const getTieGroups = (tableRows) => {
  const buckets = {};
  tableRows.forEach((row) => {
    const key = `${row.points}-${row.goalDifference}-${row.goalsFor}`;
    buckets[key] = [...(buckets[key] ?? []), row.team];
  });
  return Object.values(buckets).filter((teams) => teams.length > 1);
};

export const buildQualifiers = (groupTables) => {
  const qualifiers = {};
  const thirdRows = [];

  Object.entries(groupTables).forEach(([group, rows]) => {
    qualifiers[`Winner Group ${group}`] = rows[0]?.team ?? '';
    qualifiers[`Runner-up Group ${group}`] = rows[1]?.team ?? '';
    if (rows[2]) thirdRows.push(rows[2]);
  });

  thirdRows.sort(compareRows);
  thirdRows.slice(0, 8).forEach((row) => {
    qualifiers[`Best 3rd Group ${row.group}`] = row.team;
  });

  return { qualifiers, bestThirds: thirdRows.slice(0, 8) };
};

const resolveBestThird = (placeholder, qualifiers, usedBestThirdGroups) => {
  const groups = placeholder.replace('Best 3rd Group ', '').split('/').map((group) => group.trim());
  const group = groups.find((item) => qualifiers[`Best 3rd Group ${item}`] && !usedBestThirdGroups.has(item));
  if (!group) return '';
  usedBestThirdGroups.add(group);
  return qualifiers[`Best 3rd Group ${group}`];
};

export const resolvePlaceholder = (placeholder, context) => {
  if (!placeholder) return '';
  if (placeholder.startsWith('Best 3rd Group ')) return resolveBestThird(placeholder, context.qualifiers, context.usedBestThirdGroups);
  if (placeholder.startsWith('Winner Group ') || placeholder.startsWith('Runner-up Group ')) return context.qualifiers[placeholder] ?? '';
  if (placeholder.startsWith('Winner Match ')) return context.winners[Number(placeholder.replace('Winner Match ', ''))] ?? '';
  if (placeholder.startsWith('Loser Match ')) return context.losers[Number(placeholder.replace('Loser Match ', ''))] ?? '';
  return placeholder;
};

export const getPredictedWinner = (prediction, homeTeam, awayTeam) => {
  if (!hasScore(prediction)) return '';
  const homeScore = Number(prediction.homeScore);
  const awayScore = Number(prediction.awayScore);
  if (homeScore > awayScore) return homeTeam;
  if (homeScore < awayScore) return awayTeam;
  return prediction.penaltyWinner ?? '';
};

export const isKnockoutPredictionComplete = (prediction, homeTeam, awayTeam) => {
  if (!homeTeam || !awayTeam || !hasScore(prediction)) return false;
  if (Number(prediction.homeScore) === Number(prediction.awayScore)) return Boolean(prediction.penaltyWinner);
  return true;
};

export const buildBracket = (matches, entry) => {
  const groupTables = buildGroupTables(matches, entry);
  const { qualifiers, bestThirds } = buildQualifiers(groupTables);
  const context = { qualifiers, bestThirds, winners: {}, losers: {}, usedBestThirdGroups: new Set() };

  const rounds = {};

  getKnockoutMatches(matches).forEach((match) => {
    const prediction = getPrediction(entry, match.matchNumber);
    const resolvedHomeTeam = resolvePlaceholder(match.homeTeam, context);
    const resolvedAwayTeam = resolvePlaceholder(match.awayTeam, context);
    const homeTeam = prediction.predictedHomeTeam || resolvedHomeTeam;
    const awayTeam = prediction.predictedAwayTeam || resolvedAwayTeam;
    const winner = getPredictedWinner(prediction, homeTeam, awayTeam);
    const loser = winner && winner === homeTeam ? awayTeam : winner && winner === awayTeam ? homeTeam : '';

    context.winners[match.matchNumber] = winner;
    context.losers[match.matchNumber] = loser;

    const projected = { ...match, homeTeam, awayTeam, prediction, winner, loser };
    rounds[match.stage] = [...(rounds[match.stage] ?? []), projected];
  });

  const finalMatch = rounds.Final?.[0];
  const thirdMatch = rounds['Tercer puesto']?.[0];

  return {
    groupTables,
    qualifiers,
    bestThirds,
    rounds,
    finalResults: {
      champion: finalMatch?.winner ?? '',
      second: finalMatch?.loser ?? '',
      third: thirdMatch?.winner ?? '',
      fourth: thirdMatch?.loser ?? ''
    }
  };
};

export const validateTournamentEntry = (matches, entry) => {
  const missing = [];
  getGroupMatches(matches).forEach((match) => {
    if (!hasScore(getPrediction(entry, match.matchNumber))) missing.push(`Falta marcador del partido #${match.matchNumber}`);
  });

  const bracket = buildBracket(matches, entry);
  getKnockoutMatches(matches).forEach((match) => {
    const projected = Object.values(bracket.rounds).flat().find((item) => item.matchNumber === match.matchNumber);
    const prediction = getPrediction(entry, match.matchNumber);
    if (!isKnockoutPredictionComplete(prediction, projected?.homeTeam, projected?.awayTeam)) {
      missing.push(`Falta llave o ganador del partido #${match.matchNumber}`);
    }
  });

  Object.entries(bracket.finalResults).forEach(([key, value]) => {
    if (!value) missing.push(`Falta ${key}`);
  });

  return { complete: missing.length === 0, missing, bracket };
};

export const createEmptyTournamentEntry = () => ({
  matchPredictions: {},
  tieBreakOrders: {},
  submittedAt: '',
  complete: false,
  finalResults: {}
});

export const updateTournamentMatchPrediction = (entry, matchNumber, field, value) => {
  const current = entry ?? createEmptyTournamentEntry();
  const currentPrediction = current.matchPredictions?.[matchNumber] ?? {};
  const nextPrediction = {
    ...currentPrediction,
    [field]: field === 'homeScore' || field === 'awayScore' ? normalizeScore(value) : value
  };

  if (nextPrediction.homeScore !== '' && nextPrediction.awayScore !== '' && Number(nextPrediction.homeScore) !== Number(nextPrediction.awayScore)) {
    nextPrediction.penaltyWinner = '';
  }

  return {
    ...current,
    matchPredictions: {
      ...(current.matchPredictions ?? {}),
      [matchNumber]: nextPrediction
    }
  };
};
