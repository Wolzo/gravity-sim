import Delaunator from 'delaunator';

/**
 * Produce a visual descriptor for debris fragments.
 * Each fragment is roughly circular but with a noisy outline,
 * so it looks like a broken piece of a larger body.
 */
export function createDebrisShape() {
  const sides = 7 + Math.floor(Math.random() * 8); // 7–14 "edge samples"
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

export function generateDelaunayShapes(radius, count) {
  const points = [];

  // Aumentiamo i punti candidati (+50%) per avere margine di filtraggio
  const densityMultiplier = 1.5;
  const numPoints = Math.ceil(count * densityMultiplier) + 5;

  // 1. Punto Centrale (FONDAMENTALE per evitare "sliver" che attraversano il cerchio)
  points.push([0, 0]);

  // 2. Punti Perimetrali
  const borderPoints = Math.max(8, Math.ceil(count * 0.6));
  for (let i = 0; i < borderPoints; i++) {
    const t = (i / borderPoints) * Math.PI * 2;
    points.push([Math.cos(t) * radius, Math.sin(t) * radius]);
  }

  // 3. Punti Interni Casuali
  for (let i = 0; i < numPoints; i++) {
    const r = radius * Math.sqrt(Math.random()) * 0.95; // 0.95 per staccarsi dal bordo
    const t = Math.random() * Math.PI * 2;
    points.push([Math.cos(t) * r, Math.sin(t) * r]);
  }

  // 4. Triangolazione
  const delaunay = new Delaunator(points.flat());
  const allShards = [];

  // Calcolo soglia area massima (media ideale * 1.6)
  const totalArea = Math.PI * radius * radius;
  const avgArea = totalArea / count;
  const maxAllowedArea = avgArea * 1.6;

  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const p0 = points[delaunay.triangles[i]];
    const p1 = points[delaunay.triangles[i + 1]];
    const p2 = points[delaunay.triangles[i + 2]];

    // Calcolo Area
    const triangleArea = Math.abs(
      (p0[0] * (p1[1] - p2[1]) + p1[0] * (p2[1] - p0[1]) + p2[0] * (p0[1] - p1[1])) / 2
    );

    // Salta i triangoli troppo grandi
    if (triangleArea > maxAllowedArea) continue;

    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cy = (p0[1] + p1[1] + p2[1]) / 3;

    // Salva vertici locali (centrati su 0,0 rispetto al frammento)
    allShards.push([
      [p0[0] - cx, p0[1] - cy],
      [p1[0] - cx, p1[1] - cy],
      [p2[0] - cx, p2[1] - cy],
    ]);
  }

  // Fallback: se il filtro è stato troppo aggressivo, restituisci almeno qualcosa
  if (allShards.length === 0) return generateDelaunayShapes(radius, count); // Riprova ricorsivamente (raro)

  return allShards;
}
