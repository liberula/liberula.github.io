export class Asteroid {
  constructor(spriteSheet, timer, config = {}) {
    this.sprite = spriteSheet;
    this.timer = timer;

    this.maxHP = config.maxHP ?? 100;
    this.hp = this.maxHP;
    this.isBoss = false;
    this.damagePerSecond = config.damagePerSecond ?? 35;

    this.isSpawning = false;
    this.spawnT = 0;
    this.spawnDuration = 0.22;

    this.x = config.x ?? 360;
    this.y = config.y ?? 640;

    this.scale = 1;

    this.isBreaking = false;
    this.breakTimerId = null;
    this.respawnDelay = 1;

    this.frameIndex = 0;

    this.onDestroyed = null; // callback opcional
  }

  update(dt, laserPower, isPointerDown) {
    if (!this.isBreaking && isPointerDown) {
      this.hp -= laserPower * this.damagePerSecond * dt;

      if (this.hp <= 0) {
        // If boss is active, don't break (Game will control CTA).
        if (this.isBoss) {
          this.hp = Math.max(1, this.maxHP * 0.02);
        } else {
          this.hp = 0;
          this.break();
        }
      }

    }

    if (this.sprite) {
      if (this.isBreaking) {
        this.frameIndex = this.sprite.frameCount - 1;
      } else {
        const ratio = 1 - (this.hp / this.maxHP);
        this.frameIndex = this.sprite.frameFromRatio(ratio);
      }
    }
  }

  break() {
    this.isBreaking = true;
    if (this.onBreakImpact) this.onBreakImpact();

    if (this.onDestroyed) this.onDestroyed();

    if (this.breakTimerId) {
      this.timer.cancel(this.breakTimerId);
    }

    this.breakTimerId = this.timer.schedule(this.respawnDelay, () => {
      this.hp = this.maxHP;
      this.isBreaking = false;
      this.breakTimerId = null;

      this._beginSpawn();
    });
  }

  render(ctx, globalTime, isTapPunchActive, shakeX = 0, shakeY = 0) {
    if (this.isBreaking) return;

    const pulse = 1 + Math.sin(globalTime * 6) * 0.04;
    const punch = isTapPunchActive ? 0.08 : 0;

    const drawX = this.x + shakeX;
    const drawY = this.y + shakeY;

    // Spawn warp-in (alpha + scale ease)
    let spawnAlpha = 1;
    let spawnScaleMul = 1;

    if (this.isSpawning) {
      this.spawnT += (1 / 60); // render is called every frame, ok for this cheap effect
      const t = Math.max(0, Math.min(1, this.spawnT / this.spawnDuration));
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

      spawnAlpha = ease;
      spawnScaleMul = 0.75 + 0.25 * ease;

      if (t >= 1) this.isSpawning = false;
    }

    ctx.save();
    ctx.globalAlpha *= spawnAlpha;

    this.sprite.draw(ctx, this.frameIndex, drawX, drawY, {
      scale: this.scale * pulse * (1 + punch) * spawnScaleMul,
      smooth: true
    });

    ctx.restore();
    ctx.globalAlpha = 1;

    // HP bar
    const hp01 = this.maxHP > 0 ? (this.hp / this.maxHP) : 0;

    const barW = 220;
    const barH = 14;
    const barX = drawX - barW / 2;

    // se o boss for maior, sobe a barra um pouco
    const barY = drawY - (this.scale > 1.2 ? 210 : 170);

    ctx.fillStyle = "rgba(80,0,0,0.35)";
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = "rgba(255,80,80,0.95)";
    ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, hp01)), barH);

    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  _beginSpawn() {
    this.spawnT = 0;
    this.spawnDuration = 0.22;
    this.isSpawning = true;
  }






}
