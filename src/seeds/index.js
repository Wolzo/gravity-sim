import { seedSolarSystem } from './solarSystem.js';
import { seedGalaxy } from './galaxy.js';
import { seedBinaryDisk } from './binaryDisk.js';
import { seedGalacticCollision } from './galacticCollision.js';
import { seedKesslerSyndrome } from './kesslerSyndrome.js';

export const SEEDS = {
  solar: {
    label: 'Solar System',
    apply: seedSolarSystem,
    enabled: true,
  },
  galaxy: {
    label: 'Spiral Galaxy',
    apply: seedGalaxy,
    enabled: true,
  },
  binaryDisk: {
    label: 'Binary Star & Disk',
    apply: seedBinaryDisk,
    enabled: true,
  },
  galacticCollision: {
    label: 'Galactic Collision',
    apply: seedGalacticCollision,
    enabled: true,
  },
  kessler: {
    label: 'Kessler Syndrome (Chaos)',
    apply: seedKesslerSyndrome,
    enabled: true,
  },
};

export const DEFAULT_SEED_KEY = 'solar';
