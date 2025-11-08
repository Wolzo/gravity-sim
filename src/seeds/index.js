import { seedSolarSystem } from './solarSystem.js';
import { seedBinarySystem } from './binarySystem.js';

export const SEEDS = {
  binary: {
    label: 'Binary system',
    apply: seedBinarySystem,
  },
  solar: {
    label: 'Solar system',
    apply: seedSolarSystem,
  },
};

export const DEFAULT_SEED_KEY = 'solar';
