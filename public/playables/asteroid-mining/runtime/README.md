# Asteroid Mining, Playable Ad Prototype

## Status

This project is a portfolio prototype.

It has not been validated for a specific advertising network.

Asteroid Mining is a short portrait-oriented HTML5 playable ad prototype. The player holds the screen to mine asteroids, manages weapon heat, progresses through increasingly valuable targets and reaches a final call to action.

The project demonstrates compact gameplay, mobile-oriented interaction, Canvas rendering, public gameplay events and an isolated integration adapter for CTA and tracking.

## Running and packaging

```bash
npm install
npm run launch
```

Create and preview the isolated distribution:

```bash
npm run build
npm run verify
npm run preview
```

Create the ZIP and SHA-256 sidecar:

```bash
npm run package
```

Inside an extracted ZIP, use a static HTTP server; do not use `file://`:

```bash
python -m http.server 8080
```

## Controls

- Hold pointer or touch: mine
- Release: cool the weapon
- CTA: press and release inside the button

## Technologies

- HTML5
- JavaScript ES Modules
- Canvas 2D
- CSS
- Pointer Events
- WebP

## Public gameplay events

Every public event is dispatched on `window` as `liberula:playable-event`:

```javascript
window.addEventListener(
  "liberula:playable-event",
  event => {
    console.log(event.detail);
  }
);
```

The `detail` shape is:

```javascript
{
  name: "cta_click",
  payload: {},
  timestamp: 12345.67
}
```

The payload is always an object. These events support debug panels, portfolio pages, automated tests and external integration.

| Event | Trigger |
| --- | --- |
| `playable_loaded` | All required assets loaded and the runtime is ready. |
| `first_interaction` | First valid gameplay interaction; emitted once. |
| `primary_action` | A new mining action starts. |
| `success` | The main experience completes and enters the end state. |
| `cta_impression` | The CTA becomes visible. |
| `cta_click` | A valid CTA interaction completes. |
| `playable_error` | Required initialization or loading fails. |

## PlayableBridge

An integration may inject this interface before the playable initializes:

```javascript
window.PlayableBridge = {
  track(eventName, payload) {
    // Client or platform implementation
  },

  openStore() {
    // Client or platform implementation
  }
};
```

When no external adapter exists, `PortfolioBridge` is used. It intentionally does not navigate to a store and can be replaced per delivery target.

Each gameplay event is sent through a central emitter. The emitter:

1. dispatches a public `liberula:playable-event` `CustomEvent`;
2. forwards the same event to `PlayableBridge.track()`.

A valid CTA click emits `cta_click` and then calls `PlayableBridge.openStore()`.

## Limitations

- No advertising network integration has been validated.
- No MRAID compatibility is claimed.
- No campaign performance claims are made.
- No real store URL is configured in the portfolio build.
- The current layout targets portrait orientation.
