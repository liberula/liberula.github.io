export function startLoop(update, render) {
  let lastTime = 0;
  const maxDt = 0.05;

  function loop(time) {
    if (lastTime === 0) lastTime = time;

    const dt = Math.min((time - lastTime) / 1000, maxDt);
    lastTime = time;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}