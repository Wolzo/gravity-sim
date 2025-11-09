/**
 * Minimal 2D renderer for the gravity simulation.
 * Handles canvas DPI and draws trails + bodies.
 */
export class Renderer {
  constructor(canvas, simulation, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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
      ctx.lineWidth = 2 / zoom;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawTrail(body, zoom) {
    const { ctx } = this;
    if (!body.trail || body.trail.length < 2) return;

    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.8 / zoom;
    ctx.strokeStyle = body.color || '#ffffff';

    ctx.beginPath();
    const first = body.trail[0];
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < body.trail.length; i++) {
      const p = body.trail[i];
      ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();
    ctx.restore();
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
