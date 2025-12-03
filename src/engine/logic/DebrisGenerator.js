import Delaunator from 'delaunator';

/**
 * Generates a simple jagged polygon shape for visual debris.
 */
function createDebrisShape() {
  const sides = 7 + Math.floor(Math.random() * 8);
  const vertexJitter = [];

  for (let i = 0; i < sides; i++) {
    vertexJitter.push(0.6 + Math.random() * 0.8);
  }

  return {
    type: 'fragment',
    sides,
    angle: Math.random() * Math.PI * 2,
    vertexJitter,
  };
}

/**
 * Generates Voronoi-like shards using Delaunay triangulation.
 * Includes a safety cap to prevent CPU freezing on large inputs.
 */
export function generateDelaunayShapes(radius, count) {
  const safeCount = Math.min(Math.floor(count), 50);

  if (safeCount < 3) {
    return [createDebrisShape()];
  }

  const points = [];
  const densityMultiplier = 1.5;
  const numPoints = Math.ceil(safeCount * densityMultiplier) + 5;

  points.push([0, 0]);

  const borderPoints = Math.max(8, Math.ceil(safeCount * 0.6));
  for (let i = 0; i < borderPoints; i++) {
    const t = (i / borderPoints) * Math.PI * 2;
    points.push([Math.cos(t) * radius, Math.sin(t) * radius]);
  }

  for (let i = 0; i < numPoints; i++) {
    const r = radius * Math.sqrt(Math.random()) * 0.95;
    const t = Math.random() * Math.PI * 2;
    points.push([Math.cos(t) * r, Math.sin(t) * r]);
  }

  const delaunay = new Delaunator(points.flat());
  const allShards = [];

  const totalArea = Math.PI * radius * radius;
  const avgArea = totalArea / safeCount;
  const maxAllowedArea = avgArea * 1.6;

  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const p0 = points[delaunay.triangles[i]];
    const p1 = points[delaunay.triangles[i + 1]];
    const p2 = points[delaunay.triangles[i + 2]];

    const triangleArea = Math.abs(
      (p0[0] * (p1[1] - p2[1]) + p1[0] * (p2[1] - p0[1]) + p2[0] * (p0[1] - p1[1])) / 2
    );

    if (triangleArea > maxAllowedArea) continue;

    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cy = (p0[1] + p1[1] + p2[1]) / 3;

    allShards.push([
      [p0[0] - cx, p0[1] - cy],
      [p1[0] - cx, p1[1] - cy],
      [p2[0] - cx, p2[1] - cy],
    ]);
  }

  if (allShards.length === 0) {
    return [createDebrisShape()];
  }

  return allShards;
}
