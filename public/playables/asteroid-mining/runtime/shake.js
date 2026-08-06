// shake.js
export class Shake {
  constructor(config = {}) {
    this.trauma = 0;        // 0..1
    this.target = 0;        // 0..1
    this.x = 0;
    this.y = 0;

    this.maxPx = config.maxPx ?? 14;
    this.response = config.response ?? 14; // rapidez de aproximação do alvo
    this.speed = config.speed ?? 55;       // frequência do shake
  }

  kick(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  setTarget(value01) {
    this.target = Math.max(0, Math.min(1, value01));
  }

  update(dt, timeSeconds) {
    const k = 1 - Math.exp(-this.response * dt);
    this.trauma = this.trauma + (this.target - this.trauma) * k;

    const t = timeSeconds * this.speed;
    const mag = this.maxPx * (this.trauma * this.trauma);

    this.x = Math.sin(t * 0.9) * mag;
    this.y = Math.sin(t * 1.3 + 10.0) * mag;
  }

  getOffset() {
    return { x: this.x, y: this.y };
  }
}
