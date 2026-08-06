// starfield.js
export class Starfield {
  constructor(width, height, config = {}) {
    this.width = width;
    this.height = height;

    this.starCount = config.starCount ?? 120;
    this.speed = config.speed ?? 12; // vertical drift
    this.stars = [];

    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(this._createStar());
    }
  }

  _createStar() {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size: Math.random() * 1.8 + 0.4,
      brightness: 0.3 + Math.random() * 0.7,
      depth: 0.4 + Math.random() * 0.8
    };
  }

  update(dt) {
    for (const s of this.stars) {
      s.y += this.speed * dt * s.depth;

      if (s.y > this.height) {
        s.y = -5;
        s.x = Math.random() * this.width;
      }
    }
  }

  render(ctx) {
    ctx.save();

    for (const s of this.stars) {
      ctx.globalAlpha = s.brightness;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
