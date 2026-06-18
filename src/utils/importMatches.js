const requiredFields = [
  'match_number',
  'date',
  'time',
  'stage',
  'home_team',
  'away_team',
  'stadium',
  'city',
  'status'
];

const stageMap = {
  'group stage': 'Fase de grupos',
  'round of 32': 'Dieciseisavos',
  'round of 16': 'Octavos',
  'quarter-finals': 'Cuartos',
  quarterfinals: 'Cuartos',
  semifinals: 'Semifinal',
  'semi-finals': 'Semifinal',
  semifinal: 'Semifinal',
  final: 'Final',
  'third place': 'Tercer puesto',
  'third-place': 'Tercer puesto'
};

const statusMap = {
  pending: 'pendiente',
  played: 'jugado',
  finished: 'jugado',
  pendiente: 'pendiente',
  jugado: 'jugado'
};

const classificationMethodMap = {
  '90min': 'regulation',
  regulation: 'regulation',
  'extra-time': 'extraTime',
  extratime: 'extraTime',
  prorroga: 'extraTime',
  penalties: 'penalties',
  penales: 'penalties'
};

const normalizeKey = (key) => key.replace(/^\uFEFF/, '').trim();

const normalizeOptionalScore = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? '' : Number(normalized);
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

const parseCsv = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
};

const parseJson = (text) => {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('El JSON debe ser un arreglo de partidos.');
  return parsed;
};

export const parseMatchFile = (text, filename) => {
  const lowerFilename = filename.toLowerCase();
  if (lowerFilename.endsWith('.json')) return parseJson(text);
  if (lowerFilename.endsWith('.csv')) return parseCsv(text);
  throw new Error('Formato no soportado. Sube un archivo CSV o JSON.');
};

export const normalizeImportedMatch = (rawMatch, rowNumber) => {
  const missingFields = requiredFields.filter((field) => rawMatch[field] === undefined || rawMatch[field] === '');

  if (missingFields.length) {
    return {
      error: `Fila ${rowNumber}: faltan campos requeridos (${missingFields.join(', ')}).`
    };
  }

  const matchNumber = Number(rawMatch.match_number);
  if (!Number.isInteger(matchNumber) || matchNumber <= 0) {
    return { error: `Fila ${rowNumber}: match_number debe ser un numero entero positivo.` };
  }

  const stage = stageMap[String(rawMatch.stage).trim().toLowerCase()] ?? String(rawMatch.stage).trim();
  const status = statusMap[String(rawMatch.status).trim().toLowerCase()] ?? 'pendiente';
  const decidedBy = String(rawMatch.decided_by ?? '').trim().toLowerCase();
  const winner = String(rawMatch.winner ?? '').trim();
  const realHomeScore = normalizeOptionalScore(rawMatch.home_score);
  const realAwayScore = normalizeOptionalScore(rawMatch.away_score);

  return {
    match: {
      id: `match-${matchNumber}`,
      matchNumber,
      date: String(rawMatch.date).trim(),
      time: String(rawMatch.time).trim(),
      stage,
      group: String(rawMatch.group).trim(),
      homeTeam: String(rawMatch.home_team).trim(),
      awayTeam: String(rawMatch.away_team).trim(),
      stadium: String(rawMatch.stadium).trim(),
      city: String(rawMatch.city).trim(),
      realHomeScore,
      realAwayScore,
      qualifiedTeam: winner === 'Draw' ? '' : winner,
      classificationMethod: classificationMethodMap[decidedBy] ?? '',
      status
    }
  };
};

export const importMatches = (rawMatches, existingMatches) => {
  const existingNumbers = new Set(existingMatches.map((match) => Number(match.matchNumber)).filter(Boolean));
  const importedNumbers = new Set();
  const imported = [];
  const duplicates = [];
  const errors = [];

  rawMatches.forEach((rawMatch, index) => {
    const result = normalizeImportedMatch(rawMatch, index + 2);
    if (result.error) {
      errors.push(result.error);
      return;
    }

    const { match } = result;
    if (existingNumbers.has(match.matchNumber) || importedNumbers.has(match.matchNumber)) {
      duplicates.push(match.matchNumber);
      return;
    }

    importedNumbers.add(match.matchNumber);
    imported.push(match);
  });

  return { imported, duplicates, errors };
};
