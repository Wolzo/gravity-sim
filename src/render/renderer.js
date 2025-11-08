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
    this.resize();
  }

  /**
   * Resize backing buffer to match CSS size * DPR.
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Render a full frame: background + trails + bodies.
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
      this._drawTrail(body);
      this._drawBody(body);
    }

    ctx.restore();
  }

  _drawBody(body) {
    const { ctx } = this;

    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2);
    ctx.fillStyle = body.color || '#ffffff';
    ctx.fill();
  }

  _drawTrail(body) {
    const { ctx } = this;
    if (!body.trail || body.trail.length < 2) return;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
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
}
