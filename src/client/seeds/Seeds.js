import { seedSolarSystem } from './SolarSystem.js';
import { seedGalaxy } from './Galaxy.js';
import { seedBinaryDisk } from './BinaryDisk.js';
import { seedGalacticCollision } from './GalacticCollision.js';
import { seedKesslerSyndrome } from './KesslerSyndrome.js';

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
