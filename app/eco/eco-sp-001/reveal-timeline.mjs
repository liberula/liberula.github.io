export const REPORT_RELEASE_DELAY_MS = 420;

export function getReportReleaseDelay(reducedMotion = false) {
  return reducedMotion ? 0 : REPORT_RELEASE_DELAY_MS;
}
