import { seedSolarSystem } from './solarSystem.js';
import { seedBinarySystem } from './binarySystem.js';
import { seedAsteroidRing } from './asteroidRing.js';
import { seedHeadOnClusters } from './headOnCluster.js';
import { seedTripleChaos } from './tripleChaos.js';

import { seedLowEnergyMerge } from './lowEnergyMerge.js';
import { seedModerateFragmentation } from './moderateFragmentation.js';
import { seedHighEnergyExplosion } from './highEnergyExplosion.js';
import { seedBigSmallImpact } from './bigSmallImpact.js';

export const SEEDS = {
  solar: {
    label: 'Solar system',
    apply: seedSolarSystem,
    enabled: true,
  },
  binary: {
    label: 'Binary system',
    apply: seedBinarySystem,
    enabled: true,
  },
  asteroidRing: {
    label: 'Asteroid ring',
    apply: seedAsteroidRing,
    enabled: true,
  },
  headOnClusters: {
    label: 'Head-on cluster',
    apply: seedHeadOnClusters,
    enabled: true,
  },
  tripleChaos: {
    label: 'Chaotic triple system',
    apply: seedTripleChaos,
    enabled: true,
  },
  lowEnergyMerge: {
    label: 'Test: low-energy merge',
    apply: seedLowEnergyMerge,
    enabled: false,
  },
  moderateFragmentation: {
    label: 'Test: moderate fragmentation',
    apply: seedModerateFragmentation,
    enabled: false,
  },
  highEnergyExplosion: {
    label: 'Test: high-energy explosion',
    apply: seedHighEnergyExplosion,
    enabled: true,
  },
  bigSmallImpact: {
    label: 'Test: big vs small impact',
    apply: seedBigSmallImpact,
    enabled: false,
  },
};

export const DEFAULT_SEED_KEY = 'solar';
