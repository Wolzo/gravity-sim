import { RENDER, CREATION_STATES } from '../../shared/config/RenderConfig.js';
import { StarBackground } from './StarBackground.js';

/**
 * Minimal 2D renderer for the gravity simulation.
 * Style: Modern Flat with "Neon/Bloom" glow.
 */
export class Renderer {
  constructor(canvas, eventBus) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = window.devicePixelRatio || 1;
    this.selectedBody = null;
    this.eventBus = eventBus;
    this.preview = null;

    this._resize();
    this._initEvents();

    this.starBackground = new StarBackground(canvas);
  }

  _initEvents() {
    this.eventBus.on('frame:render', (frameObj) =>
      this.draw(
        frameObj.camPos.x,
        frameObj.camPos.y,
        frameObj.camZoom,
        frameObj.bodies,
        frameObj.fadingTrails
      )
    );

    this.eventBus.on('interaction:select', (body) => (this.selectedBody = body || null));
    this.eventBus.on('window:resize', () => this._resize());
    this.eventBus.on('creation:preview', (preview) => (this.preview = preview));
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.ctx.imageSmoothingEnabled = true;
  }

  draw(cameraX, cameraY, cameraZoom, bodies, fadingTrails) {
    const { ctx, canvas, dpr } = this;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const zoom = cameraZoom ?? 1;
    const camX = cameraX ?? 0;
    const camY = cameraY ?? 0;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
    ctx.save();

    this.starBackground.draw(ctx, camX, camY, dpr, width, height);

    ctx.restore();
    ctx.save();

    const cx = width / 2;
    const cy = height / 2;

    ctx.setTransform(
      dpr * zoom,
      0,
      0,
      dpr * zoom,
      (cx - camX * zoom) * dpr,
      (cy - camY * zoom) * dpr
    );

    const margin = 200 / zoom;
    const viewHalfW = width / zoom / 2 + margin;
    const viewHalfH = height / zoom / 2 + margin;

    const viewLeft = camX - viewHalfW;
    const viewTop = camY - viewHalfH;
    const viewRight = camX + viewHalfW;
    const viewBottom = camY + viewHalfH;

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

    this._drawPreview(zoom);

    ctx.restore();
  }

  _drawPreview(zoom) {
    const { ctx } = this;
    if (this.preview && this.preview.center) {
      const c = this.preview.center;
      const last = this.preview.lastMousePos;

      if (this.preview.radius > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.preview.radius, 0, Math.PI * 2);
        ctx.fillStyle = RENDER.COLOR_PREVIEW_FILL || 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = RENDER.COLOR_PREVIEW_STROKE || 'rgba(255,255,255,0.9)';
        ctx.stroke();
        ctx.restore();
      }

      if (this.preview.mode === CREATION_STATES.VELOCITY && last) {
        const dx = last.x - c.x;
        const dy = last.y - c.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.001) {
          const ux = dx / len;
          const uy = dy / len;
          const headSize = 8 / zoom;
          const arrowLen = Math.max(
            RENDER.CREATION_VELOCITY_MIN,
            Math.min(len, RENDER.CREATION_VELOCITY_MAX)
          );

          const startX = c.x;
          const startY = c.y;
          const endX = c.x + ux * arrowLen;
          const endY = c.y + uy * arrowLen;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.lineWidth = 2 / zoom;
          ctx.strokeStyle = RENDER.COLOR_ARROW || '#ffffff';
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - ux * headSize - uy * (headSize * 0.5),
            endY - uy * headSize + ux * (headSize * 0.5)
          );
          ctx.lineTo(
            endX - ux * headSize + uy * (headSize * 0.5),
            endY - uy * headSize - ux * (headSize * 0.5)
          );
          ctx.closePath();
          ctx.fillStyle = RENDER.COLOR_ARROW || '#ffffff';
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  _drawBody(body, zoom, isSelected) {
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
      this._drawGlow(body, screenRadius);
    }
    ctx.save();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, body.radius, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected) {
      ctx.save();
      ctx.lineWidth = 2.0 / zoom;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      //ctx.setLineDash([3 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
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
    ctx.shadowBlur = 0;
  }

  _drawGlow(body, screenRadius) {
    const { ctx } = this;
    const x = body.position.x;
    const y = body.position.y;
    const color = body.color || '#ffffff';

    ctx.save();

    ctx.globalAlpha = 0.3;
    ctx.shadowBlur = screenRadius * 0.45;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, body.radius * 1.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.2;
    ctx.shadowBlur = screenRadius * 0.95;
    ctx.beginPath();
    ctx.arc(x, y, body.radius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.1;
    ctx.shadowBlur = screenRadius * 1.7;
    ctx.beginPath();
    ctx.arc(x, y, body.radius * 1.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawDebrisShape(ctx, body, x, y, radius) {
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

      ctx.fillStyle = body.color;
      ctx.fill();

      ctx.lineJoin = 'round';
      ctx.lineWidth = radius * 0.2;
      ctx.strokeStyle = body.color;
      ctx.stroke();

      ctx.restore();
      return;
    }

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
