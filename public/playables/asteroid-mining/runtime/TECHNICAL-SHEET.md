# Asteroid Mining, Technical Sheet

## Build identification

- Build name: Liberula Asteroid Mining Playable Prototype
- Build date: 2026-08-06
- Git commit: `ed02980e8f526574dffe1fc1a57958fe315e9cfc` (working tree contains ticket changes)
- ZIP filename: `liberula-asteroid-mining-playable-prototype.zip`
- ZIP SHA-256: See the generated `.sha256` sidecar and `audit/final/sha256.txt`
- Public URL: https://liberula.com/playables/asteroid-mining/

## Runtime

- Runtime type: HTML5
- Orientation: Portrait
- Logical resolution: 720 × 1280
- Rendering: Canvas 2D
- Input: Pointer Events
- Audio: None
- External runtime dependencies: None
- Remote assets: None
- Public event name: `liberula:playable-event`
- Default platform adapter: `PortfolioBridge`

## Package size

- Uncompressed runtime size: 1,301,409 bytes | 1,270.91 KiB | 1.24 MiB
- ZIP size: 1,259,657 bytes | 1,230.13 KiB | 1.20 MiB
- Image size: 1,238,158 bytes | 1,209.14 KiB | 1.18 MiB
- JavaScript size: 54,327 bytes | 53.05 KiB
- HTML and CSS size: 1,909 bytes | 1.86 KiB
- Documentation size: 7,015 bytes | 6.85 KiB
- Other files: 0 bytes
- Total file count: 23

## Requests

- HTML requests: 1
- JavaScript requests: 16
- Image requests: 4
- Other requests: 0
- Total requests: 21
- External requests: 0 in package references

Requests were observed by direct HTTPS checks against the published runtime. Browser performance instrumentation was unavailable.

## Loading

- Environment: Local static server measurement; not representative of production delivery
- Browser: Not available in the test environment
- Cache state: No cache
- Network condition: Local
- Viewport: Not available
- Real DPR: Not available
- Effective DPR: Limited to 2
- Time to `playable_loaded`: Not available
- Time to first possible interaction: Not available

## Performance

- Average FPS: Not available
- Approximate average frame time: Not available
- Frame time p95: Not available
- Test duration: Not available
- Gameplay segment tested: Event emitter, bridge forwarding and CTA one-shot behavior; full browser gameplay unavailable

## Experience

- Approximate time to CTA: Not available
- Primary interaction: Hold pointer or touch to mine; release to cool
- Failure or interruption state: Loading failure message with retry
- End state: CTA overlay after the boss gate
- CTA behavior: Deliberate press and release inside; one activation; portfolio adapter does not navigate
- Replay: None
- Audio: None

## Events

| Event | Public CustomEvent | Bridge tracking | Trigger |
| --- | --- | --- | --- |
| playable_loaded | Yes | Yes | Runtime ready |
| first_interaction | Yes | Yes | First valid input |
| primary_action | Yes | Yes | Mining action starts |
| success | Yes | Yes | Main flow completed |
| cta_impression | Yes | Yes | CTA becomes visible |
| cta_click | Yes | Yes | Valid CTA click |
| playable_error | Yes | Yes, when bridge is available | Initialization failure |

## Tested environments

No browser environments recorded. The integrated browser was unavailable in the test environment, so the required viewport matrix was not claimed as tested.

## Validated

- Central public event shape and stable name
- Event forwarding to an injected bridge
- Required event order in an integration harness
- CTA one-shot activation state
- Portfolio `openStore()` no-navigation behavior by implementation inspection
- Local WebP assets and MIME types
- Static development server execution
- Isolated distribution server execution
- Distribution verification
- Distribution ZIP structure and checksum generation
- Public HTTPS page, runtime and all 21 runtime resources
- Production MIME types for HTML, JavaScript and WebP

## Not validated

- MRAID
- Specific advertising networks
- Network-specific SDKs
- Campaign performance
- CPI
- CTR
- IPM
- ROAS
- Retention
- Store approval
- Production CDN performance
- Offline execution
- All physical mobile devices
- Landscape layout
- Localization
- Accessibility compliance
- Audio behavior
