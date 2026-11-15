import { RENDER, CREATION_STATES } from '../../shared/config/RenderConfig.js';
import { StarBackground } from './StarBackground.js';
import { GlowSprites, GLOW_SCALE } from './GlowSprites.js';

/** Number of alpha/width steps used to fade a trail from tail to head. */
const TRAIL_BANDS = 6;

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

    this.glowSprites = new GlowSprites();

    /**
     * Living trails bucketed by colour, reused every frame.
     * strokeStyle cannot change mid-path, so batching the banded fade requires one
     * bucket per colour; this keeps the stroke count at (colours x bands) instead of
     * (bodies x bands).
     */
    this.trailBuckets = new Map();

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

    if (this.starBackground) this.starBackground.resize();
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

    this.starBackground.draw(ctx, camX, camY, width, height);

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

    this._drawTrails(bodies, fadingTrails, zoom, viewLeft, viewTop, viewRight, viewBottom);

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

  /**
   * Draws every visible trail.
   *
   * Living trails are bucketed by colour and stroked band by band, so the alpha and
   * width gradient is actually rendered: Canvas2D resolves globalAlpha/lineWidth at
   * `stroke()` time, so the previous version — which varied them inside the loop but
   * issued a single stroke — paid for the gradient without ever showing it.
   *
   * Fading trails get one flat stroke each: they are short-lived and comparatively few,
   * and their alpha already carries the dissolve.
   */
  _drawTrails(bodies, fadingTrails, zoom, viewLeft, viewTop, viewRight, viewBottom) {
    const { ctx } = this;

    for (const bucket of this.trailBuckets.values()) bucket.length = 0;

    for (const body of bodies) {
      const trail = body.trail;
      if (trail.length < 2) continue;
      if (!trail.intersectsRect(viewLeft, viewTop, viewRight, viewBottom)) continue;

      const color = body.color || '#ffffff';
      let bucket = this.trailBuckets.get(color);
      if (!bucket) {
        bucket = [];
        this.trailBuckets.set(color, bucket);
      }
      bucket.push(trail);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const baseWidth = 1.5 / zoom;

    for (const [color, bucket] of this.trailBuckets) {
      if (bucket.length === 0) continue;

      ctx.strokeStyle = color;

      for (let band = 0; band < TRAIL_BANDS; band++) {
        const t0 = band / TRAIL_BANDS;
        const t1 = (band + 1) / TRAIL_BANDS;
        const tMid = (t0 + t1) * 0.5;

        ctx.globalAlpha = tMid * tMid * 0.55;
        ctx.lineWidth = baseWidth * (0.3 + 0.7 * tMid);

        ctx.beginPath();
        for (const trail of bucket) {
          this._emitTrailBand(trail, t0, t1, zoom);
        }
        ctx.stroke();
      }
    }

    if (fadingTrails) {
      for (const ft of fadingTrails) {
        const trail = ft.trail;
        if (!trail || trail.length < 2) continue;
        if (!trail.intersectsRect(viewLeft, viewTop, viewRight, viewBottom)) continue;

        ctx.strokeStyle = ft.color || '#ffffff';
        ctx.globalAlpha = Math.max(0, ft.life) * 0.4;
        ctx.lineWidth = baseWidth;

        ctx.beginPath();
        this._emitTrailBand(trail, 0, 1, zoom);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Appends the [t0, t1] slice of a trail to the current path.
   * Bands share their boundary vertex so consecutive bands join without gaps.
   */
  _emitTrailBand(trail, t0, t1, zoom) {
    const n = trail.length;
    if (n < 2) return;

    const last = n - 1;
    const from = Math.floor(t0 * last);
    const to = Math.ceil(t1 * last);
    if (to <= from) return;

    let stride = 1;
    if (zoom < 0.5) stride = 2;
    if (zoom < 0.1) stride = 3;
    if (zoom < 0.05) stride = 5;
    if (zoom < 0.01) stride = 10;

    const span = to - from;
    const maxVerts = Math.ceil(2000 / TRAIL_BANDS);
    if (span / stride > maxVerts) {
      stride = Math.ceil(span / maxVerts);
    }

    const { ctx } = this;
    ctx.moveTo(trail.getX(from), trail.getY(from));

    for (let i = from + stride; i < to; i += stride) {
      ctx.lineTo(trail.getX(i), trail.getY(i));
    }

    // Always land exactly on the band boundary, whatever the stride.
    ctx.lineTo(trail.getX(to), trail.getY(to));
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
        ctx.fillStyle = RENDER.COLOR_PREVIEW_FILL;
        ctx.fill();
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = RENDER.COLOR_PREVIEW_STROKE;
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
          ctx.strokeStyle = RENDER.COLOR_ARROW;
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
          ctx.fillStyle = RENDER.COLOR_ARROW;
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

    if (body.isDebris && body.shape) {
      ctx.fillStyle = color;
      this._drawDebrisShape(ctx, body, x, y, radius);
      return;
    }

    const screenRadius = radius * zoom;
    if (screenRadius > 2) {
      this._drawGlow(body, color);
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected) {
      ctx.lineWidth = 1.8 / zoom;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /**
   * Blits the cached glow texture for this body's colour, scaled to its radius.
   */
  _drawGlow(body, color) {
    const { ctx } = this;
    const sprite = this.glowSprites.get(color);
    const size = body.radius * GLOW_SCALE;
    const half = size / 2;

    ctx.drawImage(sprite, body.position.x - half, body.position.y - half, size, size);
  }

  _drawDebrisShape(ctx, body, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    if (body.angle) ctx.rotate(body.angle);

    ctx.beginPath();

    if (Array.isArray(body.shape) && body.shape.length > 0) {
      const v = body.shape;
      ctx.moveTo(v[0][0], v[0][1]);
      for (let i = 1; i < v.length; i++) {
        ctx.lineTo(v[i][0], v[i][1]);
      }
    } else {
      const shape = body.shape || {};
      const sides = Math.max(3, shape.sides || 6);
      const jitter = shape.vertexJitter;

      for (let i = 0; i < sides; i++) {
        const t = (i / sides) * Math.PI * 2;
        const r = radius * (jitter ? jitter[i % jitter.length] : 1);
        const px = Math.cos(t) * r;
        const py = Math.sin(t) * r;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }

    ctx.closePath();

    ctx.fillStyle = body.color;
    ctx.fill();

    // A thick same-colour stroke fattens sub-pixel shards so they stay visible.
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 0.2;
    ctx.strokeStyle = body.color;
    ctx.stroke();

    ctx.restore();
  }
}
