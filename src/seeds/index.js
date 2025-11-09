import { seedSolarSystem } from './solarSystem.js';
import { seedBinarySystem } from './binarySystem.js';

import { seedLowEnergyMerge } from './lowEnergyMerge.js';
import { seedModerateFragmentation } from './moderateFragmentation.js';
import { seedHighEnergyExplosion } from './highEnergyExplosion.js';
import { seedBigSmallImpact } from './bigSmallImpact.js';

export const SEEDS = {
  solar: {
    label: 'Solar system',
    apply: seedSolarSystem,
  },
  binary: {
    label: 'Binary system',
    apply: seedBinarySystem,
  },
  lowEnergyMerge: {
    label: 'Test: low-energy merge',
    apply: seedLowEnergyMerge,
  },
  moderateFragmentation: {
    label: 'Test: moderate fragmentation',
    apply: seedModerateFragmentation,
  },
  highEnergyExplosion: {
    label: 'Test: high-energy explosion',
    apply: seedHighEnergyExplosion,
  },
  bigSmallImpact: {
    label: 'Test: big vs small impact',
    apply: seedBigSmallImpact,
  },
};

export const DEFAULT_SEED_KEY = 'solar';
