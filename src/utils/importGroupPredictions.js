import { buildBracket, createEmptyTournamentEntry, getGroupMatches } from './tournament.js';

const predictionHeaders = {
  participant: ['Participante', 'participant'],
  group: ['Grupo', 'group'],
  homeTeam: ['Equipo Local', 'home_team', 'local', 'homeTeam'],
  awayTeam: ['Equipo Visitante', 'away_team', 'visitante', 'awayTeam'],
  homeScore: ['Goles Local', 'pred_home_goals', 'home_goals', 'goles_local'],
  awayScore: ['Goles Visitante', 'pred_away_goals', 'away_goals', 'goles_visitante']
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

const participantAliases = {
  'alexander munevar soraida': 'alexander munar soraida',
  'alexander munevar': 'alexander munar'
};

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeGroup = (value) => String(value ?? '').replace(/grupo/gi, '').trim().toUpperCase();

const normalizeTeam = (value) => teamAliases[normalizeText(value)] ?? String(value ?? '').trim();

const normalizeParticipant = (value) => {
  const normalized = normalizeText(value);
  return participantAliases[normalized] ?? normalized;
};

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

export const parsePredictionCsv = (text) => {
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

const getValue = (row, field) => {
  const keys = predictionHeaders[field];
  const key = keys.find((candidate) => row[candidate] !== undefined);
  return key ? row[key] : '';
};

const buildParticipantIndex = (participants) => {
  const index = new Map();
  participants.forEach((participant) => {
    index.set(normalizeParticipant(participant.name), participant);
  });
  return index;
};

const buildMatchIndex = (matches) => {
  const index = new Map();
  getGroupMatches(matches).forEach((match) => {
    const key = [
      normalizeGroup(match.group),
      normalizeText(match.homeTeam),
      normalizeText(match.awayTeam)
    ].join('|');
    index.set(key, match);
  });
  return index;
};

const createGeneratedBracket = (matches, entry) => {
  const bracket = buildBracket(matches, entry);
  return {
    qualifiers: bracket.qualifiers,
    bestThirds: bracket.bestThirds,
    dieciseisavos: (bracket.rounds.Dieciseisavos ?? []).map((match) => ({
      matchNumber: match.matchNumber,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam
    }))
  };
};

export const getGroupPredictionStatus = (matches, entry) => {
  const missingMatches = getGroupMatches(matches)
    .filter((match) => {
      const prediction = entry?.matchPredictions?.[match.matchNumber];
      return prediction?.homeScore === '' || prediction?.awayScore === '' || prediction?.homeScore === undefined || prediction?.awayScore === undefined;
    })
    .map((match) => ({
      matchNumber: match.matchNumber,
      group: match.group,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam
    }));

  return {
    groupStageComplete: missingMatches.length === 0,
    missingMatches
  };
};

export const reprocessGroupPredictions = (matches, tournamentEntries) =>
  Object.fromEntries(
    Object.entries(tournamentEntries ?? {}).map(([participantId, entry]) => {
      const status = getGroupPredictionStatus(matches, entry);
      return [
        participantId,
        {
          ...entry,
          groupStageComplete: status.groupStageComplete,
          missingGroupMatches: status.missingMatches,
          generatedBracket: status.groupStageComplete ? createGeneratedBracket(matches, entry) : null
        }
      ];
    })
  );

export const importGroupPredictions = ({ csvText, participants, matches, tournamentEntries }) => {
  const rows = parsePredictionCsv(csvText);
  const participantsByName = buildParticipantIndex(participants);
  const matchesByKey = buildMatchIndex(matches);
  const nextEntries = { ...(tournamentEntries ?? {}) };
  const foundParticipants = new Set();
  const notFoundParticipants = new Set();
  const errors = [];
  let imported = 0;
  let updated = 0;

  rows.forEach(({ rowNumber, raw }) => {
    const participantName = getValue(raw, 'participant');
    const participant = participantsByName.get(normalizeParticipant(participantName));
    if (!participant) {
      notFoundParticipants.add(participantName || `Fila ${rowNumber}`);
      errors.push(`Fila ${rowNumber}: participante no encontrado (${participantName || 'sin nombre'}).`);
      return;
    }

    const group = normalizeGroup(getValue(raw, 'group'));
    const homeTeam = normalizeTeam(getValue(raw, 'homeTeam'));
    const awayTeam = normalizeTeam(getValue(raw, 'awayTeam'));
    const matchKey = [group, normalizeText(homeTeam), normalizeText(awayTeam)].join('|');
    const match = matchesByKey.get(matchKey);
    if (!match) {
      errors.push(`Fila ${rowNumber}: partido no encontrado (${group} ${homeTeam} vs ${awayTeam}).`);
      return;
    }

    const homeScore = Number(getValue(raw, 'homeScore'));
    const awayScore = Number(getValue(raw, 'awayScore'));
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      errors.push(`Fila ${rowNumber}: marcador invalido para ${participantName}.`);
      return;
    }

    foundParticipants.add(participant.id);
    const currentEntry = nextEntries[participant.id] ?? createEmptyTournamentEntry();
    const currentPrediction = currentEntry.matchPredictions?.[match.matchNumber];
    const alreadyExists = Boolean(currentPrediction);

    nextEntries[participant.id] = {
      ...currentEntry,
      matchPredictions: {
        ...(currentEntry.matchPredictions ?? {}),
        [match.matchNumber]: {
          ...(currentPrediction ?? {}),
          homeScore,
          awayScore
        }
      }
    };

    if (alreadyExists) updated += 1;
    else imported += 1;
  });

  const reprocessedEntries = reprocessGroupPredictions(matches, nextEntries);
  const incompleteParticipants = participants
    .map((participant) => {
      const entry = reprocessedEntries[participant.id] ?? createEmptyTournamentEntry();
      const status = getGroupPredictionStatus(matches, entry);
      return { participant, ...status };
    })
    .filter((item) => !item.groupStageComplete);

  return {
    tournamentEntries: reprocessedEntries,
    summary: {
      foundParticipantCount: foundParticipants.size,
      foundParticipants: [...foundParticipants],
      notFoundParticipants: [...notFoundParticipants],
      imported,
      updated,
      errors,
      incompleteParticipants
    }
  };
};
