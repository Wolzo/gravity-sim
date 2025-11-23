/**
 * Minimal 2D renderer for the gravity simulation.
 * Handles canvas DPI and draws trails + bodies.
 */
export class Renderer {
  constructor(canvas, simulation, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.simulation = simulation;
    this.camera = camera;
    this.dpr = window.devicePixelRatio || 1;
    this.selectedBody = null;
    this.resize();
  }

  setSelectedBody(body) {
    this.selectedBody = body || null;
  }

  /**
   * Resize the backing canvas buffer to match its CSS size multiplied by DPR.
   * Must be called on window resize for crisp rendering.
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Render a full frame:
   * - clears the screen
   * - applies the camera transform (position + zoom)
   * - draws all trails and bodies in world space.
   */
  draw() {
    const { ctx, canvas, dpr, camera } = this;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050816';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();

    const zoom = camera?.zoom ?? 1;
    const camX = camera?.position.x ?? 0;
    const camY = camera?.position.y ?? 0;

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);

    for (const body of this.simulation.bodies) {
      this._drawTrail(body, zoom);
    }

    for (const body of this.simulation.bodies) {
      this._drawBody(body, zoom, body === this.selectedBody);
    }

    ctx.restore();
  }

  _drawBody(body, zoom, isSelected = false) {
    const { ctx } = this;

    const x = body.position.x;
    const y = body.position.y;
    const radius = body.radius;

    ctx.fillStyle = body.color || '#ffffff';

    if (body.isDebris && body.shape) {
      this._drawDebrisShape(ctx, body, x, y, radius);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isSelected) {
      ctx.save();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawTrail(body, zoom) {
    const trail = body.trail;
    const len = trail.length;
    if (len < 2) return;

    const { ctx } = this;

    ctx.lineWidth = 2;
    ctx.strokeStyle = body.color || '#ffffff';

    const TARGET_SEGMENTS = 500;
    let stride = 1;

    if (len > TARGET_SEGMENTS) {
      stride = Math.floor(len / TARGET_SEGMENTS);
    }

    if (stride > 16) stride = 16;

    if (zoom < 0.1) stride *= 2;

    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);

    let i = 0;
    while (i < len - stride) {
      const nextIndex = i + stride;
      if (stride > 1) {
        const midIndex = Math.floor((i + nextIndex) / 2);
        const pMid = trail[midIndex];
        const pNext = trail[nextIndex];

        ctx.quadraticCurveTo(pMid.x, pMid.y, pNext.x, pNext.y);
      } else {
        const pNext = trail[nextIndex];
        ctx.lineTo(pNext.x, pNext.y);
      }

      i += stride;
    }

    ctx.lineTo(trail[len - 1].x, trail[len - 1].y);

    ctx.stroke();
  }

  _drawDebrisShape(ctx, body, x, y, radius) {
    const shape = body.shape || {};

    const sidesRaw = shape.sides != null ? shape.sides : 6;
    const sides = Math.max(3, sidesRaw | 0);

    const angle = shape.angle || 0;

    const vertexJitter =
      Array.isArray(shape.vertexJitter) && shape.vertexJitter.length > 0
        ? shape.vertexJitter
        : null;

    const rx = radius;
    const ry = radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * Math.PI * 2;

      const jitter = vertexJitter ? vertexJitter[i % vertexJitter.length] : 1.0;

      const px = Math.cos(t) * rx * jitter;
      const py = Math.sin(t) * ry * jitter;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
