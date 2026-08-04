export const REVEAL_STAGES = Object.freeze({
  operation: 1,
  comparison: 2,
  passage: 3,
  interruption: 4,
  cliffhanger: 5,
  offer: 6,
});

export const LAST_REVEAL_STEP = REVEAL_STAGES.offer;

const REVEAL_DELAYS_MS = Object.freeze([420, 620, 760, 900, 980, 1100]);

export function getRevealDelay(step, reducedMotion = false) {
  if (reducedMotion) return 0;
  return REVEAL_DELAYS_MS[Math.min(step, REVEAL_DELAYS_MS.length - 1)];
}

export function isStageVisible(step, stage) {
  return step >= stage;
}
