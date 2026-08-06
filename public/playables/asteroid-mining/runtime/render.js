export const MAX_DPR = 2;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function createRenderer(canvas, baseWidth, baseHeight, options = {}) {
  const ctx = canvas.getContext("2d");
  const maxDpr = options.maxDpr ?? MAX_DPR;
  let resizeFrame = null;
  let metrics = null;

  function resize() {
    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    const cssScale = Math.min(
      viewportWidth / baseWidth,
      viewportHeight / baseHeight
    );

    const cssWidth = baseWidth * cssScale;
    const cssHeight = baseHeight * cssScale;
    const deviceDpr = window.devicePixelRatio || 1;
    const effectiveDpr = Math.min(deviceDpr, maxDpr);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.max(1, Math.round(cssWidth * effectiveDpr));
    canvas.height = Math.max(1, Math.round(cssHeight * effectiveDpr));

    metrics = {
      logicalWidth: baseWidth,
      logicalHeight: baseHeight,
      cssWidth,
      cssHeight,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      deviceDpr,
      effectiveDpr,
      maxDpr
    };
  }

  function scheduleResize() {
    if (resizeFrame !== null) return;

    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      resize();
    });
  }

  function screenToWorld(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };

    const normalizedX = (screenX - rect.left) / rect.width;
    const normalizedY = (screenY - rect.top) / rect.height;

    return {
      x: normalizedX * baseWidth,
      y: normalizedY * baseHeight
    };
  }

  window.addEventListener("resize", scheduleResize);
  window.addEventListener("orientationchange", scheduleResize);
  resize();

  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      canvas.width / baseWidth,
      0,
      0,
      canvas.height / baseHeight,
      0,
      0
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  function endFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function getMetrics() {
    return { ...metrics };
  }

  return {
    ctx,
    resize,
    beginFrame,
    endFrame,
    screenToWorld,
    getMetrics
  };
}
