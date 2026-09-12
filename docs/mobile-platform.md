# Mobile Platform Strategy (Android + iOS)

> Status: **decision made, not yet implemented** — this captures a brainstorming session's
> conclusions so the reasoning isn't lost before implementation starts. See
> [deployment.md](./deployment.md) for the existing web deployment and
> [telemetry.md](./telemetry.md) / [analytics.md](./analytics.md) for the disclosure obligations
> mentioned below.

## Goal

Ship the same game to Android and iOS app stores, with reasonable access to native device
features (haptics, sound, eventually maybe push notifications/share/deep links), **without**
maintaining a separate UI codebase per platform.

## Decision: Capacitor (wrap the existing web app), not a native rewrite

| | Reuses `apps/web`'s existing React/CSS UI | Native feature access |
| --- | --- | --- |
| **Capacitor** (chosen) | 100% — same build ships to web + Android + iOS | Full, via first-party/community plugins, or a custom native plugin for anything missing |
| React Native / Expo | 0% — every screen's JSX/CSS rewritten in RN primitives | Full |
| Flutter | 0% — total rewrite in Dart | Full |

Reasoning:

- Mastermind is a turn-based board/UI game (peg board, timers, dialogs) — not graphics/AR-heavy,
  so there's no functional need for a fully native-rendered UI.
- The web app already has a large amount of hand-tuned CSS (grid alignment tricks, iPhone-15
  calibrated peg sizing, negative-margin drawer bleed, etc.) that would need to be redone from
  scratch in React Native's or Flutter's styling model, for no functional gain.
- Capacitor's plugin model exposes native APIs (haptics, notifications, share, storage,
  biometrics, etc.) as plain JS/TS calls from the *same* React components already in `apps/web` —
  "native feature access" does not require a native-rendered UI.
- React Native/Flutter would mean permanently maintaining **two** UI implementations (the
  existing web one + a native one), doubling the cost of every future screen change, in exchange
  for native rendering this app doesn't currently need.
- Capacitor is a legitimate, widely-shipped production path for content/data-driven apps (not a
  toy/prototype-only technology).

**This is not a permanent architectural dead end** — see "Future native/graphics escape hatch"
below for how a fully-native screen (e.g. AR) could be added later without rewriting the rest of
the app.

## Native features actually wanted

- **Haptics** — `@capacitor/haptics` (`Haptics.impact({ style: ImpactStyle.Light })` etc.),
  wraps `UIImpactFeedbackGenerator` (iOS) / `Vibrator` (Android). Candidate trigger points: peg
  lock/unlock, Submit, round win/loss.
- **Sound** — no native plugin needed; the standard Web Audio API / `<audio>` element works
  inside a Capacitor WebView exactly as it does in a desktop browser tab. Only revisit this if
  deeper OS audio-session control (ducking, background audio) is ever wanted.

Considered but not committed to yet (future candidates only): push notifications ("it's your
turn"), native share sheet (invite via room code/link), deep links (open a shared link straight
into a room), background/foreground lifecycle handling (clean socket reconnect on app resume),
biometric app-lock.

## Graphics: what a WebView can and can't do

Capacitor's WebView (WKWebView on iOS, Chromium WebView on Android) supports the same rendering
stack as a desktop browser: CSS animations/3D transforms, SVG, Canvas 2D, and WebGL. A
"realistic-looking" (but not photorealistic/AR) board — textured pegs, soft shadows,
lighting-style gradients, particle bursts on a correct guess — fits comfortably here, via either
plain CSS (cheapest, builds on the CSS work already in this app) or a canvas/WebGL library like
PixiJS (2D) or Three.js (3D).

**Genuinely requires native code, not just JS:**

- **AR** (placing the board on a real table via ARKit/ARCore) — mobile WebView WebXR support is
  too inconsistent to rely on.
- **Engine-grade 3D** (physically-based rendering, ray-traced-style reflections, large-scale
  particle simulation) — WebGL has real overhead vs. native Metal/Vulkan, most noticeable on
  low-end Android hardware (iOS's WKWebView is tightly optimized and less of a concern).
- Guaranteed 60fps+ for graphically extreme scenes on budget Android devices.

None of these are anywhere near what a Mastermind board needs today.

### Future native/graphics escape hatch

Choosing Capacitor now does not block adding a fully-native-rendered screen later. A native
Capacitor plugin can present a native view (e.g. an ARKit/SceneKit scene on iOS, a native GL
surface on Android) for **one specific screen**, while the rest of the app (Home, Lobby,
Settings, MainGame's chrome, etc.) stays exactly as it is today — this is a well-established
hybrid-app pattern, not a rewrite. The added cost later is designing the data bridge between that
native view and the existing React state (Capacitor's plugin message-passing API), which is a
bounded, well-known engineering cost, not an architectural wall.

## Infrastructure needed once implementation starts

- **Add to `apps/web`**: `@capacitor/core`, `@capacitor/cli` (dev dependency), `@capacitor/android`
  now, `@capacitor/ios` once on a Mac. `capacitor.config.ts` with `webDir: 'dist'`.
- **Networking**: `apps/web/src/state/socketClient.ts` already supports a build-time
  `VITE_SERVER_URL` override (falls back to `window.location.origin` in prod, which is meaningless
  inside a packaged native app). Mobile builds must set `VITE_SERVER_URL` explicitly to the
  deployed Azure backend URL (see [deployment.md](./deployment.md)).
- **Local tooling confirmed already present on this dev machine**: Android SDK
  (`%ANDROID_HOME%` → `build-tools`/`platforms`/`platform-tools`/`emulator`/`system-images`) and a
  JDK 17 (Microsoft build of OpenJDK) — Android builds can be scaffolded and compiled locally.
  iOS builds require Xcode, which only runs on macOS — not available on this Windows machine, so
  iOS work needs either physical Mac access or a cloud macOS CI (GitHub Actions `macos-latest`
  runner, Codemagic, Bitrise, etc.).
- **Developer accounts** (must be created/paid for by the account owner, not automatable): Apple
  Developer Program ($99/yr, required for TestFlight + App Store), Google Play Console ($25
  one-time).
- **Testing plan**: Android — emulator or a USB-connected device via `npx cap run android` /
  Android Studio, then Google Play Console's internal/closed testing track before public release.
  iOS — Xcode simulator/device, then TestFlight beta before submitting for App Store review.
- **Store submission disclosures**: both stores require a privacy policy URL and a data-collection
  disclosure (Google Play's "Data Safety" form, Apple's "App Privacy" nutrition label) that must
  accurately reflect the existing Application Insights telemetry ([telemetry.md](./telemetry.md))
  and any future permanent-analytics ledger ([analytics.md](./analytics.md)).
- **CI/CD**: the existing GitHub Actions build job ([deployment.md](./deployment.md)) could gain
  an Android build job on the same `ubuntu-latest` runner used today. An iOS build/signing job
  would need a `macos-latest` runner (pricier per-minute on GitHub Actions) or a third-party cloud
  Mac CI service.

## Open questions (deliberately deferred)

- Whether "realistic board graphics" ends up being plain CSS, PixiJS, or Three.js — deferred
  until an actual visual direction is picked; doesn't affect the Capacitor-vs-rewrite decision.
- Whether AR is ever actually wanted — would justify a native plugin for that one screen only,
  not a change to this overall strategy.
