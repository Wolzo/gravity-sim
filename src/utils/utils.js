export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

const colors = [ "#c2b28f", "#e0c896", "#6fa8ff", "#ff7043", "#f2d1a0", "#f5e2b8", "#9ad9ff", "#5b8cff" ];
export function randomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}