/**
 * Minimal 2D renderer for the gravity simulation.
 * Style: Modern Flat with "Neon/Bloom" glow.
 */
export class Renderer {
  constructor(canvas, simulation, camera, eventBus) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.simulation = simulation;
    this.camera = camera;
    this.dpr = window.devicePixelRatio || 1;
    this.selectedBody = null;
    this.eventBus = eventBus;
    this.resize();

    eventBus.on('interaction:select', (body) => {
      this.setSelectedBody(body);
    });
  }

  setSelectedBody(body) {
    this.selectedBody = body || null;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.ctx.imageSmoothingEnabled = true;
  }

  draw() {
    const { ctx, canvas, dpr, camera } = this;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();

    const zoom = camera?.zoom ?? 1;
    const camX = camera?.position.x ?? 0;
    const camY = camera?.position.y ?? 0;

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);

    const margin = 200 / zoom;
    const viewLeft = camX - margin;
    const viewTop = camY - margin;
    const viewRight = camX + width / zoom + margin;
    const viewBottom = camY + height / zoom + margin;

    const bodies = this.simulation.bodies;
    const fadingTrails = this.simulation.fadingTrails;

    if (fadingTrails) {
      for (const ft of fadingTrails) {
        this._drawPolyLine(ft.points, ft.color, ft.life * 0.4, zoom, false);
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

    const color = body.color || '#ffffff';

    const screenRadius = radius * zoom;

    if (body.isDebris && body.shape) {
      ctx.fillStyle = color;
      this._drawDebrisShape(ctx, body, x, y, radius);
      return;
    }

    if (screenRadius > 2) {
      ctx.beginPath();
      const atmoRadius = radius * 1.3;
      ctx.arc(x, y, atmoRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;

    if (screenRadius > 3) {
      ctx.shadowBlur = Math.min(30, screenRadius * 2);
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (isSelected) {
      ctx.save();
      ctx.lineWidth = 2.0 / zoom;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.setLineDash([3 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawTrail(body, zoom) {
    if (body.trail.length < 2) return;
    this._drawPolyLine(body.trail, body.color, 0.4, zoom, true);
  }

  _drawPolyLine(points, color, opacity, zoom, isLiving) {
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

    ctx.lineWidth = (isLiving ? 1.5 : 1.0) / zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = color || '#ffffff';
    ctx.globalAlpha = opacity;

    /*if (zoom > 0.5 && isLiving) {
      ctx.shadowBlur = 5;
      ctx.shadowColor = color;
    }*/

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

    // Reset
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }

  _drawDebrisShape(ctx, body, x, y, radius) {
    // CASO A: Nuovi Triangoli (Array di coordinate)
    if (Array.isArray(body.shape) && body.shape.length > 0) {
      ctx.save();
      ctx.translate(x, y);

      if (body.angle) ctx.rotate(body.angle);

      ctx.beginPath();
      const v = body.shape;

      ctx.moveTo(v[0][0], v[0][1]);
      for (let i = 1; i < v.length; i++) {
        ctx.lineTo(v[i][0], v[i][1]);
      }
      ctx.closePath();

      // Riempimento
      ctx.fillStyle = body.color;
      ctx.fill();

      // SMUSSATURA: Disegna un bordo "rotondo" dello stesso colore del riempimento
      // Questo maschera gli angoli acuti del triangolo
      ctx.lineJoin = 'round';
      ctx.lineWidth = radius * 0.2; // Spessore ~20% del raggio
      ctx.strokeStyle = body.color;
      ctx.stroke();

      ctx.restore();
      return;
    }

    // CASO B: Fallback (Codice originale per esagoni/poligoni)
    const shape = body.shape || {};
    const sides = Math.max(3, shape.sides || 6);
    const angle = shape.angle || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * Math.PI * 2;
      const px = Math.cos(t) * radius;
      const py = Math.sin(t) * radius;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
