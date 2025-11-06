/**
 * Minimal 2D renderer for the gravity simulation.
 * Handles canvas DPI and draws trails + bodies.
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import("../core/simulation.js").Simulation} simulation
   */
  constructor(canvas, simulation) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;

    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext("2d");

    /** @type {import("../core/simulation.js").Simulation} */
    this.simulation = simulation;

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
    const { ctx, canvas, dpr } = this;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.fillStyle = "#050816";
    ctx.fillRect(0, 0, width, height);

    for (const body of this.simulation.bodies) {
      this._drawTrail(body);
      this._drawBody(body);
    }

    ctx.restore();
  }

  /**
   * @param {import("../core/body.js").Body} body
   * @private
   */
  _drawBody(body) {
    const { ctx } = this;

    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2);
    ctx.fillStyle = body.color || "#ffffff";
    ctx.fill();
  }

  /**
   * @param {import("../core/body.js").Body} body
   * @private
   */
  _drawTrail(body) {
    const { ctx } = this;
    if (!body.trail || body.trail.length < 2) return;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeStyle = body.color || "#ffffff";

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
