// debris.js
export class DebrisSystem {
  constructor(config = {}) {
    this.enabled = config.enabled ?? true;

    // NEW: optional SpriteSheet for shards
    this.sheet = config.sheet ?? null; // SpriteSheet or null
    this.frameCount = config.frameCount ?? (this.sheet ? this.sheet.frameCount : 0);

    this.countPerBreak = config.countPerBreak ?? 16;
    this.minSpeed = config.minSpeed ?? 220;
    this.maxSpeed = config.maxSpeed ?? 520;
    this.drag = config.drag ?? 2.0;
    this.lifeMin = config.lifeMin ?? 0.55;
    this.lifeMax = config.lifeMax ?? 1.05;

    this.minScale = config.minScale ?? 0.35;
    this.maxScale = config.maxScale ?? 0.75;

    // Fallback rect look
    this.rectSizeMin = config.rectSizeMin ?? 6;
    this.rectSizeMax = config.rectSizeMax ?? 14;

    // Color (only used for fallback rects)
    this.baseColor = config.baseColor ?? "#2a2f36";

    this.particles = [];
  }

  setSheet(sheet) {
    this.sheet = sheet;
    this.frameCount = sheet ? sheet.frameCount : 0;
  }

  spawnBreak(x, y, intensity = 1, framePool = null) {
    if (!this.enabled) return;

    const n = Math.max(1, Math.floor(this.countPerBreak * intensity));

    // sanitize pool
    const pool = Array.isArray(framePool) && framePool.length > 0 ? framePool : null;

    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp =
        this._lerp(this.minSpeed, this.maxSpeed, Math.random()) *
        (0.8 + 0.4 * intensity);

      const vx = Math.cos(a) * sp;
      const vy = Math.sin(a) * sp;

      const life = this._lerp(this.lifeMin, this.lifeMax, Math.random());

      // pick frame
      let frame = 0;
      if (this.sheet) {
        if (pool) {
          frame = pool[(Math.random() * pool.length) | 0] | 0;
        } else {
          frame = (Math.random() * (this.frameCount || 1)) | 0;
        }
      }

      const p = {
        x,
        y,
        vx,
        vy,
        life,
        maxLife: life,

        frame,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: this._lerp(-10, 10, Math.random()),
        scale: this._lerp(this.minScale, this.maxScale, Math.random()),

        size: this._lerp(this.rectSizeMin, this.rectSizeMax, Math.random())
      };

      this.particles.push(p);
    }
  }


  update(dt) {
    if (!this.enabled) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // drag
      const dragK = Math.exp(-this.drag * dt);
      p.vx *= dragK;
      p.vy *= dragK;

      // integrate
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // rotate
      p.rot += p.rotSpeed * dt;

      // life
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  render(ctx) {
    if (!this.enabled) return;
    if (this.particles.length === 0) return;

    const useSheet = !!this.sheet;

    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));

      if (useSheet) {
        // Draw shard sprite
        this.sheet.draw(ctx, p.frame, p.x, p.y, {
          scale: p.scale,
          rotation: p.rot,
          alpha: a,
          smooth: true
        });
      } else {
        // Fallback: tiny rect
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = this.baseColor;
        const s = p.size;
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
        ctx.restore();
      }
    }
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }
}
