import { buildBracket, createEmptyTournamentEntry } from './tournament.js';

const stageMap = {
  grupo: 'Fase de grupos',
  dieciseisavos: 'Dieciseisavos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semifinal: 'Semifinal',
  'tercer puesto': 'Tercer puesto',
  final: 'Final'
};

const finalStageMap = {
  campeon: 'champion',
  subcampeon: 'second',
  'tercer puesto torneo': 'third'
};

const participantDisplayAliases = {
  'sebastian uribe': 'Javier U.'
};

const teamAliases = {
  mexico: 'Mexico',
  'corea del sur': 'South Korea',
  'republica checa': 'Czechia',
  sudafrica: 'South Africa',
  canada: 'Canada',
  suiza: 'Switzerland',
  catar: 'Qatar',
  'bosnia y herzegovina': 'Bosnia and Herzegovina',
  brasil: 'Brazil',
  marruecos: 'Morocco',
  haiti: 'Haiti',
  escocia: 'Scotland',
  'estados unidos': 'United States',
  paraguay: 'Paraguay',
  australia: 'Australia',
  turquia: 'Turkey',
  alemania: 'Germany',
  curazao: 'Curaçao',
  'costa de marfil': 'Ivory Coast',
  ecuador: 'Ecuador',
  'paises bajos': 'Netherlands',
  japon: 'Japan',
  suecia: 'Sweden',
  tunez: 'Tunisia',
  belgica: 'Belgium',
  egipto: 'Egypt',
  iran: 'Iran',
  'nueva zelanda': 'New Zealand',
  espana: 'Spain',
  'cabo verde': 'Cape Verde',
  'arabia saudita': 'Saudi Arabia',
  uruguay: 'Uruguay',
  francia: 'France',
  senegal: 'Senegal',
  noruega: 'Norway',
  irak: 'Iraq',
  argentina: 'Argentina',
  argelia: 'Algeria',
  austria: 'Austria',
  jordania: 'Jordan',
  colombia: 'Colombia',
  portugal: 'Portugal',
  'rd congo': 'DR Congo',
  uzbekistan: 'Uzbekistan',
  inglaterra: 'England',
  croacia: 'Croatia',
  ghana: 'Ghana',
  panama: 'Panama'
};

export const normalizeMasterText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeTeam = (value) => teamAliases[normalizeMasterText(value)] ?? String(value ?? '').trim();

const displayParticipantName = (value) => participantDisplayAliases[normalizeMasterText(value)] ?? String(value ?? '').trim();

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

export const parseMasterCsv = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, '').trim());
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    return {
      rowNumber: index + 2,
      raw: Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? '']))
    };
  });
};

const normalizeStage = (stage) => stageMap[normalizeMasterText(stage)] ?? String(stage ?? '').trim();

const normalizeMethod = (method) => {
  const normalized = normalizeMasterText(method);
  if (!normalized) return '';
  if (normalized.includes('penal')) return 'penalties';
  if (normalized.includes('prorroga')) return 'extraTime';
  return 'regulation';
};

const parseScore = (value) => {
  const normalized = String(value ?? '').trim();
  if (normalized === '') return null;
  const number = Number(normalized);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

const getLoser = (homeTeam, awayTeam, winner) => {
  if (!winner) return '';
  if (normalizeMasterText(winner) === normalizeMasterText(homeTeam)) return awayTeam;
  if (normalizeMasterText(winner) === normalizeMasterText(awayTeam)) return homeTeam;
  return '';
};

const createMatchFromRow = (row, existingMatch) => {
  const matchNumber = Number(row.partido_numero);
  const stage = normalizeStage(row.fase);
  return {
    id: existingMatch?.id ?? `match-${matchNumber}`,
    matchNumber,
    date: existingMatch?.date ?? '',
    time: existingMatch?.time ?? '',
    stage,
    group: row.grupo || existingMatch?.group || '',
    homeTeam: existingMatch?.homeTeam || normalizeTeam(row.equipo_local),
    awayTeam: existingMatch?.awayTeam || normalizeTeam(row.equipo_visitante),
    stadium: existingMatch?.stadium ?? '',
    city: existingMatch?.city ?? '',
    realHomeScore: existingMatch?.realHomeScore ?? '',
    realAwayScore: existingMatch?.realAwayScore ?? '',
    qualifiedTeam: existingMatch?.qualifiedTeam ?? '',
    classificationMethod: existingMatch?.classificationMethod ?? '',
    status: existingMatch?.status ?? 'pendiente'
  };
};

const makeTeamPairKey = (homeTeam, awayTeam) => `${normalizeMasterText(homeTeam)}|${normalizeMasterText(awayTeam)}`;

const buildGroupMatchLookup = (existingMatches) => {
  const lookup = new Map();
  existingMatches
    .filter((match) => match.stage === 'Fase de grupos')
    .forEach((match) => {
      lookup.set(makeTeamPairKey(match.homeTeam, match.awayTeam), match);
    });
  return lookup;
};

const resolveMasterMatch = (raw, existingMatches, groupLookup) => {
  const stage = normalizeStage(raw.fase);
  if (stage === 'Fase de grupos') {
    const match = groupLookup.get(makeTeamPairKey(normalizeTeam(raw.equipo_local), normalizeTeam(raw.equipo_visitante)));
    if (match) return match;
  }
  return existingMatches.find((match) => Number(match.matchNumber) === Number(raw.partido_numero));
};

export const validateMasterCsv = ({ csvText, existingMatches = [] }) => {
  const rows = parseMasterCsv(csvText);
  const errors = [];
  const warnings = [];
  const participantNames = new Map();
  const participantRows = new Map();
  const predictionKeys = new Set();
  const duplicatePredictions = [];
  const matchDefinitions = new Map();
  const invalidScores = [];
  const emptyScores = [];
  const knockoutDrawsWithoutWinner = [];
  const knockoutWithoutQualified = [];
  const groupLookup = buildGroupMatchLookup(existingMatches);

  rows.forEach(({ rowNumber, raw }) => {
    const participantName = String(raw.participante ?? '').trim();
    if (!participantName) {
      errors.push(`Fila ${rowNumber}: falta participante.`);
      return;
    }

    const participantKey = normalizeMasterText(participantName);
    participantNames.set(participantKey, [...(participantNames.get(participantKey) ?? []), participantName]);
    participantRows.set(participantKey, (participantRows.get(participantKey) ?? 0) + (raw.tipo_registro === 'partido' ? 1 : 0));

    if (raw.tipo_registro !== 'partido') return;

    const stage = normalizeStage(raw.fase);
    const homeTeam = normalizeTeam(raw.equipo_local);
    const awayTeam = normalizeTeam(raw.equipo_visitante);
    const resolvedMatch = resolveMasterMatch(raw, existingMatches, groupLookup);
    const matchNumber = resolvedMatch?.matchNumber ?? Number(raw.partido_numero);
    const predictionKey = `${participantKey}-${matchNumber}`;
    const homeScore = parseScore(raw.goles_local);
    const awayScore = parseScore(raw.goles_visitante);
    const qualifiedTeam = normalizeTeam(raw.clasificado);
    const penaltyWinner = normalizeTeam(raw.ganador_penales);

    if (!Number.isInteger(matchNumber) || matchNumber <= 0) errors.push(`Fila ${rowNumber}: partido_numero invalido.`);
    if (stage === 'Fase de grupos' && !resolvedMatch) {
      errors.push(`Fila ${rowNumber}: partido de grupos no encontrado en calendario oficial (${homeTeam} vs ${awayTeam}).`);
    }
    if (predictionKeys.has(predictionKey)) duplicatePredictions.push(`Fila ${rowNumber}: ${participantName} partido ${matchNumber}.`);
    predictionKeys.add(predictionKey);

    if (raw.goles_local === '' || raw.goles_visitante === '') emptyScores.push(`Fila ${rowNumber}: marcador vacio.`);
    if (homeScore === null || awayScore === null) invalidScores.push(`Fila ${rowNumber}: marcador invalido.`);

    if (stage !== 'Fase de grupos') {
      if (!qualifiedTeam) knockoutWithoutQualified.push(`Fila ${rowNumber}: eliminatoria sin clasificado.`);
      if (homeScore !== null && awayScore !== null && homeScore === awayScore && !penaltyWinner && !qualifiedTeam) {
        knockoutDrawsWithoutWinner.push(`Fila ${rowNumber}: empate eliminatorio sin ganador/clasificado.`);
      }
    }

    const definitionKey = String(matchNumber);
    const definition = [
      resolvedMatch?.stage ?? stage,
      resolvedMatch?.group ?? raw.grupo,
      resolvedMatch?.homeTeam ?? homeTeam,
      resolvedMatch?.awayTeam ?? awayTeam
    ].join('|');
    const currentDefinitions = matchDefinitions.get(definitionKey) ?? new Set();
    currentDefinitions.add(definition);
    matchDefinitions.set(definitionKey, currentDefinitions);
  });

  const duplicatedParticipants = [...participantNames.entries()]
    .filter(([, names]) => new Set(names).size > 1)
    .map(([key, names]) => `${key}: ${[...new Set(names)].join(' / ')}`);

  const expectedCounts = [...new Set(participantRows.values())].filter((count) => count > 0);
  const incompleteParticipants = expectedCounts.length <= 1
    ? []
    : [...participantRows.entries()].map(([key, count]) => `${key}: ${count} partidos`);

  const duplicatedMatches = [...matchDefinitions.entries()]
    .filter(([matchNumber, definitions]) => Number(matchNumber) <= 72 && definitions.size > 1)
    .map(([matchNumber]) => `Partido ${matchNumber} tiene equipos inconsistentes en fase de grupos.`);

  const knockoutVariableMatches = [...matchDefinitions.entries()]
    .filter(([matchNumber, definitions]) => Number(matchNumber) > 72 && definitions.size > 1).length;
  if (knockoutVariableMatches) {
    warnings.push(`${knockoutVariableMatches} partidos eliminatorios tienen equipos distintos por participante; se guardan como llaves pronosticadas.`);
  }

  errors.push(...duplicatedParticipants.map((item) => `Participante duplicado: ${item}`));
  errors.push(...duplicatePredictions);
  errors.push(...duplicatedMatches);
  errors.push(...incompleteParticipants.map((item) => `Participante con cantidad distinta de partidos: ${item}`));
  errors.push(...emptyScores);
  errors.push(...invalidScores);
  errors.push(...knockoutWithoutQualified);
  errors.push(...knockoutDrawsWithoutWinner);

  const partyRows = rows.filter(({ raw }) => raw.tipo_registro === 'partido');
  const finalRows = rows.filter(({ raw }) => raw.tipo_registro === 'pronostico_final');

  return {
    ok: errors.length === 0,
    rows,
    summary: {
      participantCount: participantNames.size,
      matchCount: new Set(partyRows.map(({ raw }) => raw.partido_numero)).size,
      predictionsCount: partyRows.length,
      finalPredictionCount: finalRows.length,
      matchesPerParticipant: expectedCounts.length === 1 ? expectedCounts[0] : 'Variable',
      errors,
      warnings,
      duplicatedParticipants,
      duplicatedMatches,
      duplicatePredictions,
      incompleteParticipants,
      invalidScores,
      emptyScores,
      knockoutWithoutQualified,
      knockoutDrawsWithoutWinner,
      existingData: existingMatches.length
    }
  };
};

export const buildMasterImportState = ({ csvText, existingMatches = [], settings }) => {
  const validation = validateMasterCsv({ csvText, existingMatches });
  if (!validation.ok) return { validation };

  const participants = [];
  const participantByKey = new Map();
  const matchesByNumber = new Map(existingMatches.map((match) => [Number(match.matchNumber), match]));
  const tournamentEntries = {};
  const predictions = [];
  const finalPredictions = {};
  const groupLookup = buildGroupMatchLookup(existingMatches);

  validation.rows.forEach(({ raw }) => {
    const participantName = String(raw.participante ?? '').trim();
    const participantKey = normalizeMasterText(participantName);
    if (!participantByKey.has(participantKey)) {
      const participant = {
        id: `p${participants.length + 1}`,
        name: displayParticipantName(participantName),
        email: '',
        phone: '',
        paid: true,
        paymentMethod: ''
      };
      participantByKey.set(participantKey, participant);
      participants.push(participant);
      tournamentEntries[participant.id] = createEmptyTournamentEntry();
    }
  });

  validation.rows.forEach(({ raw }) => {
    const participant = participantByKey.get(normalizeMasterText(raw.participante));
    if (!participant) return;

    if (raw.tipo_registro === 'pronostico_final') {
      const field = finalStageMap[normalizeMasterText(raw.fase)];
      if (field) {
        finalPredictions[participant.id] = {
          ...(finalPredictions[participant.id] ?? {}),
          [field]: normalizeTeam(raw.clasificado)
        };
      }
      return;
    }

    if (raw.tipo_registro !== 'partido') return;

    const resolvedMatch = resolveMasterMatch(raw, existingMatches, groupLookup);
    const matchNumber = Number(resolvedMatch?.matchNumber ?? raw.partido_numero);
    const existingMatch = matchesByNumber.get(matchNumber) ?? resolvedMatch;
    if (!existingMatch) matchesByNumber.set(matchNumber, createMatchFromRow(raw, existingMatch));

    const match = matchesByNumber.get(matchNumber);
    const homeTeam = normalizeTeam(raw.equipo_local);
    const awayTeam = normalizeTeam(raw.equipo_visitante);
    const homeScore = Number(raw.goles_local);
    const awayScore = Number(raw.goles_visitante);
    const qualifiedTeam = normalizeTeam(raw.clasificado);
    const penaltyWinner = normalizeTeam(raw.ganador_penales);
    const prediction = {
      homeScore,
      awayScore,
      penaltyWinner,
      qualifiedTeam,
      predictedHomeTeam: homeTeam,
      predictedAwayTeam: awayTeam,
      classificationMethod: normalizeMethod(raw.metodo_clasificacion)
    };

    tournamentEntries[participant.id] = {
      ...tournamentEntries[participant.id],
      matchPredictions: {
        ...(tournamentEntries[participant.id].matchPredictions ?? {}),
        [matchNumber]: prediction
      }
    };

    predictions.push({
      id: `master-${participant.id}-${match.id}`,
      participantId: participant.id,
      matchId: match.id,
      homeScore,
      awayScore,
      qualifiedTeam,
      penaltyWinner,
      predictedHomeTeam: homeTeam,
      predictedAwayTeam: awayTeam,
      createdAt: new Date().toISOString()
    });
  });

  Object.entries(tournamentEntries).forEach(([participantId, entry]) => {
    const bracket = buildBracket([...matchesByNumber.values()], entry);
    const finalPrediction = finalPredictions[participantId] ?? {};
    const thirdMatch = entry.matchPredictions?.[103];
    const fourth = thirdMatch
      ? getLoser(thirdMatch.predictedHomeTeam, thirdMatch.predictedAwayTeam, thirdMatch.qualifiedTeam)
      : '';

    tournamentEntries[participantId] = {
      ...entry,
      complete: Object.keys(entry.matchPredictions ?? {}).length >= 104,
      submittedAt: new Date().toISOString(),
      finalResults: {
        champion: finalPrediction.champion ?? bracket.finalResults.champion,
        second: finalPrediction.second ?? bracket.finalResults.second,
        third: finalPrediction.third ?? bracket.finalResults.third,
        fourth: finalPrediction.fourth ?? fourth
      },
      importedBracket: Object.values(entry.matchPredictions ?? {})
        .filter((prediction) => prediction.predictedHomeTeam && prediction.predictedAwayTeam)
        .map((prediction) => ({
          homeTeam: prediction.predictedHomeTeam,
          awayTeam: prediction.predictedAwayTeam,
          qualifiedTeam: prediction.qualifiedTeam
        }))
    };

    finalPredictions[participantId] = tournamentEntries[participantId].finalResults;
  });

  const audit = {
    id: `audit-${Date.now()}`,
    createdAt: new Date().toISOString(),
    type: 'csv-maestro',
    participantCount: participants.length,
    matchCount: matchesByNumber.size,
    predictionsCount: predictions.length,
    errors: validation.summary.errors,
    warnings: validation.summary.warnings
  };

  return {
    validation,
    state: {
      participants,
      matches: [...matchesByNumber.values()].sort((a, b) => Number(a.matchNumber) - Number(b.matchNumber)),
      predictions,
      tournamentEntries,
      finalPredictions,
      finalResults: { champion: '', second: '', third: '', fourth: '' },
      settings,
      importAudits: [audit]
    },
    audit
  };
};
