export const UNLOCK_STATUSES = [
  "CONCLUSÃO RECEBIDA",
  "CRUZANDO REGISTROS",
  "LOCAL CONFIRMADO",
  "ABRINDO ATUALIZAÇÃO OPERACIONAL",
];

export const REVEAL_STAGES = {
  transition: 0,
  operation: 4,
  interior: 5,
  comparison: 6,
  transmission: 7,
  impossibleSpace: 8,
  closure: 9,
  evidence: 10,
  reclassification: 11,
  restricted: 12,
  offer: 13,
};

export const LAST_REVEAL_STEP = REVEAL_STAGES.offer;

const STANDARD_DELAYS = [500, 550, 600, 650, 850, 900, 950, 900, 950, 900, 1000, 950, 800];
const REDUCED_MOTION_DELAYS = [20, 20, 20, 20, 30, 30, 30, 30, 30, 30, 30, 30, 30];

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
