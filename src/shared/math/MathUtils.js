/**
 * Clamps `value` to the inclusive range [min, max].
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function pseudoRandom(a, b) {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Formats a numeric value for HUD display:
 * - uses scientific notation for very small or very large magnitudes
 * - otherwise chooses a reasonable number of decimal places.
 */
export function formatValue(v) {
  if (!Number.isFinite(v)) return '—';

  const abs = Math.abs(v);
  if (abs === 0) return '0';

  if (abs >= 1e4 || abs < 1e-3) {
    return v.toExponential(2);
  }

  if (abs >= 10) {
    return v.toFixed(1);
  }

  if (abs >= 1) {
    return v.toFixed(2);
  }

  return v.toPrecision(3);
}

/**
 * Calculates the escape velocity from a body (or system of bodies).
 * Formula: v_esc = sqrt(2 * G * M / R)
 */
export function computeEscapeVelocity(G, totalMass, radius, softening = 0) {
  const denom = radius + softening;
  if (!Number.isFinite(G) || !Number.isFinite(totalMass) || denom <= 0) {
    return 0;
  }
  return Math.sqrt((2 * G * totalMass) / denom);
}

/**
 * Calculates the center-of-mass velocity for a two-body system.
 */
export function computeCenterOfMassVelocity(m1, v1, m2, v2) {
  const totalMass = m1 + m2;
  if (!Number.isFinite(totalMass) || totalMass === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: (v1.x * m1 + v2.x * m2) / totalMass,
    y: (v1.y * m1 + v2.y * m2) / totalMass,
  };
}
