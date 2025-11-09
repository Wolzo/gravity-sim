/**
 * Produce a visual descriptor for debris fragments.
 * Each fragment is roughly circular but with a noisy outline,
 * so it looks like a broken piece of a larger body.
 */
export function createDebrisShape() {
  const sides = 6 + Math.floor(Math.random() * 4); // 6–9 "edge samples"
  const vertexJitter = [];

  for (let i = 0; i < sides; i++) {
    // Radial factor for each vertex (0.6–1.4 of base radius)
    vertexJitter.push(0.6 + Math.random() * 0.8);
  }

  return {
    type: 'fragment',
    sides,
    angle: Math.random() * Math.PI * 2,
    vertexJitter,
  };
}
