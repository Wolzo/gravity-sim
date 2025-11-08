export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const colors = [
  '#c2b28f',
  '#e0c896',
  '#6fa8ff',
  '#ff7043',
  '#f2d1a0',
  '#f5e2b8',
  '#9ad9ff',
  '#5b8cff',
];
export function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

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
