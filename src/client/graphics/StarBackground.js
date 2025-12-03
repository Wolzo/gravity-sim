// src/client/graphics/StarBackground.js
export class StarBackground {
  constructor(canvas, { starCount = 900, parallax = 0.995 } = {}) {
    this.canvas = canvas;
    this.parallax = parallax;
    this.starCount = starCount;
    this.stars = [];

    this._generate();
  }

  _generate() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.stars.length = 0;

    for (let i = 0; i < this.starCount; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.3 + Math.random() * 1.1,
        alpha: 0.3 + Math.random() * 0.7,
      });
    }
  }

  draw(ctx, camX, camY, dpr, width, height) {
    ctx.save();

    const offsetX = (-camX * (1 - this.parallax) * dpr) % (width * dpr);
    const offsetY = (-camY * (1 - this.parallax) * dpr) % (height * dpr);

    for (let tileX = -1; tileX <= 1; tileX++) {
      for (let tileY = -1; tileY <= 1; tileY++) {
        ctx.save();

        ctx.translate(offsetX + tileX * width * dpr, offsetY + tileY * height * dpr);

        this._drawStars(ctx);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  _drawStars(ctx) {
    ctx.fillStyle = 'white';

    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
