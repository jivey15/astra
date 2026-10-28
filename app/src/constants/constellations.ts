export interface ConstellationStar {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  size?: number; // Base star diameter in px
  isAlpha?: boolean; // Brightest primary star in the constellation
  label?: string; // Astronomical star name
}

export interface ZodiacConstellation {
  monthIndex: number; // 0 = Jan .. 11 = Dec
  monthName: string;
  name: string;
  latinName: string;
  symbol: string;
  element: string;
  alphaStar: string;
  bayerStar: string; // e.g. 'α Antares', 'ε Kaus Australis', 'δ Deneb Algedi'
  tagline: string;
  accentColor: string;
  stars: ConstellationStar[];
  edges: [number, number][];
}

export const ZODIAC_CONSTELLATIONS: ZodiacConstellation[] = [
  {
    monthIndex: 0,
    monthName: 'January',
    name: 'Capricorn',
    latinName: 'Capricornus',
    symbol: '♑',
    element: 'Earth',
    alphaStar: 'Deneb Algedi',
    bayerStar: 'δ Deneb Algedi',
    tagline: 'Winter solstice wedge rising above the Mississippi',
    accentColor: '#7DD3FC',
    stars: [
      { x: 0.14, y: 0.34, size: 4.5, label: 'Algedi' },
      { x: 0.18, y: 0.48, size: 4 },
      { x: 0.34, y: 0.72, size: 3.5 },
      { x: 0.54, y: 0.78, size: 4 },
      { x: 0.74, y: 0.62, size: 4 },
      { x: 0.86, y: 0.32, size: 5.5, isAlpha: true, label: 'Deneb Algedi' },
      { x: 0.56, y: 0.42, size: 3.5 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 0],
    ],
  },
  {
    monthIndex: 1,
    monthName: 'February',
    name: 'Aquarius',
    latinName: 'Aquarius',
    symbol: '♒',
    element: 'Air',
    alphaStar: 'Sadalsuud',
    bayerStar: 'β Sadalsuud',
    tagline: 'Electric currents pouring across the north sky',
    accentColor: '#38BDF8',
    stars: [
      { x: 0.18, y: 0.46, size: 4 },
      { x: 0.34, y: 0.32, size: 5.5, isAlpha: true, label: 'Sadalsuud' },
      { x: 0.5, y: 0.26, size: 4.5, label: 'Sadalmelik' },
      { x: 0.62, y: 0.42, size: 4 },
      { x: 0.54, y: 0.64, size: 3.5 },
      { x: 0.74, y: 0.56, size: 4 },
      { x: 0.86, y: 0.76, size: 4.5, label: 'Skat' },
      { x: 0.36, y: 0.74, size: 3.5 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 7],
      [3, 5],
      [5, 6],
    ],
  },
  {
    monthIndex: 2,
    monthName: 'March',
    name: 'Pisces',
    latinName: 'Pisces',
    symbol: '♓',
    element: 'Water',
    alphaStar: 'Alrescha',
    bayerStar: 'α Alrescha',
    tagline: 'Twin celestial ribbons tied at the vernal knot',
    accentColor: '#7DD3FC',
    stars: [
      { x: 0.14, y: 0.3, size: 4 },
      { x: 0.22, y: 0.22, size: 4 },
      { x: 0.28, y: 0.36, size: 3.5 },
      { x: 0.44, y: 0.56, size: 4 },
      { x: 0.62, y: 0.78, size: 5.5, isAlpha: true, label: 'Alrescha' },
      { x: 0.74, y: 0.54, size: 4 },
      { x: 0.84, y: 0.34, size: 4.5 },
      { x: 0.88, y: 0.22, size: 4 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
  },
  {
    monthIndex: 3,
    monthName: 'April',
    name: 'Aries',
    latinName: 'Aries',
    symbol: '♈',
    element: 'Fire',
    alphaStar: 'Hamal',
    bayerStar: 'α Hamal',
    tagline: 'First spark of spring igniting the Loring horizon',
    accentColor: '#38BDF8',
    stars: [
      { x: 0.18, y: 0.34, size: 4 },
      { x: 0.48, y: 0.42, size: 5.5, isAlpha: true, label: 'Hamal' },
      { x: 0.68, y: 0.56, size: 4.5, label: 'Sheratan' },
      { x: 0.78, y: 0.72, size: 4, label: 'Mesarthim' },
      { x: 0.86, y: 0.8, size: 3.5 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    monthIndex: 4,
    monthName: 'May',
    name: 'Taurus',
    latinName: 'Taurus',
    symbol: '♉',
    element: 'Earth',
    alphaStar: 'Aldebaran',
    bayerStar: 'α Aldebaran',
    tagline: 'The Hyades V-cluster glowing in ice-blue telemetry',
    accentColor: '#7DD3FC',
    stars: [
      { x: 0.16, y: 0.24, size: 4.5, label: 'Elnath' },
      { x: 0.44, y: 0.46, size: 4 },
      { x: 0.54, y: 0.58, size: 6, isAlpha: true, label: 'Aldebaran' },
      { x: 0.22, y: 0.62, size: 4.5, label: 'Zeta Tauri' },
      { x: 0.64, y: 0.66, size: 3.5 },
      { x: 0.76, y: 0.74, size: 4 },
      { x: 0.84, y: 0.32, size: 4.5, label: 'Pleiades' },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [3, 2],
      [2, 4],
      [4, 5],
      [1, 6],
    ],
  },
  {
    monthIndex: 5,
    monthName: 'June',
    name: 'Gemini',
    latinName: 'Gemini',
    symbol: '♊',
    element: 'Air',
    alphaStar: 'Pollux',
    bayerStar: 'β Pollux',
    tagline: 'Twin stars Castor & Pollux mirroring the Twin Cities',
    accentColor: '#38BDF8',
    stars: [
      { x: 0.24, y: 0.22, size: 5, label: 'Castor' },
      { x: 0.34, y: 0.36, size: 5.8, isAlpha: true, label: 'Pollux' },
      { x: 0.44, y: 0.32, size: 4 },
      { x: 0.64, y: 0.44, size: 3.8 },
      { x: 0.82, y: 0.52, size: 4.2, label: 'Tejat' },
      { x: 0.52, y: 0.58, size: 4 },
      { x: 0.74, y: 0.78, size: 4.5, label: 'Alhena' },
    ],
    edges: [
      [0, 1],
      [0, 2],
      [2, 3],
      [3, 4],
      [1, 5],
      [5, 6],
      [2, 5],
    ],
  },
  {
    monthIndex: 6,
    monthName: 'July',
    name: 'Cancer',
    latinName: 'Cancer',
    symbol: '♋',
    element: 'Water',
    alphaStar: 'Altarf',
    bayerStar: 'β Altarf',
    tagline: 'The Beehive Cluster shimmering in midsummer night',
    accentColor: '#7DD3FC',
    stars: [
      { x: 0.24, y: 0.26, size: 4, label: 'Asellus Borealis' },
      { x: 0.48, y: 0.46, size: 4.5, label: 'Praesepe' },
      { x: 0.54, y: 0.58, size: 4.2, label: 'Asellus Australis' },
      { x: 0.32, y: 0.82, size: 5.5, isAlpha: true, label: 'Altarf' },
      { x: 0.78, y: 0.72, size: 4.5, label: 'Acubens' },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
  },
  {
    monthIndex: 7,
    monthName: 'August',
    name: 'Leo',
    latinName: 'Leo',
    symbol: '♌',
    element: 'Fire',
    alphaStar: 'Regulus',
    bayerStar: 'α Regulus',
    tagline: 'The royal sickle crowned by Regulus in late summer',
    accentColor: '#38BDF8',
    stars: [
      { x: 0.32, y: 0.24, size: 4 },
      { x: 0.22, y: 0.32, size: 4 },
      { x: 0.26, y: 0.48, size: 4.5, label: 'Algieba' },
      { x: 0.38, y: 0.56, size: 3.8 },
      { x: 0.34, y: 0.78, size: 6, isAlpha: true, label: 'Regulus' },
      { x: 0.66, y: 0.48, size: 4.2, label: 'Zosma' },
      { x: 0.86, y: 0.62, size: 5, label: 'Denebola' },
      { x: 0.68, y: 0.72, size: 4 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [3, 5],
      [5, 6],
      [6, 7],
      [7, 4],
    ],
  },
  {
    monthIndex: 8,
    monthName: 'September',
    name: 'Virgo',
    latinName: 'Virgo',
    symbol: '♍',
    element: 'Earth',
    alphaStar: 'Spica',
    bayerStar: 'α Spica',
    tagline: 'Sapphire-white Spica guiding the autumn equinox',
    accentColor: '#7DD3FC',
    stars: [
      { x: 0.16, y: 0.42, size: 4 },
      { x: 0.34, y: 0.5, size: 4.2, label: 'Zavijava' },
      { x: 0.52, y: 0.48, size: 4.5, label: 'Porrima' },
      { x: 0.64, y: 0.24, size: 4.5, label: 'Vindemiatrix' },
      { x: 0.68, y: 0.58, size: 4 },
      { x: 0.74, y: 0.82, size: 6, isAlpha: true, label: 'Spica' },
      { x: 0.86, y: 0.48, size: 4 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [4, 5],
      [4, 6],
    ],
  },
  {
    monthIndex: 9,
    monthName: 'October',
    name: 'Scorpio',
    latinName: 'Scorpius',
    symbol: '♏',
    element: 'Water',
    alphaStar: 'Antares',
    bayerStar: 'α Antares',
    tagline: 'Electric heart of Antares pulsing over late-night Minneapolis',
    accentColor: '#7DD3FC',
    stars: [
      { x: 0.16, y: 0.22, size: 4.2, label: 'Acrab' },
      { x: 0.14, y: 0.38, size: 4.5, label: 'Dschubba' },
      { x: 0.18, y: 0.54, size: 4 },
      { x: 0.34, y: 0.42, size: 6, isAlpha: true, label: 'Antares' },
      { x: 0.48, y: 0.54, size: 4.2 },
      { x: 0.56, y: 0.72, size: 4 },
      { x: 0.68, y: 0.82, size: 4.5, label: 'Sargas' },
      { x: 0.82, y: 0.74, size: 4.2 },
      { x: 0.86, y: 0.56, size: 5, label: 'Shaula' },
    ],
    edges: [
      [0, 1],
      [2, 1],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
    ],
  },
  {
    monthIndex: 10,
    monthName: 'November',
    name: 'Sagittarius',
    latinName: 'Sagittarius',
    symbol: '♐',
    element: 'Fire',
    alphaStar: 'Kaus Australis',
    bayerStar: 'ε Kaus Australis',
    tagline: 'Aiming the galactic archer toward the Milky Way core',
    accentColor: '#38BDF8',
    stars: [
      { x: 0.24, y: 0.48, size: 4 },
      { x: 0.38, y: 0.26, size: 4.5, label: 'Kaus Borealis' },
      { x: 0.44, y: 0.52, size: 4.2, label: 'Kaus Media' },
      { x: 0.42, y: 0.78, size: 5.8, isAlpha: true, label: 'Kaus Australis' },
      { x: 0.64, y: 0.72, size: 4.5, label: 'Ascella' },
      { x: 0.62, y: 0.44, size: 4.2 },
      { x: 0.78, y: 0.34, size: 5, label: 'Nunki' },
      { x: 0.84, y: 0.58, size: 4 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 1],
      [5, 6],
      [6, 7],
      [7, 4],
    ],
  },
  {
    monthIndex: 11,
    monthName: 'December',
    name: 'Capricorn',
    latinName: 'Capricornus',
    symbol: '♑',
    element: 'Earth',
    alphaStar: 'Deneb Algedi',
    bayerStar: 'δ Deneb Algedi',
    tagline: 'Deep winter starlight crowning the year-end solstice',
    accentColor: '#7DD3FC',
    stars: [
      { x: 0.16, y: 0.64, size: 4 },
      { x: 0.3, y: 0.36, size: 4.5 },
      { x: 0.48, y: 0.24, size: 5.8, isAlpha: true, label: 'Deneb Algedi' },
      { x: 0.54, y: 0.54, size: 4.2 },
      { x: 0.36, y: 0.74, size: 4 },
      { x: 0.74, y: 0.44, size: 4.5 },
      { x: 0.86, y: 0.68, size: 4.8 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [2, 5],
      [5, 6],
      [6, 3],
    ],
  },
];

const LIBRA_CONSTELLATION: ZodiacConstellation = {
  monthIndex: 9,
  monthName: 'October',
  name: 'Libra',
  latinName: 'Libra',
  symbol: '♎',
  element: 'Air',
  alphaStar: 'Zubeneschamali',
  bayerStar: 'β Zubeneschamali',
  tagline: 'Equinox balance scales gleaming over the Loring skyline',
  accentColor: '#38BDF8',
  stars: [
    { x: 0.22, y: 0.44, size: 5.2, label: 'Zubenelgenubi' },
    { x: 0.48, y: 0.24, size: 5.8, isAlpha: true, label: 'Zubeneschamali' },
    { x: 0.74, y: 0.48, size: 4.5, label: 'Brachium' },
    { x: 0.56, y: 0.76, size: 4.2, label: 'Upsilon Librae' },
  ],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 2],
  ],
};

const MONTH_ABBRS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

export function getConstellationForMonth(monthIndex?: number): ZodiacConstellation {
  const now = new Date();
  if (typeof monthIndex === 'number' && monthIndex >= 0 && monthIndex <= 11) {
    if (monthIndex === now.getMonth()) {
      return getAstrologicalConstellation(now);
    }
    return ZODIAC_CONSTELLATIONS[monthIndex] ?? ZODIAC_CONSTELLATIONS[9];
  }
  return getAstrologicalConstellation(now);
}

/**
 * Dynamically computes the active astrological sign, month abbreviation, and Bayer star
 * based on `new Date()` (e.g., Oct 27 -> Scorpio ♏, OCT • α Antares).
 */
export function getAstrologicalConstellation(date: Date = new Date()): ZodiacConstellation {
  const m = date.getMonth() + 1; // 1..12
  const d = date.getDate();
  const currentMonthName = date.toLocaleString('en-US', { month: 'long' }) || 'October';
  const currentMonthIndex = date.getMonth();

  let base: ZodiacConstellation;
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) {
    base = ZODIAC_CONSTELLATIONS[9]; // Scorpio (α Antares)
  } else if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) {
    base = ZODIAC_CONSTELLATIONS[10]; // Sagittarius (ε Kaus Australis)
  } else if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) {
    base = ZODIAC_CONSTELLATIONS[0]; // Capricorn (δ Deneb Algedi)
  } else if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) {
    base = ZODIAC_CONSTELLATIONS[1]; // Aquarius (β Sadalsuud)
  } else if ((m === 2 && d >= 19) || (m === 3 && d <= 20)) {
    base = ZODIAC_CONSTELLATIONS[2]; // Pisces (α Alrescha)
  } else if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) {
    base = ZODIAC_CONSTELLATIONS[3]; // Aries (α Hamal)
  } else if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) {
    base = ZODIAC_CONSTELLATIONS[4]; // Taurus (α Aldebaran)
  } else if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) {
    base = ZODIAC_CONSTELLATIONS[5]; // Gemini (β Pollux)
  } else if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) {
    base = ZODIAC_CONSTELLATIONS[6]; // Cancer (β Altarf)
  } else if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) {
    base = ZODIAC_CONSTELLATIONS[7]; // Leo (α Regulus)
  } else if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) {
    base = ZODIAC_CONSTELLATIONS[8]; // Virgo (α Spica)
  } else {
    base = LIBRA_CONSTELLATION; // Libra (β Zubeneschamali)
  }

  return {
    ...base,
    monthIndex: currentMonthIndex,
    monthName: currentMonthName,
  };
}

export function getMonthAbbreviation(date: Date = new Date()): string {
  return MONTH_ABBRS[date.getMonth()] || 'OCT';
}
