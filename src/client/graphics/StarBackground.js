/**
 * Parallax starfield, pre-rendered to an offscreen tile and blitted 3x3 around the
 * viewport.
 *
 * Drawing the stars directly cost `starCount * 9` arc+fill pairs every frame (~8100 at
 * the default count), which measured as the single largest draw cost in the renderer.
 * The field is static in its own space, so it only has to be rasterized when the
 * viewport size changes.
 */
export class StarBackground {
  constructor(canvas, { starCount = 900, parallax = 0.985 } = {}) {
    this.canvas = canvas;
    this.parallax = parallax;
    this.starCount = starCount;

    this.tile = document.createElement('canvas');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.resize();
  }

  /**
   * Viewport size in CSS pixels. The canvas backing store is in device pixels, but
   * drawing happens under a `dpr` transform, so the public units here stay CSS.
   */
  _cssSize() {
    const dpr = window.devicePixelRatio || 1;
    return {
      dpr,
      width: Math.max(1, Math.round(this.canvas.width / dpr)),
      height: Math.max(1, Math.round(this.canvas.height / dpr)),
    };
  }

  resize() {
    const { width, height, dpr } = this._cssSize();
    if (width === this.width && height === this.height && dpr === this.dpr) return;

    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this._render();
  }

  /**
   * Rasterizes a fresh random field into the tile, at device resolution so stars stay
   * crisp when the tile is blitted back at CSS size.
   */
  _render() {
    this.tile.width = Math.max(1, Math.round(this.width * this.dpr));
    this.tile.height = Math.max(1, Math.round(this.height * this.dpr));

    const ctx = this.tile.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = 'white';

    for (let i = 0; i < this.starCount; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const size = 0.3 + Math.random() * 1.1;

      ctx.globalAlpha = 0.3 + Math.random() * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  draw(ctx, camX, camY, width, height) {
    if (width !== this.width || height !== this.height) this.resize();

    const drift = 1 - this.parallax;
    const offsetX = (-camX * drift) % width;
    const offsetY = (-camY * drift) % height;

    for (let tileX = -1; tileX <= 1; tileX++) {
      for (let tileY = -1; tileY <= 1; tileY++) {
        ctx.drawImage(this.tile, offsetX + tileX * width, offsetY + tileY * height, width, height);
      }
    }
  }
}
