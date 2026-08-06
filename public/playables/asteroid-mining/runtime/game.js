// game.js
import { Asteroid } from "./asteroid.js";
import { Laser } from "./laser.js";
import { CTA } from "./cta.js";
import { Shake } from "./shake.js";
import { DebrisSystem } from "./debris.js";
import { Starfield } from "./starfield.js";

export class Game {
  // spriteSheet agora é meteorSheets (map id -> SpriteSheet)
  constructor(ctx, meteorSheets, timer, input, config) {
    this.ctx = ctx;
    this.timer = timer;
    this.input = input;
    this.bridge = config.bridge;
    this.emitPlayableEvent = config.emitPlayableEvent;

    this.renderer = config.renderer;
    this.baseWidth = config.baseWidth;
    this.baseHeight = config.baseHeight;

    // IMPORTANT: store sheets map
    this.meteorSheets = meteorSheets;

    // Progression pacing
    this.breaks = 0;
    this.phase = "normal"; // "normal" | "boss" | "cta"
    this.mode = "mining";

    this.resource = 0;
    this.orePerBreak = 50;

    this.bossOreCost = 100;
    this.bossMineTime = 0;

    // Boss tuning
    this.bossHP = 650;
    this.bossDpsScale = 0.85;

    // Sweet profiles (if you still want them)
    this.normalSweetProfiles = [
      { center: 0.55, width: 0.30, bonus: 1.35 },
      { center: 0.70, width: 0.22, bonus: 1.50 }
    ];
    this.profileIndex = 0;

    this.bossSweetProfile = { center: 0.78, width: 0.16, bonus: 1.20 };

    this.shake = new Shake({ maxPx: 14, response: 16, speed: 55 });

    // pick a real SpriteSheet from the map
    const firstSheet =
      this.meteorSheets.rockA ??
      this.meteorSheets.rockB ??
      Object.values(this.meteorSheets)[0];

    if (!firstSheet) {
      throw new Error("Game: meteorSheets is empty, no SpriteSheet available");
    }

    this.asteroid = new Asteroid(firstSheet, timer, {
      maxHP: 100,
      damagePerSecond: 40,
      x: this.baseWidth / 2,
      y: this.baseHeight / 2
    });

    this.currentMeteorId = "rockA"
    this.asteroid._beginSpawn();

    this.laser = new Laser({
      sweetSpotCenter: 0.62,
      sweetSpotWidth: 0.22,
      sweetBonus: 1.5
    });

    this.cta = new CTA();
    this.cta.onClick = () => {
      this.emitPlayableEvent("cta_click");
      this.bridge.openStore();
    };
    this.ctaArmedPointerId = null;

    this.shardPoolsByMeteor = {
      rockA: [0, 1, 2],   // blue
      boss:  [3, 4],      // boss
      rockB: [5]          // green
    };

    this.debris = new DebrisSystem({
      enabled: true,
      sheet: config.shardSheet ?? null,  // IMPORTANT
      countPerBreak: 18,
      minSpeed: 240,
      maxSpeed: 520,
      drag: 2.2,
      lifeMin: 0.6,
      lifeMax: 1.1,
      minScale: 0.22,   // was ~0.45
      maxScale: 0.55    // was ~1.05
    });

    this.starfield = new Starfield(this.baseWidth, this.baseHeight, {
      starCount: 160,
      speed: 18
    });

    // Damage numbers
    this.damageNumbers = [];
    this.damageTick = 0;
    this.damageTickInterval = 0.10;
    this.damageFloatIndex = 0;

    this.hitstop = 0;
    this.flash = 0;

    // Cached per-frame
    this.isPointerDown = false;
    this.holdTime = 0;

    this.showInstruction = true;
    this.instructionTime = 0;
    this.firstInteractionTracked = false;

    this.canMine = false;
    this.effectivePower = 0;

    // Hooks
    this.asteroid.onDestroyed = () => {
      this.breaks += 1;

      const gain = this.orePerBreak;
      this.resource += gain;

      this.damageNumbers.push({
        x: this.asteroid.x,
        y: this.asteroid.y - 140,
        vy: -50,
        life: 1.25,
        maxLife: 1.25,
        value: `+${gain}`,
        color: "#3ed2d1",
        forceColor: true,
        size: 56
      });

      // Swap meteor + sweet profile for normal asteroids
      if (this.breaks === 1) {
        // second asteroid: rockB (green crystals, for example)
        if (this.meteorSheets.rockB) {
          this.currentMeteorId = "rockB"
          this.asteroid.sprite = this.meteorSheets.rockB;
          this._applySweetProfile(this.normalSweetProfiles[1]);
        }
      }

      if (this.breaks === 2) {        
        this._enterBossPhase();
      }

      if (this.mode === "cta") {
        this.cta.setCost(this.bossOreCost, this.resource);
      }
    };

    this.asteroid.onBreakImpact = () => {
      this.shake.kick(1.8);

      const meteorId = this.currentMeteorId ?? "rockA";
      const pool = this.shardPoolsByMeteor[meteorId] ?? null;

      this.debris.spawnBreak(this.asteroid.x, this.asteroid.y, 2, pool);

      this.hitstop = 0.06;
      this.flash = 0.12;
    };


    // Start profile for first asteroid
    this._applySweetProfile(this.normalSweetProfiles[0]);
  }

  update(dt, globalTime) {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this._readInput();
    this._handleCTA();
    this._updateLaser(dt);
    this._computeFlags();
    this._updateShake(dt, globalTime);
    this._updateAsteroid(dt);
    this._updateBossGate(dt);
    this._spawnDamageNumbers(dt);
    this._updateDamageNumbers(dt);

    this.cta.update(dt);
    this.debris.update(dt);
    this.starfield.update(dt);
    this.instructionTime += dt;

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.5);
  }

  render(globalTime, baseWidth, baseHeight) {
    const off = this.shake.getOffset();

    this.starfield.render(this.ctx);

    if (this.mode === "mining") {
     const laserVisible = this.canMine && !this.asteroid.isBreaking; // only when asteroid exists

     this.laser.render(this.ctx, baseWidth, baseHeight, { visible: laserVisible });
     this.laser.renderHeatBar(this.ctx, baseWidth, baseHeight);

     this.asteroid.render(this.ctx, globalTime, false, off.x, off.y);
     this.debris.render(this.ctx);

     this._renderResourceCounter(baseWidth, baseHeight);
     this._renderInstruction(baseWidth, baseHeight);
    }


    this._renderDamageNumbers();

    // Flash on break impact (optional)
    if (this.flash > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.flash;
      this.ctx.fillStyle = "rgba(255,255,255,1)";
      this.ctx.fillRect(0, 0, baseWidth, baseHeight);
      this.ctx.restore();
    }

    this.cta.render(this.ctx, baseWidth, baseHeight);
  }

  _readInput() {
    this.isPointerDown = this.input.isPointerDown;
    this.holdTime = this.input.holdTime;
    this.pointerDown = this.input.consumePointerDown();
    this.pointerUp = this.input.consumePointerUp();
    this.pointerCancel = this.input.consumePointerCancel();

    if (this.pointerDown && this.mode === "mining") {
      if (!this.firstInteractionTracked) {
        this.firstInteractionTracked = true;
        this.showInstruction = false;
        this.emitPlayableEvent("first_interaction");
      }
      this.emitPlayableEvent("primary_action", { phase: this.phase });
    }
  }

  _handleCTA() {
    if (this.mode !== "cta") return;

    if (this.pointerDown) {
      if (this.cta.canActivate() && this.cta.containsButton(
        this.pointerDown.x,
        this.pointerDown.y,
        this.baseWidth,
        this.baseHeight
      )) {
        this.ctaArmedPointerId = this.pointerDown.pointerId;
      }
    }

    if (this.pointerCancel?.pointerId === this.ctaArmedPointerId) {
      this.ctaArmedPointerId = null;
    }

    if (this.pointerUp?.pointerId === this.ctaArmedPointerId) {
      this.ctaArmedPointerId = null;
      if (this.cta.containsButton(
        this.pointerUp.x,
        this.pointerUp.y,
        this.baseWidth,
        this.baseHeight
      )) {
        this.cta.activate();
      }
    }
  }

  _updateLaser(dt) {
    this.laser.update(dt, this.isPointerDown, this.holdTime);
  }

  _computeFlags() {
    const laserActive =
      this.phase !== "cta" &&
      this.isPointerDown &&
      !this.laser.isOverheated &&
      !this.asteroid.isBreaking &&
      this.laser.power > 0.05;

    this.canMine = this.phase !== "cta" && laserActive;
    this.effectivePower = this.laser.power * this.laser.sweetMultiplier;
  }

  _updateShake(dt, globalTime) {
    const laserActive =
      this.mode === "mining" &&
      this.isPointerDown &&
      !this.laser.isOverheated &&
      !this.asteroid.isBreaking &&
      this.laser.power > 0.05;

    let target = laserActive ? 0.25 : 0;
    if (laserActive) target += 0.35 * this.laser.sweetFactor;
    if (target > 1) target = 1;

    this.shake.setTarget(target);
    this.shake.update(dt, globalTime);
  }

  _updateAsteroid(dt) {
    if (this.mode !== "mining") return;

    this.asteroid.update(dt, this.effectivePower, this.canMine);
  }

  _enterBossPhase() {
    this.phase = "boss";
    this.asteroid.isBoss = true;
    this.bossMineTime = 0;

    // swap boss sprite if available
    if (this.meteorSheets.boss) {
      this.asteroid.sprite = this.meteorSheets.boss;
    }

    this.asteroid.maxHP = this.bossHP;
    this.asteroid.hp = this.bossHP;

    this.asteroid.damagePerSecond *= this.bossDpsScale;

    // Boss bigger
    this.asteroid.scale = 1.45;
    this.asteroid._beginSpawn();

    this.shake.kick(0.9);

    // Boss sweet profile (filetinho)
    this._applySweetProfile(this.bossSweetProfile);

    if (this.cta.setLabel) {
      this.cta.setLabel("UNLOCK MEGA LASER");
      this.cta.setSubLabel("Play Full Game");
    }
  }

  _updateBossGate(dt) {
    if (this.phase !== "boss") return;

    const laserActive =
      this.isPointerDown &&
      !this.laser.isOverheated &&
      !this.asteroid.isBreaking &&
      this.laser.power > 0.05;

    if (laserActive) this.bossMineTime += dt;

    const canShowCTA =
      this.resource >= this.bossOreCost &&
      this.bossMineTime >= 2.6; // a bit slower so boss feels tanky

    if (canShowCTA) {
      this.phase = "cta";
      this.mode = "cta";
      this.cta.setCost(this.bossOreCost, this.resource);
      this.cta.show();
      this.emitPlayableEvent("success");
      this.emitPlayableEvent("cta_impression");
    }
  }

  _renderInstruction(baseWidth, baseHeight) {
    if (!this.showInstruction || this.mode !== "mining") return;

    const pulse = 0.72 + Math.sin(this.instructionTime * 3.5) * 0.18;
    this.ctx.save();
    this.ctx.globalAlpha = pulse;
    this.ctx.fillStyle = "rgba(0,0,0,0.48)";
    this.ctx.fillRect(baseWidth / 2 - 170, baseHeight * 0.76 - 34, 340, 68);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "700 34px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("HOLD TO MINE", baseWidth / 2, baseHeight * 0.76);
    this.ctx.restore();
  }

  _spawnDamageNumbers(dt) {
    const laserActive =
      this.mode === "mining" &&
      this.isPointerDown &&
      !this.laser.isOverheated &&
      !this.asteroid.isBreaking &&
      this.laser.power > 0.05;

    if (!laserActive) return;

    this.damageTick += dt;
    if (this.damageTick < this.damageTickInterval) return;
    this.damageTick -= this.damageTickInterval;

    const sweet = this.laser.sweetFactor;
    const isSweet = sweet > 0.85;

    const minValue = 8;
    const maxValue = 42;
    const value = Math.round(minValue + (maxValue - minValue) * sweet);

    const o = this._nextDamageNumberOffset();

    this.damageNumbers.push({
      x: this.asteroid.x + o.x,
      y: this.asteroid.y - 205 + o.y,
      vy: isSweet ? -55 : -42,
      life: isSweet ? 0.85 : 0.70,
      maxLife: isSweet ? 0.85 : 0.70,
      value,
      isSweet,
      color: isSweet ? "#FFD24A" : "#ff5555",
      size: (isSweet ? 34 : 26) + Math.round(sweet * (isSweet ? 18 : 14))
    });
  }

  _updateDamageNumbers(dt) {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const n = this.damageNumbers[i];
      n.y += n.vy * dt;
      n.life -= dt;
      if (n.life <= 0) this.damageNumbers.splice(i, 1);
    }
  }

  _renderDamageNumbers() {
    const heat01 = this.laser.maxHeat > 0 ? (this.laser.heat / this.laser.maxHeat) : 0;

    const half = this.laser.sweetSpotWidth * 0.5;
    const start = Math.max(0, this.laser.sweetSpotCenter - half);
    const end = Math.min(1, this.laser.sweetSpotCenter + half);
    const inSweetZoneNow = heat01 >= start && heat01 <= end;

    for (const n of this.damageNumbers) {
      const maxLife = n.maxLife ?? 0.70;
      const a = Math.max(0, Math.min(1, n.life / maxLife));
      this.ctx.globalAlpha = a;

      const size = Math.round(n.size ?? 24);

      const isForced = !!n.forceColor;
      const isSweet = isForced ? (n.isSweet ?? true) : inSweetZoneNow;

      const fill = isForced ? n.color : (isSweet ? "#FFD24A" : "#ff5555");

      this.ctx.font = `${size}px sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      if (isSweet) {
        this.ctx.strokeStyle = "rgba(0,0,0,0.55)";
        this.ctx.lineWidth = 4;
        this.ctx.strokeText(String(n.value), n.x, n.y);
      }

      this.ctx.fillStyle = fill;
      this.ctx.fillText(String(n.value), n.x, n.y);

      this.ctx.globalAlpha = 1;
    }
  }

  _renderResourceCounter(baseWidth, baseHeight) {
    const pad = 18;
    const x = pad;
    const y = pad;

    // backing
    this.ctx.fillStyle = "rgba(0,0,0,0.35)";
    this.ctx.fillRect(x - 10, y - 10, 170, 54);

    // icon (optional)
    if (this.debris?.sheet) {
      this.debris.sheet.draw(this.ctx, 0, x + 16, y + 18, {
        scale: 0.16,
        rotation: 0,
        alpha: 0.95,
        smooth: true
      });
    }

    // number
    this.ctx.fillStyle = "#3ed2d1";
    this.ctx.font = "34px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(String(this.resource), x + 50, y + 18);
  }

  _nextDamageNumberOffset() {
    const i = (this.damageFloatIndex++ % 6);
    const ox = [-28, -14, 0, 14, 28, 0][i];
    const oy = [0, -6, -12, -6, 0, -16][i];
    return { x: ox, y: oy };
  }

  _applySweetProfile(p) {
    this.laser.sweetSpotCenter = p.center;
    this.laser.sweetSpotWidth = p.width;
    this.laser.sweetBonus = p.bonus;
  }
}
