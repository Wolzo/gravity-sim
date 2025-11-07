import { Vec2 } from "./vector2.js";
import { Body } from "./body.js";

const CREATION_STATES = {
    IDLE: "IDLE",
    RADIUS: "RADIUS",
    VELOCITY: "VELOCITY",
};

export class CreationController {
    constructor(simulation, canvas, hud) {
        this.simulation = simulation;
        this.canvas = canvas;
        this.hud = hud;
        this.mode = CREATION_STATES.IDLE;
        this.center = null;
        this.radius = 0;
        this.lastMouse = null;
        this.velocityScale = 0.05;

        this.hudElement = document.getElementById("hud");

        this.minRadius = 5;
        this.maxRadius = 160;
        this.minArrowLength = 0;
        this.maxArrowLength = 600;

        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);

        this._attachEventListeners();
    }

    _isInHud(event) {
        if (!this.hudElement) return false;

        const rect = this.hudElement.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    _attachEventListeners() {
        this.canvas.addEventListener("mousedown", this._onMouseDown);
        this.canvas.addEventListener("mousemove", this._onMouseMove);
        window.addEventListener("keydown", this._onKeyDown);
        this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this._onMouseDown);
        this.canvas.removeEventListener("mousemove", this._onMouseMove);
        window.removeEventListener("keydown", this._onKeyDown);
    }

    _onMouseDown(event) {
        if (this._isInHud(event)) {
            this._reset();
            return;
        }

        if (event.target !== this.canvas) return;

        const pos = this._getMousePos(event);

        if (event.button === 2 && this.mode !== CREATION_STATES.IDLE) {
            this._reset();
            return;
        }

        if (event.button !== 0) return;

        switch (this.mode) {
            case CREATION_STATES.IDLE:
                this.hud.toggleRunning(true);

                this.mode = CREATION_STATES.RADIUS;
                this.center = pos;
                break;

            case CREATION_STATES.RADIUS:
                this.mode = CREATION_STATES.VELOCITY;
                break;

            case CREATION_STATES.VELOCITY:
                this._finalizeBody(pos);
                this._reset();
                break;
        }
    }

    _onMouseMove(event) {
        const pos = this._getMousePos(event);
        this.lastMouse = pos;

        if (this.mode === CREATION_STATES.RADIUS && this.center) {
            const dist = this._distance(this.center, pos);
            this.radius = clamp(dist, this.minRadius, this.maxRadius);
        }
    }

    _onKeyDown(event) {
        if (event.key === "Escape" && this.mode !== CREATION_STATES.IDLE) {
            this._reset();
        }
    }

    _getMousePos(event) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    _distance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _finalizeBody(pos) {
        const velocity = {
            x: (pos.x - this.center.x) * this.velocityScale,
            y: (pos.y - this.center.y) * this.velocityScale,
        };

        const mass = Math.PI * (this.radius * this.radius) * 0.5;
        const body = new Body({
            position: new Vec2(this.center.x, this.center.y),
            velocity: new Vec2(velocity.x, velocity.y),
            mass,
            radius: this.radius,
            color: "#fff",
        });

        this.simulation.addBody(body);
    }

    _reset() {
        this.mode = CREATION_STATES.IDLE;
        this.center = null;
        this.radius = 0;
        this.lastMouse = null;
        this.hud.toggleRunning(false);
    }

    drawPreview(canvas) {
        const ctx = canvas.getContext("2d");
        if ((this.mode === CREATION_STATES.RADIUS || this.mode === CREATION_STATES.VELOCITY) && this.center && this.radius > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.center.x, this.center.y, this.radius, 0, 2 * Math.PI);

            ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
            ctx.fill();

            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.stroke();
            ctx.restore();
        }

        if (this.mode === CREATION_STATES.VELOCITY && this.center && this.lastMouse) {
            const dx = this.lastMouse.x - this.center.x;
            const dy = this.lastMouse.y - this.center.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len > 0.0001) {
                const clampedLen = clamp(len, this.minArrowLength, this.maxArrowLength);
                const ux = dx / len;
                const uy = dy / len;

                const startX = this.center.x;
                const startY = this.center.y;
                const endX = this.center.x + ux * clampedLen;
                const endY = this.center.y + uy * clampedLen;

                const headSize = 10;

                ctx.save();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
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
                ctx.fill();

                ctx.restore();
            }
        }
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}