import { defaultSettings } from '../data/sampleData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

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
  normalized_name: String(participant.name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''),
  email: asEmptyString(participant.email),
  phone: asEmptyString(participant.phone),
  paid: Boolean(participant.paid),
  payment_method: asEmptyString(participant.paymentMethod)
}, participant.id);

const matchFromRow = (row) => ({
  id: row.id,
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
  match_code: match.matchCode ?? match.match_code ?? `match-${match.matchNumber ?? match.id ?? crypto.randomUUID()}`,
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
  if (!isUuid(participantId)) {
    throw new Error('No se puede eliminar el participante porque no tiene un UUID válido de Supabase.');
  }

  const client = requireSupabase();
  const { error } = await client.from('participants').delete().eq('id', participantId);
  if (error) throw error;
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
