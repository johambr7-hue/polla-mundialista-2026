const initialParticipantNames = [
  'Patricia Árias',
  'Yamile Rojas',
  'Claudia Gómez',
  'John Alvarado',
  'Marlen Solano',
  'Joselin Cubillos (Marlen)',
  'Santiago Cubillos (Marlen)',
  'Carolina Cubillos (Marlen)',
  'Victor Solano',
  'Diego Castañeda',
  'Alexander Munar (Soraida)',
  'Wiliam Ramírez',
  'Soraida Ordoñez',
  'Idaly - Pedro',
  'Daniel (H Idaly)',
  'Liliana Moreno',
  'Santiago Uribe (H Claudia)',
  'Sebastián Uribe (H Claudia)',
  'Clara Hernández',
  'Joham Bohórquez'
];

export const sampleParticipants = initialParticipantNames.map((name, index) => ({
  id: `p${index + 1}`,
  name,
  email: '',
  phone: '',
  paid: true,
  paymentMethod: index % 3 === 0 ? 'efectivo' : index % 3 === 1 ? 'Nequi' : 'otro'
}));

export const defaultSettings = {
  entryFee: 30000,
  firstPrizePercent: 70,
  secondPrizePercent: 30,
  predictionDeadline: '',
  scoring: {
    'Fase de grupos': {
      result: 5,
      exactScore: 10,
      qualifiedTeam: 0,
      bracket: 0,
      finalResult: false
    },
    Dieciseisavos: {
      result: 0,
      exactScore: 20,
      qualifiedTeam: 10,
      bracket: 20,
      finalResult: false
    },
    Octavos: {
      result: 0,
      exactScore: 20,
      qualifiedTeam: 15,
      bracket: 30,
      finalResult: false
    },
    Cuartos: {
      result: 0,
      exactScore: 20,
      qualifiedTeam: 20,
      bracket: 40,
      finalResult: false
    },
    Semifinal: {
      result: 0,
      exactScore: 40,
      qualifiedTeam: 30,
      bracket: 50,
      finalResult: false
    },
    Final: {
      result: 0,
      exactScore: 50,
      qualifiedTeam: 40,
      bracket: 100,
      finalResult: false
    },
    'Tercer puesto': {
      result: 0,
      exactScore: 50,
      qualifiedTeam: 40,
      bracket: 100,
      finalResult: false
    }
  },
  finalResultsPoints: {
    champion: 320,
    second: 160,
    third: 100,
    fourth: 50
  }
};

export const sampleMatches = [
  {
    id: 'm1',
    date: '2026-06-11',
    time: '18:00',
    group: 'Grupo A',
    stage: 'Fase de grupos',
    homeTeam: 'Colombia',
    awayTeam: 'Brasil',
    realHomeScore: 2,
    realAwayScore: 1,
    qualifiedTeam: 'Colombia',
    classificationMethod: 'regulation',
    status: 'jugado'
  },
  {
    id: 'm2',
    date: '2026-06-12',
    time: '15:00',
    group: 'Grupo B',
    stage: 'Fase de grupos',
    homeTeam: 'Argentina',
    awayTeam: 'Mexico',
    realHomeScore: 1,
    realAwayScore: 1,
    qualifiedTeam: '',
    classificationMethod: 'regulation',
    status: 'jugado'
  },
  {
    id: 'm3',
    date: '2026-06-28',
    time: '17:00',
    group: 'Llave 1',
    stage: 'Dieciseisavos',
    homeTeam: 'Espana',
    awayTeam: 'Francia',
    realHomeScore: 2,
    realAwayScore: 2,
    qualifiedTeam: 'Francia',
    classificationMethod: 'penalties',
    status: 'jugado'
  },
  {
    id: 'm4',
    date: '2026-07-04',
    time: '19:00',
    group: 'Llave 8',
    stage: 'Cuartos',
    homeTeam: 'Uruguay',
    awayTeam: 'Inglaterra',
    realHomeScore: '',
    realAwayScore: '',
    qualifiedTeam: '',
    classificationMethod: '',
    status: 'pendiente'
  }
];

export const samplePredictions = [
  {
    id: 'pr1',
    participantId: 'p1',
    matchId: 'm1',
    homeScore: 2,
    awayScore: 1,
    qualifiedTeam: 'Colombia',
    penaltyWinner: '',
    predictedHomeTeam: 'Colombia',
    predictedAwayTeam: 'Brasil',
    createdAt: '2026-06-10T12:00:00.000Z'
  },
  {
    id: 'pr2',
    participantId: 'p2',
    matchId: 'm1',
    homeScore: 1,
    awayScore: 0,
    qualifiedTeam: 'Colombia',
    penaltyWinner: '',
    predictedHomeTeam: 'Colombia',
    predictedAwayTeam: 'Brasil',
    createdAt: '2026-06-10T13:00:00.000Z'
  },
  {
    id: 'pr3',
    participantId: 'p3',
    matchId: 'm2',
    homeScore: 1,
    awayScore: 1,
    qualifiedTeam: '',
    penaltyWinner: '',
    predictedHomeTeam: 'Argentina',
    predictedAwayTeam: 'Mexico',
    createdAt: '2026-06-11T12:00:00.000Z'
  },
  {
    id: 'pr4',
    participantId: 'p1',
    matchId: 'm3',
    homeScore: 2,
    awayScore: 2,
    qualifiedTeam: 'Francia',
    penaltyWinner: 'Francia',
    predictedHomeTeam: 'Espana',
    predictedAwayTeam: 'Francia',
    createdAt: '2026-06-27T12:00:00.000Z'
  },
  {
    id: 'pr5',
    participantId: 'p2',
    matchId: 'm3',
    homeScore: 1,
    awayScore: 1,
    qualifiedTeam: 'Espana',
    penaltyWinner: 'Espana',
    predictedHomeTeam: 'Espana',
    predictedAwayTeam: 'Francia',
    createdAt: '2026-06-27T13:00:00.000Z'
  }
];

export const sampleFinalPredictions = {};

export const sampleFinalResults = {
  champion: '',
  second: '',
  third: '',
  fourth: ''
};
