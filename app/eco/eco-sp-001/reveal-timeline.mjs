export const UNLOCK_STATUSES = [
  "CONCLUSÃO RECEBIDA",
  "CRUZANDO REGISTROS",
  "LOCAL CONFIRMADO",
  "RECUPERANDO ARQUIVO DE ÁUDIO",
];

export const REVEAL_STAGES = {
  transition: 0,
  report: 4,
  containment: 5,
  evidence: 6,
  offer: 7,
};

export const LAST_REVEAL_STEP = REVEAL_STAGES.offer;

const STANDARD_DELAYS = [650, 700, 700, 800, 1100, 950, 900];
const REDUCED_MOTION_DELAYS = [30, 30, 30, 30, 40, 40, 40];

export function getRevealDelay(step, reducedMotion = false) {
  const delays = reducedMotion ? REDUCED_MOTION_DELAYS : STANDARD_DELAYS;
  return delays[Math.min(Math.max(step, 0), delays.length - 1)];
}

export function getUnlockStatus(step) {
  return UNLOCK_STATUSES[Math.min(Math.max(step, 0), UNLOCK_STATUSES.length - 1)];
}

export function isStageVisible(step, stage) {
  return step >= stage;
}
