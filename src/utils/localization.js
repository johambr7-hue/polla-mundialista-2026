const teamNames = {
  Mexico: 'México',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  Czechia: 'República Checa',
  Canada: 'Canadá',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  Qatar: 'Catar',
  Switzerland: 'Suiza',
  Brazil: 'Brasil',
  Morocco: 'Marruecos',
  Haiti: 'Haití',
  Scotland: 'Escocia',
  'United States': 'Estados Unidos',
  Paraguay: 'Paraguay',
  Australia: 'Australia',
  Turkey: 'Turquía',
  Türkiye: 'Turquía',
  Germany: 'Alemania',
  Curaçao: 'Curazao',
  Curacao: 'Curazao',
  'Ivory Coast': 'Costa de Marfil',
  "Côte d'Ivoire": 'Costa de Marfil',
  Ecuador: 'Ecuador',
  Netherlands: 'Países Bajos',
  Japan: 'Japón',
  Sweden: 'Suecia',
  Tunisia: 'Túnez',
  Belgium: 'Bélgica',
  Egypt: 'Egipto',
  Iran: 'Irán',
  'New Zealand': 'Nueva Zelanda',
  Spain: 'España',
  Espana: 'España',
  'Cape Verde': 'Cabo Verde',
  'Cabo Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudita',
  Uruguay: 'Uruguay',
  France: 'Francia',
  Senegal: 'Senegal',
  Norway: 'Noruega',
  Iraq: 'Irak',
  Argentina: 'Argentina',
  Algeria: 'Argelia',
  Austria: 'Austria',
  Jordan: 'Jordania',
  Colombia: 'Colombia',
  Portugal: 'Portugal',
  'DR Congo': 'RD Congo',
  Uzbekistan: 'Uzbekistán',
  England: 'Inglaterra',
  Croatia: 'Croacia',
  Ghana: 'Ghana',
  Panama: 'Panamá'
};

const normalizeDisplayText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const teamFlags = {
  mexico: '🇲🇽',
  'corea del sur': '🇰🇷',
  'republica checa': '🇨🇿',
  sudafrica: '🇿🇦',
  canada: '🇨🇦',
  suiza: '🇨🇭',
  catar: '🇶🇦',
  'bosnia y herzegovina': '🇧🇦',
  brasil: '🇧🇷',
  marruecos: '🇲🇦',
  haiti: '🇭🇹',
  escocia: '🏴',
  'estados unidos': '🇺🇸',
  paraguay: '🇵🇾',
  australia: '🇦🇺',
  turquia: '🇹🇷',
  alemania: '🇩🇪',
  curazao: '🇨🇼',
  'costa de marfil': '🇨🇮',
  ecuador: '🇪🇨',
  'paises bajos': '🇳🇱',
  japon: '🇯🇵',
  suecia: '🇸🇪',
  tunez: '🇹🇳',
  belgica: '🇧🇪',
  egipto: '🇪🇬',
  iran: '🇮🇷',
  'nueva zelanda': '🇳🇿',
  espana: '🇪🇸',
  'cabo verde': '🇨🇻',
  'arabia saudita': '🇸🇦',
  uruguay: '🇺🇾',
  francia: '🇫🇷',
  senegal: '🇸🇳',
  noruega: '🇳🇴',
  irak: '🇮🇶',
  argentina: '🇦🇷',
  argelia: '🇩🇿',
  austria: '🇦🇹',
  jordania: '🇯🇴',
  colombia: '🇨🇴',
  portugal: '🇵🇹',
  'rd congo': '🇨🇩',
  uzbekistan: '🇺🇿',
  inglaterra: '🏴',
  croacia: '🇭🇷',
  ghana: '🇬🇭',
  panama: '🇵🇦'
};

const displayPlaceholder = (team) => {
  if (!team) return '';

  const value = String(team).trim();
  const winnerGroup = value.match(/^Winner Group ([A-L])$/i);
  if (winnerGroup) return `Ganador Grupo ${winnerGroup[1].toUpperCase()}`;

  const runnerGroup = value.match(/^Runner-up Group ([A-L])$/i);
  if (runnerGroup) return `Segundo Grupo ${runnerGroup[1].toUpperCase()}`;

  const winnerMatch = value.match(/^Winner Match (\d+)$/i);
  if (winnerMatch) return `Ganador Partido ${winnerMatch[1]}`;

  const loserMatch = value.match(/^Loser Match (\d+)$/i);
  if (loserMatch) return `Perdedor Partido ${loserMatch[1]}`;

  const bestThird = value.match(/^Best 3rd Group ([A-L/]+)$/i);
  if (bestThird) return `Mejor tercero Grupo ${bestThird[1].toUpperCase()}`;

  return '';
};

export const displayTeam = (team) => {
  if (!team) return '';
  return teamNames[team] ?? (displayPlaceholder(team) || team);
};

export const getTeamFlag = (team) => teamFlags[normalizeDisplayText(displayTeam(team) || team)] ?? '⚽';

export const displayMatch = (match) =>
  match ? `${displayTeam(match.homeTeam)} vs ${displayTeam(match.awayTeam)}` : '';

export const displayStage = (stage) => stage;
