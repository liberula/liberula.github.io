export const PUBLIC_EVENT_NAME = "liberula:playable-event";

export function createPlayableEventEmitter(bridge) {
  return function emitPlayableEvent(name, payload = {}) {
    const normalizedPayload = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : {};

    window.dispatchEvent(new CustomEvent(PUBLIC_EVENT_NAME, {
      detail: {
        name: String(name),
        payload: normalizedPayload,
        timestamp: performance.now()
      }
    }));

    bridge.track(String(name), normalizedPayload);
  };
}
