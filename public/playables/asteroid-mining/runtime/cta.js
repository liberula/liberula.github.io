// cta.js
export class CTA {
  constructor() {
    this.active = false;

    // Cliffhanger
    this.label = "PLAY NOW";
    this.title = "MEGA LASER LOCKED";
    this.subLabel = "Get the full game to unlock it";

    // Cost logic
    this.requiredCost = 0;
    this.currentValue = 0;

    this.onClick = null;
    this.clicked = false;

    // Anim
    this.alpha = 0;
    this.pulseTime = 0;
  }

  setLabel(text) {
    this.label = String(text ?? "");
  }

  setTitle(text) {
    this.title = String(text ?? "");
  }

  setSubLabel(text) {
    this.subLabel = String(text ?? "");
  }

  // New: cost is data, not a preformatted string
  setCost(required, current) {
    this.requiredCost = Math.max(0, required | 0);
    this.currentValue = Math.max(0, current | 0);
  }

  show() {
    this.active = true;
    this.alpha = 0;
    this.pulseTime = 0;
    this.clicked = false;
  }

  hide() {
    this.active = false;
  }

  _canAfford() {
    if (this.requiredCost <= 0) return true;
    return this.currentValue >= this.requiredCost;
  }

  canActivate() {
    return this.active && !this.clicked && this._canAfford();
  }

  _getButtonRect(baseWidth, baseHeight) {
    const btnW = 440;
    const btnH = 112;
    const bx = baseWidth / 2 - btnW / 2;
    const by = baseHeight * 0.60 - btnH / 2;
    return { bx, by, btnW, btnH };
  }

  _getCardRect(baseWidth, baseHeight) {
    const w = 560;
    const h = 420;
    const x = baseWidth / 2 - w / 2;
    const y = baseHeight * 0.46 - h / 2;
    return { x, y, w, h };
  }

  containsButton(x, y, baseWidth, baseHeight) {
    const { bx, by, btnW, btnH } = this._getButtonRect(baseWidth, baseHeight);
    return x >= bx && x <= bx + btnW && y >= by && y <= by + btnH;
  }

  activate() {
    if (!this.canActivate()) return false;
    this.clicked = true;
    if (this.onClick) this.onClick();
    return true;
  }

  update(dt) {
    if (!this.active) return;

    this.pulseTime += dt;
    // smooth-ish fade in
    this.alpha = Math.min(1, this.alpha + dt * 2.6);
  }

  render(ctx, baseWidth, baseHeight) {
    if (!this.active) return;

    ctx.save();
    ctx.globalAlpha *= this.alpha;

    // Overlay
    ctx.fillStyle = "rgba(0,0,0,0.74)";
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Card
    const card = this._getCardRect(baseWidth, baseHeight);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(card.x + 10, card.y + 12, card.w, card.h);

    // Body
    ctx.fillStyle = "rgba(18,24,32,0.92)";
    ctx.fillRect(card.x, card.y, card.w, card.h);

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 3;
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.title, baseWidth / 2, card.y + 38);

    // Sub
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "24px sans-serif";
    ctx.fillText(this.subLabel, baseWidth / 2, card.y + 96);

    // Divider line
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(card.x + 40, card.y + 150);
    ctx.lineTo(card.x + card.w - 40, card.y + 150);
    ctx.stroke();

    // Cost block (near button, not floating)
    const need = Math.max(0, this.requiredCost - this.currentValue);
    const canAfford = this._canAfford();

    const costY = card.y + 172;

    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.font = "24px sans-serif";
    ctx.fillText("REQUIRES", baseWidth / 2, costY);

    ctx.font = "34px sans-serif";
    ctx.fillStyle = canAfford ? "#3ed2d1" : "#ff5555";
    const costText = this.requiredCost > 0 ? `${this.requiredCost}` : "0";
    ctx.fillText(costText, baseWidth / 2, costY + 34);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "22px sans-serif";
    ctx.fillText("ORE", baseWidth / 2, costY + 76);

    if (!canAfford && this.requiredCost > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "22px sans-serif";
      ctx.fillText(`Need ${need} more`, baseWidth / 2, costY + 110);
    }

    // Button pulse (only if clickable)
    const buttonEnabled = canAfford && !this.clicked;
    const pulse = buttonEnabled ? (1 + Math.sin(this.pulseTime * 6) * 0.03) : 1.0;

    const { bx, by, btnW, btnH } = this._getButtonRect(baseWidth, baseHeight);

    ctx.save();
    ctx.translate(baseWidth / 2, by + btnH / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-baseWidth / 2, -(by + btnH / 2));

    // Button body
    ctx.fillStyle = buttonEnabled ? "#3ed2d1" : "rgba(120,140,150,0.55)";
    ctx.fillRect(bx, by, btnW, btnH);

    // Button highlight strip
    ctx.fillStyle = buttonEnabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)";
    ctx.fillRect(bx, by, btnW, btnH * 0.36);

    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 5;
    ctx.strokeRect(bx, by, btnW, btnH);

    // Label
    ctx.fillStyle = buttonEnabled ? "#001012" : "rgba(0,0,0,0.55)";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.clicked ? "CLICK REGISTERED" : this.label, baseWidth / 2, by + btnH * 0.52);

    ctx.restore();

    // Tiny footer hint
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = this.clicked ? "24px sans-serif" : "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      this.clicked ? "Store redirect disabled in portfolio build" : "Tap the button to continue",
      baseWidth / 2,
      by + btnH + 20
    );

    ctx.restore();
  }
}
