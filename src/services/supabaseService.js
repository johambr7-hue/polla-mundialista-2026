import { defaultSettings } from '../data/sampleData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { buildRanking } from '../utils/scoring';

export { isSupabaseConfigured };

const requireSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
  }

  return supabase;
};

const asEmptyString = (value) => value ?? '';
const nullableNumber = (value) => (value === '' || value === undefined || value === null ? null : Number(value));
const fromNullableNumber = (value) => (value === null || value === undefined ? '' : Number(value));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => uuidPattern.test(String(value ?? ''));
const withUuid = (row, id) => (isUuid(id) ? { id, ...row } : row);
const normalizeName = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
const getMatchCode = (match) => match.matchCode ?? match.match_code ?? `match-${match.matchNumber ?? match.id}`;

const participantFromRow = (row) => ({
  id: row.id,
  name: row.name ?? '',
  email: row.email ?? '',
  phone: row.phone ?? '',
  paid: Boolean(row.paid),
  paymentMethod: row.payment_method ?? ''
});

const participantToRow = (participant) => withUuid({
  name: participant.name,
  normalized_name: normalizeName(participant.name),
  email: asEmptyString(participant.email),
  phone: asEmptyString(participant.phone),
  paid: Boolean(participant.paid),
  payment_method: asEmptyString(participant.paymentMethod)
}, participant.id);

const matchFromRow = (row) => ({
  id: row.id,
  matchCode: row.match_code ?? '',
  matchNumber: fromNullableNumber(row.match_number),
  date: row.match_date ?? '',
  time: row.match_time ?? '',
  group: row.group_name ?? '',
  stage: row.phase ?? 'Fase de grupos',
  homeTeam: row.home_team ?? '',
  awayTeam: row.away_team ?? '',
  stadium: '',
  city: '',
  realHomeScore: fromNullableNumber(row.real_home_goals),
  realAwayScore: fromNullableNumber(row.real_away_goals),
  qualifiedTeam: row.real_qualified_team ?? '',
  classificationMethod: '',
  status: row.status ?? 'pendiente'
});

const matchToRow = (match) => withUuid({
  match_code: getMatchCode(match),
  phase: asEmptyString(match.stage),
  group_name: asEmptyString(match.group),
  match_number: nullableNumber(match.matchNumber),
  match_date: asEmptyString(match.date),
  match_time: asEmptyString(match.time),
  home_team: asEmptyString(match.homeTeam),
  away_team: asEmptyString(match.awayTeam),
  real_home_goals: nullableNumber(match.realHomeScore),
  real_away_goals: nullableNumber(match.realAwayScore),
  real_qualified_team: asEmptyString(match.qualifiedTeam),
  status: match.status ?? 'pendiente'
}, match.id);

const predictionFromRow = (row) => ({
  id: row.id,
  participantId: row.participant_id,
  matchId: row.match_id,
  phase: row.phase ?? '',
  groupName: row.group_name ?? '',
  homeScore: fromNullableNumber(row.predicted_home_goals),
  awayScore: fromNullableNumber(row.predicted_away_goals),
  qualifiedTeam: row.predicted_qualified_team ?? '',
  penaltyWinner: row.predicted_penalty_winner ?? '',
  predictedHomeTeam: row.predicted_home_team ?? '',
  predictedAwayTeam: row.predicted_away_team ?? '',
  pointsGroupResult: Number(row.points_group_result ?? 0),
  pointsExactScore: Number(row.points_exact_score ?? 0),
  pointsQualifiedTeam: Number(row.points_qualified_team ?? 0),
  pointsBracket: Number(row.points_bracket ?? 0),
  pointsKnockoutScore: Number(row.points_knockout_score ?? 0),
  pointsTotal: Number(row.points_total ?? 0),
  createdAt: row.created_at ?? ''
});

const predictionToRow = (prediction) => withUuid({
  participant_id: prediction.participantId,
  match_id: prediction.matchId,
  phase: asEmptyString(prediction.phase),
  group_name: asEmptyString(prediction.groupName),
  predicted_home_team: asEmptyString(prediction.predictedHomeTeam),
  predicted_away_team: asEmptyString(prediction.predictedAwayTeam),
  predicted_home_goals: nullableNumber(prediction.homeScore),
  predicted_away_goals: nullableNumber(prediction.awayScore),
  predicted_qualified_team: asEmptyString(prediction.qualifiedTeam),
  predicted_penalty_winner: asEmptyString(prediction.penaltyWinner),
  points_group_result: Number(prediction.pointsGroupResult ?? 0),
  points_exact_score: Number(prediction.pointsExactScore ?? 0),
  points_qualified_team: Number(prediction.pointsQualifiedTeam ?? 0),
  points_bracket: Number(prediction.pointsBracket ?? 0),
  points_knockout_score: Number(prediction.pointsKnockoutScore ?? 0),
  points_total: Number(prediction.pointsTotal ?? 0),
  created_at: prediction.createdAt ?? new Date().toISOString()
}, prediction.id);

const paymentFromRow = (row) => ({
  id: row.id,
  participantId: row.participant_id,
  paid: Boolean(row.paid),
  paymentMethod: row.method ?? '',
  amount: fromNullableNumber(row.amount),
  paidAt: row.paid_at ?? ''
});

const paymentToRow = (payment) => ({
  participant_id: payment.participantId,
  amount: nullableNumber(payment.amount),
  method: asEmptyString(payment.paymentMethod),
  paid: Boolean(payment.paid),
  paid_at: payment.paidAt || null
});

const tournamentPredictionFromRow = (row) => ({
  participantId: row.participant_id,
  finalResults: {
    champion: row.champion ?? '',
    second: row.runner_up ?? '',
    third: row.third_place ?? '',
    fourth: row.fourth_place ?? ''
  },
  champion: row.champion ?? '',
  second: row.runner_up ?? '',
  third: row.third_place ?? '',
  fourth: row.fourth_place ?? '',
  pointsChampion: Number(row.points_champion ?? 0),
  pointsRunnerUp: Number(row.points_runner_up ?? 0),
  pointsThirdPlace: Number(row.points_third_place ?? 0),
  pointsFourthPlace: Number(row.points_fourth_place ?? 0),
  pointsTotal: Number(row.points_total ?? 0)
});

const tournamentPredictionToRow = (entry) => withUuid({
  participant_id: entry.participantId,
  champion: asEmptyString(entry.finalResults?.champion ?? entry.champion),
  runner_up: asEmptyString(entry.finalResults?.second ?? entry.second ?? entry.runnerUp),
  third_place: asEmptyString(entry.finalResults?.third ?? entry.third),
  fourth_place: asEmptyString(entry.finalResults?.fourth ?? entry.fourth),
  points_champion: Number(entry.pointsChampion ?? 0),
  points_runner_up: Number(entry.pointsRunnerUp ?? 0),
  points_third_place: Number(entry.pointsThirdPlace ?? 0),
  points_fourth_place: Number(entry.pointsFourthPlace ?? 0),
  points_total: Number(entry.pointsTotal ?? 0)
}, entry.id);

const settingFromRow = (row) => row.value ?? {};

const normalizeSettings = (rows) => {
  if (!rows?.length) return defaultSettings;
  const settingsRow = rows.find((row) => row.key === 'official') ?? rows[0];
  return {
    ...defaultSettings,
    ...settingFromRow(settingsRow),
    scoring: {
      ...defaultSettings.scoring,
      ...(settingFromRow(settingsRow).scoring ?? {})
    },
    finalResultsPoints: {
      ...defaultSettings.finalResultsPoints,
      ...(settingFromRow(settingsRow).finalResultsPoints ?? {})
    }
  };
};

const scoreDetailToRow = (detail) => withUuid({
  participant_id: detail.participantId ?? detail.participante_id,
  match_id: detail.matchId ?? detail.match_id ?? null,
  phase: detail.phase ?? detail.fase,
  type: detail.type ?? detail.tipo ?? 'detalle',
  points: Number(detail.points ?? detail.puntos ?? detail.totalPoints ?? detail.puntos_total_fase ?? 0),
  detail: detail.detailData ?? detail.detail ?? detail
}, detail.id);

const selectAll = async (table, order = 'id') => {
  const client = requireSupabase();
  const { data, error } = await client.from(table).select('*').order(order, { ascending: true });
  if (error) throw error;
  return data ?? [];
};

const upsertRows = async (table, rows) => {
  const client = requireSupabase();
  const payload = Array.isArray(rows) ? rows : [rows];
  if (!payload.length) return [];

  const { data, error } = await client.from(table).upsert(payload).select();
  if (error) throw error;
  return data ?? [];
};

const replaceRows = async (table, rows, toRow, deleteColumn = 'id') => {
  const client = requireSupabase();
  const payload = rows.map(toRow);
  const { error: deleteError } = await client.from(table).delete().not(deleteColumn, 'is', null);
  if (deleteError) throw deleteError;
  if (!payload.length) return [];
  const { data, error } = await client.from(table).insert(payload).select();
  if (error) throw error;
  return data ?? [];
};

const hasPredictionUuids = (prediction) => isUuid(prediction.participantId) && isUuid(prediction.matchId);
const hasParticipantUuid = (item) => isUuid(item.participantId);

export const getParticipants = async () => (await selectAll('participants', 'name')).map(participantFromRow);
export const saveParticipant = async (participant) => {
  const [row] = await upsertRows('participants', participantToRow(participant));
  return participantFromRow(row);
};
export const saveParticipants = async (participants) =>
  (await upsertRows('participants', participants.map(participantToRow))).map(participantFromRow);

export const deleteParticipant = async (participantId) => {
  if (!participantId) {
    throw new Error('No se puede eliminar el participante: participantId está vacío.');
  }

  if (!isUuid(participantId)) {
    throw new Error(`No se puede eliminar el participante: "${participantId}" no es un UUID válido de Supabase.`);
  }

  const client = requireSupabase();
  const { error } = await client.from('participants').delete().eq('id', participantId);
  if (error) throw error;

  const { data: stillExists, error: verifyError } = await client
    .from('participants')
    .select('id')
    .eq('id', participantId)
    .maybeSingle();

  if (verifyError) throw verifyError;
  if (stillExists) {
    throw new Error(`Supabase no eliminó el participante ${participantId}. Revisa las políticas RLS de DELETE en participants.`);
  }

  return participantId;
};

export const getMatches = async () => (await selectAll('matches', 'match_number')).map(matchFromRow);
export const saveMatch = async (match) => {
  const [row] = await upsertRows('matches', matchToRow(match));
  return matchFromRow(row);
};
export const saveMatches = async (matches) =>
  (await replaceRows('matches', matches, matchToRow)).map(matchFromRow);

export const getPredictions = async () => (await selectAll('predictions', 'id')).map(predictionFromRow);
export const savePrediction = async (prediction) => {
  const [row] = await upsertRows('predictions', predictionToRow(prediction));
  return predictionFromRow(row);
};
export const savePredictions = async (predictions) =>
  (await replaceRows('predictions', predictions.filter(hasPredictionUuids), predictionToRow)).map(predictionFromRow);

export const getTournamentPredictions = async () => {
  const rows = await selectAll('tournament_predictions', 'participant_id');
  return Object.fromEntries(rows.map((row) => [row.participant_id, tournamentPredictionFromRow(row)]));
};
export const saveTournamentPrediction = async (entry) => {
  const [row] = await upsertRows('tournament_predictions', tournamentPredictionToRow(entry));
  return tournamentPredictionFromRow(row);
};
export const saveTournamentPredictions = async (entriesByParticipant) =>
  (await replaceRows(
    'tournament_predictions',
    Object.entries(entriesByParticipant ?? {})
      .map(([participantId, entry]) => ({ participantId, ...entry }))
      .filter(hasParticipantUuid),
    tournamentPredictionToRow,
    'participant_id'
  )).map(tournamentPredictionFromRow);

export const getPayments = async () => (await selectAll('payments', 'participant_id')).map(paymentFromRow);
export const savePayment = async (payment) => {
  const [row] = await upsertRows('payments', paymentToRow(payment));
  return paymentFromRow(row);
};
export const savePayments = async (payments) =>
  (await replaceRows('payments', payments.filter(hasParticipantUuid), paymentToRow, 'participant_id')).map(paymentFromRow);

export const getSettings = async () => normalizeSettings(await selectAll('settings', 'key'));
export const saveSettings = async (settings) => {
  const [row] = await upsertRows('settings', { key: 'official', value: settings });
  return normalizeSettings([row]);
};

export const getScoreDetails = async () => selectAll('score_details', 'participant_id');
export const saveScoreDetails = async (scoreDetails) =>
  replaceRows(
    'score_details',
    scoreDetails.filter((detail) => isUuid(detail.participantId ?? detail.participante_id)),
    scoreDetailToRow,
    'participant_id'
  );

export const loadSupabaseState = async () => {
  const [
    participants,
    matches,
    predictions,
    tournamentEntries,
    payments,
    settings,
    scoreDetails
  ] = await Promise.all([
    getParticipants(),
    getMatches(),
    getPredictions(),
    getTournamentPredictions(),
    getPayments(),
    getSettings(),
    getScoreDetails()
  ]);

  const participantsWithPayments = participants.map((participant) => {
    const payment = payments.find((item) => item.participantId === participant.id);
    return payment
      ? { ...participant, paid: payment.paid, paymentMethod: payment.paymentMethod }
      : participant;
  });

  return {
    participants: participantsWithPayments,
    matches,
    predictions,
    tournamentEntries,
    finalPredictions: {},
    finalResults: { champion: '', second: '', third: '', fourth: '' },
    importAudits: [],
    payments,
    scoreDetails,
    settings
  };
};

export const saveStateSection = async (section, value) => {
  if (section === 'participants') return saveParticipants(value);
  if (section === 'matches') return saveMatches(value);
  if (section === 'predictions') return savePredictions(value);
  if (section === 'tournamentEntries') return saveTournamentPredictions(value);
  if (section === 'settings') return saveSettings(value);
  if (section === 'payments') return savePayments(value);
  if (section === 'scoreDetails') return saveScoreDetails(value);
  return null;
};

const insertRow = async (table, row) => {
  const client = requireSupabase();
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
};

const updateRow = async (table, id, row) => {
  const client = requireSupabase();
  const { id: _ignoredId, created_at: _ignoredCreatedAt, ...payload } = row;
  const { data, error } = await client.from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

const upsertByExisting = async ({ table, existing, row, fromRow }) => {
  if (existing?.id) {
    return { row: fromRow(await updateRow(table, existing.id, row)), action: 'updated' };
  }

  return { row: fromRow(await insertRow(table, row)), action: 'created' };
};

export const getSupabaseDataCounts = async () => {
  const client = requireSupabase();
  const [participantsResult, matchesResult] = await Promise.all([
    client.from('participants').select('id', { count: 'exact', head: true }),
    client.from('matches').select('id', { count: 'exact', head: true })
  ]);

  if (participantsResult.error) throw participantsResult.error;
  if (matchesResult.error) throw matchesResult.error;

  return {
    participants: participantsResult.count ?? 0,
    matches: matchesResult.count ?? 0
  };
};

export const migrateInitialDataToSupabase = async (sourceState) => {
  const summary = {
    participantsCreated: 0,
    participantsUpdated: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    predictionsCreated: 0,
    predictionsUpdated: 0,
    paymentsCreated: 0,
    paymentsUpdated: 0,
    tournamentPredictionsCreated: 0,
    tournamentPredictionsUpdated: 0,
    scoreDetailsCreated: 0,
    scoreDetailsUpdated: 0,
    errors: [],
    omitted: []
  };

  const participants = sourceState.participants ?? [];
  const matches = sourceState.matches ?? [];
  const predictions = sourceState.predictions ?? [];
  const tournamentEntries = sourceState.tournamentEntries ?? {};
  const finalPredictions = sourceState.finalPredictions ?? {};
  const settings = { ...defaultSettings, ...(sourceState.settings ?? {}) };
  const finalResults = sourceState.finalResults ?? { champion: '', second: '', third: '', fourth: '' };

  const [
    existingParticipants,
    existingMatches,
    existingPredictions,
    existingPayments,
    existingTournamentPredictions
  ] = await Promise.all([
    selectAll('participants', 'name'),
    selectAll('matches', 'match_number'),
    selectAll('predictions', 'id'),
    selectAll('payments', 'participant_id'),
    selectAll('tournament_predictions', 'participant_id')
  ]);

  const participantsByNormalizedName = new Map(
    existingParticipants.map((row) => [row.normalized_name || normalizeName(row.name), row])
  );
  const matchesByCode = new Map(existingMatches.map((row) => [row.match_code || `match-${row.match_number}`, row]));
  const predictionsByPair = new Map(existingPredictions.map((row) => [`${row.participant_id}|${row.match_id}`, row]));
  const paymentsByParticipant = new Map(existingPayments.map((row) => [row.participant_id, row]));
  const tournamentByParticipant = new Map(existingTournamentPredictions.map((row) => [row.participant_id, row]));
  const participantIdMap = new Map();
  const participantNameMap = new Map();
  const matchIdMap = new Map();
  const matchCodeMap = new Map();

  for (const participant of participants) {
    try {
      const normalizedName = normalizeName(participant.name);
      if (!normalizedName) {
        summary.omitted.push(`Participante omitido sin nombre: ${participant.id ?? 'sin id'}`);
        continue;
      }

      const result = await upsertByExisting({
        table: 'participants',
        existing: participantsByNormalizedName.get(normalizedName),
        row: participantToRow(participant),
        fromRow: participantFromRow
      });

      if (result.action === 'created') summary.participantsCreated += 1;
      if (result.action === 'updated') summary.participantsUpdated += 1;

      participantsByNormalizedName.set(normalizedName, { id: result.row.id, name: result.row.name, normalized_name: normalizedName });
      participantIdMap.set(participant.id, result.row.id);
      participantNameMap.set(normalizedName, result.row.id);
    } catch (error) {
      summary.errors.push(`Participante ${participant.name ?? participant.id}: ${error.message}`);
    }
  }

  for (const match of matches) {
    try {
      const matchCode = getMatchCode(match);
      if (!matchCode) {
        summary.omitted.push(`Partido omitido sin match_code: ${match.id ?? match.matchNumber ?? 'sin id'}`);
        continue;
      }

      const result = await upsertByExisting({
        table: 'matches',
        existing: matchesByCode.get(matchCode),
        row: matchToRow({ ...match, matchCode }),
        fromRow: matchFromRow
      });

      if (result.action === 'created') summary.matchesCreated += 1;
      if (result.action === 'updated') summary.matchesUpdated += 1;

      matchesByCode.set(matchCode, { id: result.row.id, match_code: matchCode });
      matchIdMap.set(match.id, result.row.id);
      matchCodeMap.set(matchCode, result.row.id);
    } catch (error) {
      summary.errors.push(`Partido ${match.matchNumber ?? match.id}: ${error.message}`);
    }
  }

  for (const prediction of predictions) {
    try {
      const participantId = participantIdMap.get(prediction.participantId);
      const matchId = matchIdMap.get(prediction.matchId);
      if (!participantId || !matchId) {
        summary.omitted.push(`Predicción omitida sin UUID real: ${prediction.id ?? `${prediction.participantId}-${prediction.matchId}`}`);
        continue;
      }

      const localMatch = matches.find((match) => match.id === prediction.matchId);
      const row = predictionToRow({
        ...prediction,
        id: undefined,
        participantId,
        matchId,
        phase: prediction.phase ?? localMatch?.stage ?? '',
        groupName: prediction.groupName ?? localMatch?.group ?? '',
        predictedHomeTeam: prediction.predictedHomeTeam ?? localMatch?.homeTeam ?? '',
        predictedAwayTeam: prediction.predictedAwayTeam ?? localMatch?.awayTeam ?? ''
      });
      const key = `${participantId}|${matchId}`;
      const result = await upsertByExisting({
        table: 'predictions',
        existing: predictionsByPair.get(key),
        row,
        fromRow: predictionFromRow
      });

      if (result.action === 'created') summary.predictionsCreated += 1;
      if (result.action === 'updated') summary.predictionsUpdated += 1;
      predictionsByPair.set(key, { id: result.row.id, participant_id: participantId, match_id: matchId });
    } catch (error) {
      summary.errors.push(`Predicción ${prediction.id ?? ''}: ${error.message}`);
    }
  }

  for (const participant of participants) {
    try {
      const participantId = participantIdMap.get(participant.id) ?? participantNameMap.get(normalizeName(participant.name));
      if (!participantId) {
        summary.omitted.push(`Pago omitido sin participante UUID: ${participant.name}`);
        continue;
      }

      const row = paymentToRow({
        participantId,
        paid: Boolean(participant.paid),
        paymentMethod: participant.paymentMethod ?? '',
        amount: participant.paid ? Number(settings.entryFee) : 0,
        paidAt: ''
      });
      const existing = paymentsByParticipant.get(participantId);
      const result = await upsertByExisting({ table: 'payments', existing, row, fromRow: paymentFromRow });

      if (result.action === 'created') summary.paymentsCreated += 1;
      if (result.action === 'updated') summary.paymentsUpdated += 1;
      paymentsByParticipant.set(participantId, { id: result.row.id, participant_id: participantId });
    } catch (error) {
      summary.errors.push(`Pago ${participant.name ?? participant.id}: ${error.message}`);
    }
  }

  for (const participant of participants) {
    try {
      const participantId = participantIdMap.get(participant.id) ?? participantNameMap.get(normalizeName(participant.name));
      if (!participantId) {
        summary.omitted.push(`Resultado final omitido sin participante UUID: ${participant.name}`);
        continue;
      }

      const finalPrediction = finalPredictions[participant.id] ?? tournamentEntries[participant.id]?.finalResults;
      if (!finalPrediction) {
        summary.omitted.push(`Resultado final omitido sin datos: ${participant.name}`);
        continue;
      }

      const row = tournamentPredictionToRow({
        participantId,
        champion: finalPrediction.champion,
        second: finalPrediction.second,
        third: finalPrediction.third,
        fourth: finalPrediction.fourth
      });
      const existing = tournamentByParticipant.get(participantId);
      const result = await upsertByExisting({
        table: 'tournament_predictions',
        existing,
        row,
        fromRow: tournamentPredictionFromRow
      });

      if (result.action === 'created') summary.tournamentPredictionsCreated += 1;
      if (result.action === 'updated') summary.tournamentPredictionsUpdated += 1;
      tournamentByParticipant.set(participantId, { id: result.row.id, participant_id: participantId });
    } catch (error) {
      summary.errors.push(`Resultado final ${participant.name ?? participant.id}: ${error.message}`);
    }
  }

  await saveSettings({ ...settings, finalPredictions, finalResults });

  try {
    const mappedParticipants = participants.map((participant) => ({
      ...participant,
      id: participantIdMap.get(participant.id) ?? participant.id
    }));
    const mappedMatches = matches.map((match) => ({
      ...match,
      id: matchIdMap.get(match.id) ?? match.id
    }));
    const mappedPredictions = predictions.flatMap((prediction) => {
      const participantId = participantIdMap.get(prediction.participantId);
      const matchId = matchIdMap.get(prediction.matchId);
      return participantId && matchId ? [{ ...prediction, participantId, matchId }] : [];
    });
    const ranking = buildRanking(mappedParticipants, mappedMatches, mappedPredictions, finalPredictions, finalResults, settings);
    const scoreDetails = ranking.flatMap((participant) =>
      (participant.pointsDetail ?? []).map((detail) => ({
        participantId: participant.id,
        phase: detail.fase,
        points: detail.puntos_total_fase,
        type: 'fase',
        detail
      }))
    );

    const savedDetails = await saveScoreDetails(scoreDetails);
    summary.scoreDetailsCreated = savedDetails.length;
  } catch (error) {
    summary.errors.push(`Detalle de puntos: ${error.message}`);
  }

  return summary;
};
