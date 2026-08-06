// laser.js
// Sweet spot is based on HEAT (stable under tapping).
// Power is based on holdTime (charge), used for DPS and heat generation.

export class Laser {
  constructor(config = {}) {
    // Charging
    this.chargeTime = config.chargeTime ?? 0.6;
    this.power = 0; // 0..1

    // Heat
    this.heat = 0;       // 0..maxHeat
    this.maxHeat = config.maxHeat ?? 1;
    this.heatRate = config.heatRate ?? 0.95; // heat gain per second at power=1
    this.coolRate = config.coolRate ?? 0.55; // heat loss per second when not firing
    this.isOverheated = false;

    // Sweet spot on HEAT bar (0..1)
    this.sweetSpotCenter = config.sweetSpotCenter ?? 0.62;
    this.sweetSpotWidth = config.sweetSpotWidth ?? 0.22;

    this.sweetFactor = 0;       // 0..1, 1 at center of sweet spot
    this.sweetMultiplier = 1;   // 1..(1+bonus)
    this.sweetBonus = config.sweetBonus ?? 1.5; // multiplier bonus at perfect: 1 + 1.5 = 2.5x

    // Optional visuals
    this.overheatFlash = 0;
  }

  update(dt, isPointerDown, holdTime) {
    // Power from holdTime
    this.power = Math.max(0, Math.min(1, holdTime / this.chargeTime));

    // Heat dynamics
    if (this.isOverheated) {
      this.heat -= this.coolRate * dt;

      if (this.heat <= this.maxHeat * 0.25) {
        this.isOverheated = false;
      }

      this.heat = Math.max(0, this.heat);
      this.power = 0;
    } else {
      if (isPointerDown && this.power > 0) {
        this.heat += this.power * this.heatRate * dt;

        if (this.heat >= this.maxHeat) {
          this.heat = this.maxHeat;
          this.isOverheated = true;
          this.overheatFlash = 0.12;
        }
      } else {
        this.heat -= this.coolRate * dt;
      }

      this.heat = Math.max(0, Math.min(this.maxHeat, this.heat));
    }

    if (this.overheatFlash > 0) {
      this.overheatFlash -= dt;
      if (this.overheatFlash < 0) this.overheatFlash = 0;
    }

    // Sweet spot based on HEAT, with clamped bounds so it scales correctly near 0/1.
    const heat01 = this.maxHeat > 0 ? (this.heat / this.maxHeat) : 0;

    const desiredHalf = this.sweetSpotWidth * 0.5;
    const start = Math.max(0, this.sweetSpotCenter - desiredHalf);
    const end = Math.min(1, this.sweetSpotCenter + desiredHalf);

    // Effective center and half-width after clamping
    const center = (start + end) * 0.5;
    const half = (end - start) * 0.5;

    let factor = 0;
    if (half > 0) {
      const dist = Math.abs(heat01 - center);
      factor = 1 - (dist / half);
      if (factor < 0) factor = 0;
      if (factor > 1) factor = 1;
    }

    this.sweetFactor = factor; // 0..1
    this.sweetMultiplier = 1 + this.sweetFactor * this.sweetBonus;
    this._timeSeconds = (this._timeSeconds ?? 0) + dt;
  }

  render(ctx, baseWidth, baseHeight) {

    const x = baseWidth / 2;

    // Ship base anchor
    const baseY = baseHeight - 90;

    const p = Math.max(0, Math.min(1, this.power ?? 0));
    const firing = !this.isOverheated && p > 0.02;

    // Define the exact nozzle tip position (beam origin)
    // Keep this consistent with _renderShipBase geometry.
    const nozzleTip = { x, y: baseY - 55 };

    // Nozzle micro-shake (only when firing)
    let nozzleShakeX = 0;
    let nozzleShakeY = 0;
    if (firing) {
      // deterministic, stable jitter based on time
      const t = (this._timeSeconds ?? 0) * 70; // _timeSeconds set in update() below
      const s = 0.6 + 1.6 * p; // amplitude grows with power
      nozzleShakeX = Math.sin(t * 0.9) * s;
      nozzleShakeY = Math.sin(t * 1.3 + 3.1) * (s * 0.55);
    }

    // Render ship (pass shake so nozzle moves)
    this._renderShipBase(ctx, x, baseY, nozzleShakeX, nozzleShakeY);

    // Beam comes from nozzle tip (with same shake applied)
    const originX = nozzleTip.x + nozzleShakeX;
    const originY = nozzleTip.y + nozzleShakeY;

    if (!firing) return;

    const targetY = baseHeight / 2;
    const w = 8 + p * 20;

    // Glow beam
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.35 * p;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.strokeStyle = "#3ed2d1";
    ctx.lineWidth = w * 2.6;
    ctx.moveTo(originX, originY);
    ctx.lineTo(x, targetY);
    ctx.stroke();
    ctx.restore();

    // Core beam
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.strokeStyle = "#d7ffff";
    ctx.lineWidth = w;
    ctx.moveTo(originX, originY);
    ctx.lineTo(x, targetY);
    ctx.stroke();
    ctx.restore();

    // Impact glow
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * p;
    ctx.fillStyle = "#d7ffff";
    ctx.beginPath();
    ctx.arc(x, targetY, 10 + p * 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Nozzle glow at origin (sells contact point)
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * p;
    ctx.fillStyle = "#d7ffff";
    ctx.beginPath();
    ctx.arc(originX, originY, 6 + p * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }




  _renderEmitter(ctx, x, y) {
    const p = Math.max(0, Math.min(1, this.power ?? 0));

    ctx.save();

    // small HUD-safe base plate
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - 44, y + 16, 88, 38);

    // nozzle body
    ctx.fillStyle = "#2b313a";
    ctx.beginPath();
    ctx.moveTo(x - 26, y + 20);
    ctx.lineTo(x + 26, y + 20);
    ctx.lineTo(x, y - 12);
    ctx.closePath();
    ctx.fill();

    // nozzle glow
    ctx.globalAlpha = 0.65 + 0.35 * p;
    ctx.fillStyle = "#3ed2d1";
    ctx.beginPath();
    ctx.arc(x, y + 10, 6 + p * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _renderShipBase(ctx, x, y, nozzleShakeX = 0, nozzleShakeY = 0) {
    const p = Math.max(0, Math.min(1, this.power ?? 0));

    ctx.save();

    // Big hull coming from bottom (off-screen feel)
    ctx.fillStyle = "#1f2630";
    ctx.beginPath();
    ctx.moveTo(x - 140, y + 120);
    ctx.lineTo(x + 140, y + 120);
    ctx.lineTo(x + 60, y - 20);
    ctx.lineTo(x - 60, y - 20);
    ctx.closePath();
    ctx.fill();

    // Inner structure
    ctx.fillStyle = "#2e3947";
    ctx.beginPath();
    ctx.moveTo(x - 50, y - 20);
    ctx.lineTo(x + 50, y - 20);
    ctx.lineTo(x + 20, y - 55);
    ctx.lineTo(x - 20, y - 55);
    ctx.closePath();
    ctx.fill();

    // Nozzle triangle (this is what vibrates)
    const nx = x + nozzleShakeX;
    const ny = (y - 55) + nozzleShakeY;

    ctx.fillStyle = "#141a22";
    ctx.beginPath();
    ctx.moveTo(nx - 18, ny + 18);
    ctx.lineTo(nx + 18, ny + 18);
    ctx.lineTo(nx, ny);
    ctx.closePath();
    ctx.fill();

    // Core emitter glow (always visible)
    ctx.globalAlpha = 0.45 + 0.45 * p;
    ctx.fillStyle = "#3ed2d1";
    ctx.beginPath();
    ctx.arc(nx, ny + 14, 9 + p * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }




  renderHeatBar(ctx, baseWidth, baseHeight) {
    const pad = 24;
    const w = baseWidth - pad * 2;
    const h = 18;

    const x = pad;
    const y = baseHeight - 30;

    // Optional screen flash on overheat
    if (this.overheatFlash > 0) {
      ctx.fillStyle = "rgba(255,0,0,0.22)";
      ctx.fillRect(0, 0, baseWidth, baseHeight);
    }

    // Background
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x, y, w, h);

    // Sweet spot zone, CLAMPED, must match gold damage logic
    const desiredHalf = this.sweetSpotWidth * 0.5;
    const start = Math.max(0, this.sweetSpotCenter - desiredHalf);
    const end = Math.min(1, this.sweetSpotCenter + desiredHalf);

    const sx = x + w * start;
    const sw = w * (end - start);

    ctx.fillStyle = "rgba(0,255,100,0.16)";
    ctx.fillRect(sx, y, sw, h);

    // Heat fill
    const t = Math.max(0, Math.min(1, this.maxHeat > 0 ? (this.heat / this.maxHeat) : 0));
    const fillW = w * t;

    ctx.fillStyle = this.isOverheated ? "#ff5555" : (t > 0.85 ? "#ffb020" : "#3ed2d1");
    ctx.fillRect(x, y, fillW, h);

    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Label
    if (this.isOverheated) {
      ctx.fillStyle = "#ff5555";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("OVERHEATED", baseWidth / 2, y - 8);
    }
  }


}
