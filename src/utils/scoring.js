const canonicalTeams = {
  mexico: 'mexico',
  'corea del sur': 'south korea',
  'south korea': 'south korea',
  'republica checa': 'czechia',
  czechia: 'czechia',
  sudafrica: 'south africa',
  'south africa': 'south africa',
  canada: 'canada',
  suiza: 'switzerland',
  switzerland: 'switzerland',
  catar: 'qatar',
  qatar: 'qatar',
  'bosnia y herzegovina': 'bosnia and herzegovina',
  'bosnia and herzegovina': 'bosnia and herzegovina',
  brasil: 'brazil',
  brazil: 'brazil',
  marruecos: 'morocco',
  morocco: 'morocco',
  haiti: 'haiti',
  escocia: 'scotland',
  scotland: 'scotland',
  'estados unidos': 'united states',
  'united states': 'united states',
  paraguay: 'paraguay',
  australia: 'australia',
  turquia: 'turkey',
  turkey: 'turkey',
  alemania: 'germany',
  germany: 'germany',
  curazao: 'curacao',
  curacao: 'curacao',
  'costa de marfil': 'ivory coast',
  'ivory coast': 'ivory coast',
  ecuador: 'ecuador',
  'paises bajos': 'netherlands',
  netherlands: 'netherlands',
  japon: 'japan',
  japan: 'japan',
  suecia: 'sweden',
  sweden: 'sweden',
  tunez: 'tunisia',
  tunisia: 'tunisia',
  belgica: 'belgium',
  belgium: 'belgium',
  egipto: 'egypt',
  egypt: 'egypt',
  iran: 'iran',
  'nueva zelanda': 'new zealand',
  'new zealand': 'new zealand',
  espana: 'spain',
  spain: 'spain',
  'cabo verde': 'cape verde',
  'cape verde': 'cape verde',
  'arabia saudita': 'saudi arabia',
  'saudi arabia': 'saudi arabia',
  uruguay: 'uruguay',
  francia: 'france',
  france: 'france',
  senegal: 'senegal',
  noruega: 'norway',
  norway: 'norway',
  irak: 'iraq',
  iraq: 'iraq',
  argentina: 'argentina',
  argelia: 'algeria',
  algeria: 'algeria',
  austria: 'austria',
  jordania: 'jordan',
  jordan: 'jordan',
  colombia: 'colombia',
  portugal: 'portugal',
  'rd congo': 'dr congo',
  'dr congo': 'dr congo',
  uzbekistan: 'uzbekistan',
  inglaterra: 'england',
  england: 'england',
  croacia: 'croatia',
  croatia: 'croatia',
  ghana: 'ghana',
  panama: 'panama'
};

const normalize = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return canonicalTeams[normalized] ?? normalized;
};

const outcome = (home, away) => {
  if (Number(home) > Number(away)) return 'home';
  if (Number(home) < Number(away)) return 'away';
  return 'draw';
};

const isGroupStage = (stage) => stage === 'Fase de grupos';

const isSameTeam = (a, b) => normalize(a) !== '' && normalize(a) === normalize(b);

const isPlaceholderTeam = (team) => {
  const value = normalize(team);
  if (!value) return true;
  return /^(tbd|a definir|por definir|sin definir|clasificado|ganador|winner|segundo|runner-up|mejor tercero|best 3rd|grupo)/.test(value);
};

const getPredictedTeams = (prediction, match) => ({
  home: prediction?.predictedHomeTeam || match.homeTeam,
  away: prediction?.predictedAwayTeam || match.awayTeam
});

const teamKey = (team) => normalize(team);

const pairKey = (teamA, teamB) => [teamKey(teamA), teamKey(teamB)].filter(Boolean).sort().join('|');

const getPairScore = (homeTeam, awayTeam, homeScore, awayScore) => ({
  [teamKey(homeTeam)]: Number(homeScore),
  [teamKey(awayTeam)]: Number(awayScore)
});

const scoresMatchByTeam = (prediction, realMatch) => {
  const predictedTeams = getPredictedTeams(prediction, realMatch);
  const realScore = getPairScore(realMatch.homeTeam, realMatch.awayTeam, realMatch.realHomeScore, realMatch.realAwayScore);
  const predictedScore = getPairScore(predictedTeams.home, predictedTeams.away, prediction.homeScore, prediction.awayScore);
  const teams = [teamKey(realMatch.homeTeam), teamKey(realMatch.awayTeam)];

  return teams.every((team) => realScore[team] === predictedScore[team]);
};

export const isKnockoutStage = (stage) => !isGroupStage(stage);

export const isPredictionDraw = (prediction) =>
  prediction?.homeScore !== '' &&
  prediction?.awayScore !== '' &&
  Number(prediction?.homeScore) === Number(prediction?.awayScore);

export const getPredictedQualifiedTeam = (prediction, match) => {
  if (!prediction) return '';

  const teams = getPredictedTeams(prediction, match);
  const homeScore = prediction.homeScore;
  const awayScore = prediction.awayScore;

  if (homeScore === '' || awayScore === '') return '';
  if (Number(homeScore) > Number(awayScore)) return teams.home;
  if (Number(homeScore) < Number(awayScore)) return teams.away;
  return prediction.penaltyWinner || '';
};

export const isPredictionComplete = (prediction, match) => {
  if (!prediction) return false;
  if (prediction.homeScore === '' || prediction.awayScore === '') return false;
  if (isKnockoutStage(match.stage) && isPredictionDraw(prediction)) return Boolean(prediction.penaltyWinner);
  return true;
};

const isBracketHit = (prediction, match) => {
  const teams = getPredictedTeams(prediction, match);
  const predictedTeams = [normalize(teams.home), normalize(teams.away)]
    .filter(Boolean)
    .sort();
  const realTeams = [normalize(match.homeTeam), normalize(match.awayTeam)].filter(Boolean).sort();
  return predictedTeams.length === 2 && predictedTeams[0] === realTeams[0] && predictedTeams[1] === realTeams[1];
};

export const isExactBracketPrediction = (prediction, match) =>
  !isGroupStage(match?.stage) && isRealBracketKnown(match) && isBracketHit(prediction, match);

const isSamePredictionStage = (prediction, match) => {
  const predictionStage = prediction?.stage || prediction?.phase || '';
  return !predictionStage || normalize(predictionStage) === normalize(match?.stage);
};

const hasPredictionScore = (prediction) =>
  prediction?.homeScore !== '' &&
  prediction?.homeScore !== null &&
  prediction?.homeScore !== undefined &&
  prediction?.awayScore !== '' &&
  prediction?.awayScore !== null &&
  prediction?.awayScore !== undefined;

export const getPredictionScoreKeyForMatch = (prediction, match) => {
  if (!prediction || !match || !hasPredictionScore(prediction)) return '';
  if (isGroupStage(match.stage)) return `${prediction.homeScore}-${prediction.awayScore}`;

  const predictedTeams = getPredictedTeams(prediction, match);
  const predictedScore = getPairScore(predictedTeams.home, predictedTeams.away, prediction.homeScore, prediction.awayScore);
  const homeKey = teamKey(match.homeTeam);
  const awayKey = teamKey(match.awayTeam);

  if (predictedScore[homeKey] === undefined || predictedScore[awayKey] === undefined) {
    return `${prediction.homeScore}-${prediction.awayScore}`;
  }

  return `${predictedScore[homeKey]}-${predictedScore[awayKey]}`;
};

export const getPredictionsForMatchDistribution = (match, predictions) => {
  if (!match) return [];
  const matchPredictions = predictions.filter((prediction) => prediction.matchId === match.id);
  if (isGroupStage(match.stage)) return matchPredictions;

  if (!isRealBracketKnown(match)) return [];

  const exactBracketPredictions = predictions.filter(
    (prediction) => isSamePredictionStage(prediction, match) && isExactBracketPrediction(prediction, match)
  );
  const uniqueByParticipant = new Map();

  exactBracketPredictions.forEach((prediction) => {
    const key = prediction.participantId || prediction.id;
    const current = uniqueByParticipant.get(key);

    if (!current || (prediction.matchId === match.id && current.matchId !== match.id)) {
      uniqueByParticipant.set(key, prediction);
    }
  });

  return [...uniqueByParticipant.values()];
};

export const isMatchScorable = (match) =>
  match.status === 'jugado' &&
  match.realHomeScore !== '' &&
  match.realAwayScore !== '';

const isRealBracketKnown = (match) =>
  !isGroupStage(match.stage) &&
  !isPlaceholderTeam(match.homeTeam) &&
  !isPlaceholderTeam(match.awayTeam);

export const knockoutPhaseOrder = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercer puesto', 'Final'];

export const knockoutPhaseMatchCounts = {
  Dieciseisavos: 16,
  Octavos: 8,
  Cuartos: 4,
  Semifinal: 2,
  'Tercer puesto': 1,
  Final: 1
};

export const getKnockoutPhaseReadiness = (matches, stage) => {
  const expected = knockoutPhaseMatchCounts[stage] ?? 0;
  const phaseMatches = matches.filter((match) => match.stage === stage);
  const defined = phaseMatches.filter(isRealBracketKnown).length;

  return {
    defined,
    expected,
    ready: expected > 0 && phaseMatches.length >= expected && defined >= expected,
    total: phaseMatches.length
  };
};

export const isKnockoutPhaseActivated = (settings, stage) =>
  Boolean(settings?.knockoutPhaseActivation?.[stage]);

export const calculatePredictionBreakdown = (prediction, match, settings) => {
  const empty = {
    total: 0,
    groupPoints: 0,
    knockoutPoints: 0,
    finalPoints: 0,
    exactScoreHit: false,
    resultHit: false,
    bracketHit: false,
    qualifiedTeamHit: false
  };

  if (!prediction || prediction.excludedFromScoring) return empty;

  const matchScorable = isMatchScorable(match);
  const realBracketKnown = isRealBracketKnown(match);

  if (isGroupStage(match.stage) && !matchScorable) return empty;
  if (!isGroupStage(match.stage) && !isKnockoutPhaseActivated(settings, match.stage)) return empty;
  if (!isGroupStage(match.stage) && !realBracketKnown) return empty;

  const phaseRules = settings.scoring[match.stage] ?? settings.scoring['Fase de grupos'];
  const predictedHome = Number(prediction.homeScore);
  const predictedAway = Number(prediction.awayScore);
  const realHome = Number(match.realHomeScore);
  const realAway = Number(match.realAwayScore);
  const exactScoreHit = isGroupStage(match.stage)
    ? predictedHome === realHome && predictedAway === realAway
    : matchScorable && scoresMatchByTeam(prediction, match);
  const resultHit = matchScorable && outcome(predictedHome, predictedAway) === outcome(realHome, realAway);
  const predictedTeamsForMatch = getPredictedTeams(prediction, match);
  const realTeamKeysForMatch = [teamKey(match.homeTeam), teamKey(match.awayTeam)].filter(Boolean);
  const predictedTeamKeysForMatch = [teamKey(predictedTeamsForMatch.home), teamKey(predictedTeamsForMatch.away)]
    .filter(Boolean)
    .filter((team) => !isPlaceholderTeam(team));
  const qualifiedTeamHitCount = !isGroupStage(match.stage) && realBracketKnown
    ? new Set(predictedTeamKeysForMatch.filter((team) => realTeamKeysForMatch.includes(team))).size
    : 0;
  const qualifiedTeamHit = qualifiedTeamHitCount > 0;
  const baseBracketHit = isGroupStage(match.stage) ? true : isBracketHit(prediction, match);
  const bracketHit = realBracketKnown && baseBracketHit;

  let total = 0;

  if (isGroupStage(match.stage)) {
    if (resultHit) total += phaseRules.result;
    if (exactScoreHit) total += phaseRules.exactScore;
  } else {
    if (qualifiedTeamHitCount) total += Number(phaseRules.qualifiedTeam ?? 0) * qualifiedTeamHitCount;
    if (bracketHit) total += phaseRules.bracket;
    if (realBracketKnown && baseBracketHit && exactScoreHit) total += phaseRules.exactScore;
  }

  return {
    total,
    groupPoints: isGroupStage(match.stage) ? total : 0,
    knockoutPoints: isGroupStage(match.stage) ? 0 : total,
    finalPoints: 0,
    exactScoreHit: isGroupStage(match.stage) ? exactScoreHit : realBracketKnown && baseBracketHit && exactScoreHit,
    resultHit,
    bracketHit: !isGroupStage(match.stage) && realBracketKnown && bracketHit,
    qualifiedTeamHit
  };
};

export const calculatePredictionPoints = (prediction, match, settings) =>
  calculatePredictionBreakdown(prediction, match, settings).total;

export const calculateKnockoutPhaseBreakdown = (participantPredictions, matches, settings) => {
  const detailsByPhase = {};
  const matchesById = new Map(matches.map((match) => [match.id, match]));

  const knockoutMatches = matches.filter(
    (match) => isRealBracketKnown(match) && isKnockoutPhaseActivated(settings, match.stage)
  );

  const realTeamsByPhase = knockoutMatches.reduce((acc, match) => {
    const current = acc.get(match.stage) ?? new Map();
    [match.homeTeam, match.awayTeam].forEach((team) => {
      const key = teamKey(team);
      if (key && !isPlaceholderTeam(key)) current.set(key, team);
    });
    acc.set(match.stage, current);
    return acc;
  }, new Map());

  const getPhaseDetail = (stage) => {
    if (!detailsByPhase[stage]) {
      detailsByPhase[stage] = {
        fase: stage,
        puntos_clasificados: 0,
        puntos_llaves: 0,
        puntos_marcadores: 0,
        puntos_total_fase: 0,
        exactScoreHits: 0,
        bracketHits: 0,
        qualifiedTeamHits: 0,
        detail: [],
        countedQualifiedTeams: new Set(),
        countedBracketMatches: new Set(),
        countedScoreMatches: new Set()
      };
    }

    return detailsByPhase[stage];
  };

  participantPredictions
    .filter((prediction) => !prediction.excludedFromScoring)
    .forEach((prediction) => {
      const match = matchesById.get(prediction.matchId);
      if (!match || isGroupStage(match.stage) || !isKnockoutPhaseActivated(settings, match.stage)) return;

      const phaseRules = settings.scoring[match.stage] ?? {};
      const predictedTeams = getPredictedTeams(prediction, match);
      const predictedTeamKeys = [teamKey(predictedTeams.home), teamKey(predictedTeams.away)]
        .filter(Boolean)
        .filter((team) => !isPlaceholderTeam(team));
      const realTeamsForPhase = realTeamsByPhase.get(match.stage) ?? new Map();
      const realBracketKnown = isRealBracketKnown(match);

      if (!realTeamsForPhase.size && !realBracketKnown) return;

      const phaseDetail = getPhaseDetail(match.stage);

      predictedTeamKeys.forEach((predictedTeamKey) => {
        if (!realTeamsForPhase.has(predictedTeamKey) || phaseDetail.countedQualifiedTeams.has(predictedTeamKey)) return;

        phaseDetail.countedQualifiedTeams.add(predictedTeamKey);
        phaseDetail.qualifiedTeamHits += 1;
        phaseDetail.puntos_clasificados += Number(phaseRules.qualifiedTeam ?? 0);
        phaseDetail.detail.push({
          tipo: 'clasificado',
          equipo: realTeamsForPhase.get(predictedTeamKey),
          puntos: Number(phaseRules.qualifiedTeam ?? 0)
        });
      });

      if (!realBracketKnown) return;

      const realTeams = [match.homeTeam, match.awayTeam].filter(Boolean);
      const realPairKey = pairKey(match.homeTeam, match.awayTeam);
      const predictedPairKey = pairKey(predictedTeams.home, predictedTeams.away);
      const matchScorable = isMatchScorable(match);

      if (
        realTeams.length !== 2 ||
        !realPairKey ||
        predictedPairKey !== realPairKey ||
        phaseDetail.countedBracketMatches.has(match.id)
      ) {
        return;
      }

      phaseDetail.countedBracketMatches.add(match.id);
      phaseDetail.bracketHits += 1;
      phaseDetail.puntos_llaves += Number(phaseRules.bracket ?? 0);
      phaseDetail.detail.push({
        tipo: 'llave',
        equipos: realTeams,
        puntos: Number(phaseRules.bracket ?? 0)
      });

      if (
        matchScorable &&
        !phaseDetail.countedScoreMatches.has(match.id) &&
        prediction.homeScore !== '' &&
        prediction.awayScore !== '' &&
        scoresMatchByTeam(prediction, match)
      ) {
        phaseDetail.countedScoreMatches.add(match.id);
        phaseDetail.exactScoreHits += 1;
        phaseDetail.puntos_marcadores += Number(phaseRules.exactScore ?? 0);
        phaseDetail.detail.push({
          tipo: 'marcador',
          equipos: realTeams,
          marcador_real: `${match.realHomeScore}-${match.realAwayScore}`,
          marcador_predicho: `${prediction.homeScore}-${prediction.awayScore}`,
          puntos: Number(phaseRules.exactScore ?? 0)
        });
      }
    });

  const phases = Object.values(detailsByPhase).map((phaseDetail) => {
    phaseDetail.puntos_total_fase =
      phaseDetail.puntos_clasificados + phaseDetail.puntos_llaves + phaseDetail.puntos_marcadores;

    return {
      fase: phaseDetail.fase,
      puntos_clasificados: phaseDetail.puntos_clasificados,
      puntos_llaves: phaseDetail.puntos_llaves,
      puntos_marcadores: phaseDetail.puntos_marcadores,
      puntos_total_fase: phaseDetail.puntos_total_fase,
      exactScoreHits: phaseDetail.exactScoreHits,
      bracketHits: phaseDetail.bracketHits,
      qualifiedTeamHits: phaseDetail.qualifiedTeamHits,
      detail: phaseDetail.detail
    };
  });

  return phases.reduce(
    (acc, phaseDetail) => {
      acc.total += phaseDetail.puntos_total_fase;
      acc.exactScoreHits += phaseDetail.exactScoreHits;
      acc.bracketHits += phaseDetail.bracketHits;
      acc.qualifiedTeamHits += phaseDetail.qualifiedTeamHits;
      acc.details.push(phaseDetail);
      return acc;
    },
    { total: 0, exactScoreHits: 0, bracketHits: 0, qualifiedTeamHits: 0, details: [] }
  );
};

const finalResultFields = [
  {
    key: 'champion',
    label: 'Campeón',
    pointsKey: 'champion',
    aliases: ['champion', 'winner', 'first', 'firstPlace', 'first_place', 'campeon', 'campeón', 'primerLugar', 'primer_lugar', 'primero', 'ganador'],
    pointAliases: ['champion', 'winner', 'campeon', 'campeón']
  },
  {
    key: 'second',
    label: 'Subcampeón',
    pointsKey: 'second',
    aliases: ['second', 'runnerUp', 'runner_up', 'runner', 'runnerUpTeam', 'secondPlace', 'second_place', 'subcampeon', 'subcampeón', 'segundo', 'segundoLugar', 'segundo_lugar'],
    pointAliases: ['second', 'runnerUp', 'runner_up', 'subcampeon', 'subcampeón']
  },
  {
    key: 'third',
    label: 'Tercer lugar',
    pointsKey: 'third',
    aliases: ['third', 'thirdPlace', 'third_place', 'tercero', 'tercerLugar', 'tercer_lugar', 'tercerPuesto', 'tercer_puesto'],
    pointAliases: ['third', 'thirdPlace', 'third_place', 'tercero']
  },
  {
    key: 'fourth',
    label: 'Cuarto lugar',
    pointsKey: 'fourth',
    aliases: ['fourth', 'fourthPlace', 'fourth_place', 'cuarto', 'cuartoLugar', 'cuarto_lugar', 'cuartoPuesto', 'cuarto_puesto'],
    pointAliases: ['fourth', 'fourthPlace', 'fourth_place', 'cuarto']
  }
];

const firstNonEmpty = (...values) =>
  values.find((value) => String(value ?? '').trim() !== '') ?? '';

const getFinalResultValue = (entry, field) => {
  const source = entry ?? {};
  const nested = source.finalResults ?? {};
  const values = [
    source[field.key],
    nested[field.key],
    ...field.aliases.flatMap((alias) => [source[alias], nested[alias]])
  ];
  return firstNonEmpty(...values);
};

const getFinalResultPoints = (settings, field) => {
  const configuredPoints = firstNonEmpty(
    settings?.finalResultsPoints?.[field.pointsKey],
    ...(field.pointAliases ?? []).map((alias) => settings?.finalResultsPoints?.[alias])
  );

  return Number(configuredPoints || 0);
};

const hasOfficialScore = (match) =>
  match &&
  match.realHomeScore !== '' &&
  match.realHomeScore !== null &&
  match.realHomeScore !== undefined &&
  match.realAwayScore !== '' &&
  match.realAwayScore !== null &&
  match.realAwayScore !== undefined;

const getOfficialQualifiedTeam = (match) =>
  firstNonEmpty(match?.qualifiedTeam, match?.realQualifiedTeam, match?.real_qualified_team);

const getScoreWinnerTeam = (match) => {
  if (!hasOfficialScore(match)) return '';
  if (Number(match.realHomeScore) > Number(match.realAwayScore)) return match.homeTeam;
  if (Number(match.realHomeScore) < Number(match.realAwayScore)) return match.awayTeam;
  return '';
};

const getOfficialWinnerTeam = (match) => {
  const qualifiedTeam = getOfficialQualifiedTeam(match);
  if (qualifiedTeam && !isPlaceholderTeam(qualifiedTeam)) return qualifiedTeam;
  return getScoreWinnerTeam(match);
};

const getOtherMatchTeam = (match, team) => {
  if (!match || !team) return '';
  if (isSameTeam(match.homeTeam, team)) return match.awayTeam;
  if (isSameTeam(match.awayTeam, team)) return match.homeTeam;
  return '';
};

const normalizedMatchStage = (match) => normalize(match?.stage ?? match?.phase);

const isFinalMatchStage = (match) => {
  const stage = normalizedMatchStage(match);
  return stage === 'final' || Number(match?.matchNumber) === 104;
};

const isThirdPlaceMatchStage = (match) => {
  const stage = normalizedMatchStage(match);
  return (
    stage.includes('tercer') ||
    stage.includes('third') ||
    stage.includes('cuarto puesto') ||
    stage.includes('fourth') ||
    Number(match?.matchNumber) === 103
  );
};

const deriveFinalResultsFromMatches = (matches = []) => {
  const finalMatch = matches.find((match) => isFinalMatchStage(match) && hasOfficialScore(match));
  const thirdPlaceMatch = matches.find((match) => isThirdPlaceMatchStage(match) && hasOfficialScore(match));
  const derived = {};

  if (finalMatch) {
    derived.champion = getOfficialWinnerTeam(finalMatch);
    derived.second = getOtherMatchTeam(finalMatch, derived.champion);
  }

  if (thirdPlaceMatch) {
    derived.third = getOfficialWinnerTeam(thirdPlaceMatch);
    derived.fourth = getOtherMatchTeam(thirdPlaceMatch, derived.third);
  }

  return derived;
};

export const resolveFinalResults = (finalResults = {}, matches = []) => {
  const derived = deriveFinalResultsFromMatches(matches);

  return finalResultFields.reduce(
    (acc, field) => ({
      ...acc,
      [field.key]: firstNonEmpty(getFinalResultValue(finalResults, field), derived[field.key])
    }),
    {}
  );
};

export const calculateFinalResultsPoints = (prediction, finalResults, settings) => {
  if (!prediction) return { total: 0, hits: {} };

  const resultDetails = finalResultFields.map((field) => {
    const predictedTeam = getFinalResultValue(prediction, field);
    const officialTeam = getFinalResultValue(finalResults, field);
    const hit = Boolean(officialTeam) && isSameTeam(predictedTeam, officialTeam);
    const points = hit ? getFinalResultPoints(settings, field) : 0;

    return {
      key: field.key,
      tipo: 'resultado_final',
      puesto: field.label,
      equipo: predictedTeam,
      equipo_oficial: officialTeam,
      puntos: points,
      acertado: hit
    };
  });

  const hits = resultDetails.reduce(
    (acc, detail) => ({ ...acc, [detail.key]: detail.acertado }),
    {}
  );
  const total = resultDetails.reduce((sum, detail) => sum + detail.puntos, 0);

  return { total, hits, detail: resultDetails.filter((detail) => detail.acertado) };
};

export const mergeFinalResultEntries = (...entries) =>
  finalResultFields.reduce(
    (acc, field) => ({
      ...acc,
      [field.key]: firstNonEmpty(...entries.map((entry) => getFinalResultValue(entry, field)))
    }),
    {}
  );

export const buildRanking = (
  participants,
  matches,
  predictions,
  finalPredictions = {},
  finalResults = {},
  settings = {},
  tournamentEntries = {}
) => {
  const resolvedFinalResults = resolveFinalResults(finalResults, matches);

  return participants
    .map((participant) => {
      const participantPredictions = predictions.filter((item) => item.participantId === participant.id);
      const groupDetail = {
        fase: 'Fase de grupos',
        puntos_clasificados: 0,
        puntos_llaves: 0,
        puntos_marcadores: 0,
        puntos_resultados: 0,
        puntos_total_fase: 0,
        detail: []
      };

      const stats = participantPredictions.reduce(
        (acc, prediction) => {
          const match = matches.find((item) => item.id === prediction.matchId);
          if (!match) return acc;

          if (!isGroupStage(match.stage)) {
            if (isMatchScorable(match)) acc.predictedMatches += 1;
            return acc;
          }

          const breakdown = calculatePredictionBreakdown(prediction, match, settings);
          acc.totalPoints += breakdown.total;
          acc.groupPoints += breakdown.groupPoints;
          groupDetail.puntos_total_fase += breakdown.groupPoints;
          if (breakdown.resultHit) {
            groupDetail.puntos_resultados += Number(settings.scoring['Fase de grupos']?.result ?? 0);
            groupDetail.detail.push({
              tipo: 'resultado',
              equipos: [match.homeTeam, match.awayTeam],
              puntos: Number(settings.scoring['Fase de grupos']?.result ?? 0)
            });
          }
          if (breakdown.exactScoreHit) {
            groupDetail.puntos_marcadores += Number(settings.scoring['Fase de grupos']?.exactScore ?? 0);
            groupDetail.detail.push({
              tipo: 'marcador',
              equipos: [match.homeTeam, match.awayTeam],
              marcador_real: `${match.realHomeScore}-${match.realAwayScore}`,
              marcador_predicho: `${prediction.homeScore}-${prediction.awayScore}`,
              puntos: Number(settings.scoring['Fase de grupos']?.exactScore ?? 0)
            });
          }
          if (isMatchScorable(match)) acc.predictedMatches += 1;
          if (breakdown.exactScoreHit) acc.exactScores += 1;
          return acc;
        },
        {
          totalPoints: 0,
          groupPoints: 0,
          knockoutPoints: 0,
          finalPoints: 0,
          exactScores: 0,
          bracketHits: 0,
          qualifiedTeamHits: 0,
          predictedMatches: 0,
          pointsDetail: []
        }
      );

      const knockoutScore = calculateKnockoutPhaseBreakdown(participantPredictions, matches, settings);
      stats.knockoutPoints = knockoutScore.total;
      stats.totalPoints += knockoutScore.total;
      stats.exactScores += knockoutScore.exactScoreHits;
      stats.bracketHits += knockoutScore.bracketHits;
      stats.qualifiedTeamHits += knockoutScore.qualifiedTeamHits;
      stats.pointsDetail = [
        ...(groupDetail.puntos_total_fase ? [groupDetail] : []),
        ...knockoutScore.details
      ];

      const finalPrediction = mergeFinalResultEntries(
        tournamentEntries?.[participant.id]?.finalResults,
        tournamentEntries?.[participant.id],
        finalPredictions?.[participant.id]?.finalResults,
        finalPredictions?.[participant.id]
      );
      const finalScore = calculateFinalResultsPoints(finalPrediction, resolvedFinalResults, settings);
      stats.finalPoints = finalScore.total;
      stats.totalPoints += finalScore.total;
      if (finalScore.detail?.length) {
        stats.pointsDetail.push({
          fase: 'Resultados finales',
          puntos_clasificados: 0,
          puntos_llaves: 0,
          puntos_marcadores: 0,
          puntos_resultados: finalScore.total,
          puntos_total_fase: finalScore.total,
          detail: finalScore.detail
        });
      }

      return { ...participant, ...stats };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || b.exactScores - a.exactScores || a.name.localeCompare(b.name))
    .map((participant, index) => ({ ...participant, position: index + 1 }));
};

export const recalcularPuntos = ({ participants, matches, predictions, finalPredictions, finalResults, settings, tournamentEntries }) =>
  buildRanking(participants, matches, predictions, finalPredictions, finalResults, settings, tournamentEntries);

export const calculateCollection = (participants, entryFee) => {
  const paidParticipants = participants.filter((participant) => participant.paid);
  return {
    expectedTotal: participants.length * Number(entryFee),
    paidCount: paidParticipants.length,
    collectedTotal: paidParticipants.length * Number(entryFee)
  };
};

export const calculatePrizes = (ranking, collectedTotal, settings) => {
  const topScore = ranking[0]?.totalPoints ?? 0;
  const firstPlace = ranking.filter((item) => item.totalPoints === topScore);

  if (!ranking.length || collectedTotal <= 0) {
    return { firstPlace: [], secondPlace: [], firstPrize: 0, secondPrize: 0, mode: 'Sin recaudo' };
  }

  if (firstPlace.length > 1) {
    return {
      firstPlace,
      secondPlace: [],
      firstPrize: collectedTotal / firstPlace.length,
      secondPrize: 0,
      mode: 'Empate en primer puesto'
    };
  }

  const secondScore = ranking.find((item) => item.totalPoints < topScore)?.totalPoints;
  const secondPlace = secondScore === undefined ? [] : ranking.filter((item) => item.totalPoints === secondScore);
  const firstPool = collectedTotal * (Number(settings.firstPrizePercent) / 100);
  const secondPool = collectedTotal * (Number(settings.secondPrizePercent) / 100);

  return {
    firstPlace,
    secondPlace,
    firstPrize: firstPool,
    secondPrize: secondPlace.length ? secondPool / secondPlace.length : 0,
    mode: 'Ganador unico'
  };
};

export const getPredictionDistribution = (match, predictions) => {
  const distribution = getPredictionsForMatchDistribution(match, predictions)
    .reduce((acc, prediction) => {
      const key = getPredictionScoreKeyForMatch(prediction, match);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(distribution)
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => b.count - a.count || a.score.localeCompare(b.score));
};
