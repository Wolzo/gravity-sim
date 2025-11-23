/**
 * Minimal 2D renderer for the gravity simulation.
 * Optimized with View Culling for bodies and Adaptive Stride for trails.
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

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.ctx.imageSmoothingEnabled = false;
  }

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

    const margin = 100 / zoom;
    const viewLeft = camX - margin;
    const viewTop = camY - margin;
    const viewRight = camX + width / zoom + margin;
    const viewBottom = camY + height / zoom + margin;

    const bodies = this.simulation.bodies;
    const fadingTrails = this.simulation.fadingTrails;

    if (fadingTrails) {
      for (const ft of fadingTrails) {
        this._drawPolyLine(ft.points, ft.color, ft.life, zoom);
      }
    }

    for (const body of bodies) {
      this._drawTrail(body, zoom);
    }

    for (const body of bodies) {
      const r = body.radius;
      if (
        body.position.x + r >= viewLeft &&
        body.position.x - r <= viewRight &&
        body.position.y + r >= viewTop &&
        body.position.y - r <= viewBottom
      ) {
        this._drawBody(body, zoom, body === this.selectedBody);
      }
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
      ctx.lineWidth = 2.0 / zoom;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawTrail(body, zoom) {
    if (body.trail.length < 2) return;
    this._drawPolyLine(body.trail, body.color, 0.5, zoom);
  }

  _drawPolyLine(points, color, opacity, zoom) {
    const len = points.length;
    if (len < 2) return;

    const { ctx } = this;

    let stride = 1;
    if (zoom < 0.5) stride = 2;
    if (zoom < 0.1) stride = 4;
    if (zoom < 0.05) stride = 8;
    if (zoom < 0.01) stride = 20;

    const maxVerts = 2000;
    if (len / stride > maxVerts) {
      stride = Math.ceil(len / maxVerts);
    }

    ctx.lineWidth = 1.5 / (zoom * 1.8);
    ctx.strokeStyle = color || '#ffffff';
    ctx.globalAlpha = opacity;

    ctx.beginPath();
    let firstPoint = true;

    for (let i = 0; i < len; i += stride) {
      const p = points[i];
      if (firstPoint) {
        ctx.moveTo(p.x, p.y);
        firstPoint = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }

    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  _drawDebrisShape(ctx, body, x, y, radius) {
    const shape = body.shape || {};
    const sides = Math.max(3, shape.sides || 6);
    const angle = shape.angle || 0;
    const vertexJitter = shape.vertexJitter || null;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * Math.PI * 2;
      const jitter = vertexJitter ? vertexJitter[i % vertexJitter.length] : 1.0;

      const px = Math.cos(t) * radius * jitter;
      const py = Math.sin(t) * radius * jitter;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
