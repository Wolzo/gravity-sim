/**
 * Generates a pseudo-stellar / planetary name
 */
const greek = [
  'Alpha',
  'Beta',
  'Gamma',
  'Delta',
  'Epsilon',
  'Zeta',
  'Eta',
  'Theta',
  'Iota',
  'Kappa',
  'Lambda',
  'Mu',
  'Nu',
  'Xi',
  'Omicron',
  'Pi',
  'Rho',
  'Sigma',
  'Tau',
  'Upsilon',
  'Phi',
  'Chi',
  'Psi',
  'Omega',
];

const constellations = [
  'Andromedae',
  'Aquarii',
  'Arietis',
  'Ceti',
  'Cygni',
  'Draconis',
  'Eridani',
  'Gemini',
  'Hydrae',
  'Leonis',
  'Lyrae',
  'Pegasi',
  'Persei',
  'Sagittarii',
  'Scorpii',
  'Tauri',
  'Ursae',
  'Virginis',
];

const prefixes = ['HD', 'HR', 'BD', 'HIP', 'ZK', 'GN', 'AS', 'AR'];
const roots = ['Astra', 'Lumen', 'Velar', 'Zorin', 'Talon', 'Ryn', 'Kera', 'Vega'];

export function generateRandomName() {
  const n = Math.random();

  if (n < 0.33) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 9900);

    return `${prefix}-${num}`;
  } else if (n < 0.66) {
    const g = greek[Math.floor(Math.random() * greek.length)];
    const c = constellations[Math.floor(Math.random() * constellations.length)];

    return `${g} ${c}`;
  } else {
    const root = roots[Math.floor(Math.random() * roots.length)];
    const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const num = Math.floor(Math.random() * 100);

    return `${root}-${suffix}${num}`;
  }
}
