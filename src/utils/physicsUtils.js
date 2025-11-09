/**
 * Center-of-mass velocity for a two-body system.
 * v_cm = (m1*v1 + m2*v2) / (m1 + m2)
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

/**
 * Escape velocity from a body (or pair treated as one) of totalMass and radius.
 * v_esc = sqrt(2 G M / (R + softening))
 */
export function computeEscapeVelocity(G, totalMass, radius, softening = 0) {
  const denom = radius + softening;
  if (!Number.isFinite(G) || !Number.isFinite(totalMass) || denom <= 0) {
    return 0;
  }

  return Math.sqrt((2 * G * totalMass) / denom);
}
