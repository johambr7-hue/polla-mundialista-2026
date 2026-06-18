import {
  defaultSettings,
  sampleFinalPredictions,
  sampleFinalResults,
  sampleMatches,
  sampleParticipants,
  samplePredictions
} from '../data/sampleData';

const STORAGE_KEY = 'polla-mundialista-state-v16';

const initialState = {
  participants: sampleParticipants,
  matches: sampleMatches,
  predictions: samplePredictions,
  tournamentEntries: {},
  finalPredictions: sampleFinalPredictions,
  finalResults: sampleFinalResults,
  importAudits: [],
  settings: defaultSettings
};

const emptyFinalResults = { champion: '', second: '', third: '', fourth: '' };

const isDemoFinalResults = (finalResults = {}) =>
  finalResults.champion === 'Colombia' &&
  !finalResults.second &&
  !finalResults.third &&
  !finalResults.fourth;

const sanitizeFinalPredictions = (finalPredictions = {}) => {
  const demoPredictions = {
    p1: { champion: 'Colombia', second: 'Francia', third: 'Brasil', fourth: 'Argentina' },
    p2: { champion: 'Brasil', second: 'Argentina', third: 'Francia', fourth: 'Colombia' },
    p3: { champion: 'Argentina', second: 'Francia', third: 'Colombia', fourth: 'Brasil' }
  };

  const isDemo =
    Object.keys(finalPredictions).length === 3 &&
    Object.entries(demoPredictions).every(([participantId, prediction]) =>
      Object.entries(prediction).every(([field, value]) => finalPredictions[participantId]?.[field] === value)
    );

  return isDemo ? {} : finalPredictions;
};

const hydrateState = (state) => {
  const participants = state.participants ?? sampleParticipants;
  const shouldRefreshOfficialPayments =
    participants.length >= sampleParticipants.length &&
    participants.some((participant) => participant.name === 'Patricia Arias') &&
    participants.filter((participant) => participant.paid).length < sampleParticipants.length;

  return {
    participants: shouldRefreshOfficialPayments ? sampleParticipants : participants,
    matches: state.matches ?? sampleMatches,
    predictions: state.predictions ?? samplePredictions,
    tournamentEntries: state.tournamentEntries ?? {},
    finalPredictions: sanitizeFinalPredictions(state.finalPredictions ?? {}),
    finalResults: isDemoFinalResults(state.finalResults) ? emptyFinalResults : state.finalResults ?? sampleFinalResults,
    importAudits: state.importAudits ?? [],
    settings: {
      ...defaultSettings,
      ...(state.settings ?? {}),
      scoring: {
        ...defaultSettings.scoring,
        ...(state.settings?.scoring ?? {})
      },
      finalResultsPoints: {
        ...defaultSettings.finalResultsPoints,
        ...(state.settings?.finalResultsPoints ?? {})
      }
    }
  };
};

export const loadState = () => {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialState;

  const parsed = JSON.parse(saved);
  const hasOfficialParticipants =
    parsed.participants?.length >= sampleParticipants.length &&
    parsed.participants?.some((participant) => participant.name === 'Patricia Árias');

  return hasOfficialParticipants ? hydrateState(parsed) : initialState;
};

export const saveState = (state) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const resetState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
  return initialState;
};

export const createId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
