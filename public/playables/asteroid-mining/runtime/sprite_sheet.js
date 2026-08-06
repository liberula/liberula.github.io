export class SpriteSheet {
  /**
   * @param {HTMLImageElement} image
   * @param {object} layout
   * @param {number} layout.frameWidth
   * @param {number} layout.frameHeight
   * @param {number} layout.columns
   * @param {number} [layout.rows]        Optional. If omitted, computed from image height.
   * @param {number} [layout.spacingX=0]  Pixels between frames (horizontal).
   * @param {number} [layout.spacingY=0]  Pixels between frames (vertical).
   * @param {number} [layout.marginX=0]   Left margin before first frame.
   * @param {number} [layout.marginY=0]   Top margin before first frame.
   * @param {number} [layout.frameCount]  Optional cap. Useful if last row is partial.
   * @param {object} [opts]
   * @param {number} [opts.originX=0.5]   0..1, draw pivot
   * @param {number} [opts.originY=0.5]   0..1, draw pivot
   */
  constructor(image, layout, opts = {}) {
    this.image = image;

    this.frameWidth = layout.frameWidth;
    this.frameHeight = layout.frameHeight;
    this.columns = layout.columns;

    this.spacingX = layout.spacingX ?? 0;
    this.spacingY = layout.spacingY ?? 0;
    this.marginX = layout.marginX ?? 0;
    this.marginY = layout.marginY ?? 0;

    this.rows =
      layout.rows ??
      Math.floor(
        (image.height - this.marginY) / (this.frameHeight + this.spacingY)
      );

    const maxFrames = this.columns * this.rows;
    this.frameCount = Math.min(layout.frameCount ?? maxFrames, maxFrames);

    this.originX = opts.originX ?? 0.5;
    this.originY = opts.originY ?? 0.5;
  }

  static fromStrip(image, frameCount, opts = {}) {
    const frameWidth = Math.floor(image.width / frameCount);
    const frameHeight = image.height;
    return new SpriteSheet(
      image,
      {
        frameWidth,
        frameHeight,
        columns: frameCount,
        rows: 1,
        frameCount
      },
      opts
    );
  }

  clampFrame(i) {
    if (!Number.isFinite(i)) return 0;
    return Math.max(0, Math.min(this.frameCount - 1, i | 0));
  }

  getSourceRect(frameIndex) {
    const i = this.clampFrame(frameIndex);
    const col = i % this.columns;
    const row = Math.floor(i / this.columns);

    const sx = this.marginX + col * (this.frameWidth + this.spacingX);
    const sy = this.marginY + row * (this.frameHeight + this.spacingY);

    return { sx, sy, sw: this.frameWidth, sh: this.frameHeight };
  }

  // Method: SpriteSheet.frameFromRatio(ratio01)
  frameFromRatio(ratio01) {
    const r = Math.max(0, Math.min(1, ratio01));
    const count = this.frameCount ?? this.frames ?? this.columns ?? 1;
    const last = Math.max(0, count - 1);
    return Math.min(last, Math.floor(r * count));
  }

  /**
   * Draws frame with pivot (originX, originY) at (x, y)
   */
  draw(ctx, frameIndex, x, y, opts = {}) {
    const scale = opts.scale ?? 1;
    const rotation = opts.rotation ?? 0;
    const alpha = opts.alpha ?? 1;
    const flipX = opts.flipX ?? false;
    const flipY = opts.flipY ?? false;
    const smooth = opts.smooth ?? true;

    const { sx, sy, sw, sh } = this.getSourceRect(frameIndex);

    const dw = sw * scale;
    const dh = sh * scale;

    const ox = dw * this.originX;
    const oy = dh * this.originY;

    const prevAlpha = ctx.globalAlpha;
    const prevSmoothing = ctx.imageSmoothingEnabled;

    ctx.globalAlpha = prevAlpha * alpha;
    ctx.imageSmoothingEnabled = !!smooth;

    ctx.save();
    ctx.translate(x, y);
    if (rotation !== 0) ctx.rotate(rotation);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);

    ctx.drawImage(this.image, sx, sy, sw, sh, -ox, -oy, dw, dh);

    ctx.restore();

    ctx.globalAlpha = prevAlpha;
    ctx.imageSmoothingEnabled = prevSmoothing;
  }

}
