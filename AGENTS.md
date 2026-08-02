# Workstation Fit

## Scope

- Static bilingual ergonomic workstation calculator hosted on Cloudflare.
- All personal measurements and calculations stay in the browser.
- V1 uses Astro, TypeScript, and Three.js without a UI framework.

## Product rules

- Chinese is the default language at `/`; English lives at `/en/` when implemented.
- Present height-only results as a suggested starting point paired with a reference range, never medical advice or a single ideal value.
- Keep calculation data and interpolation independent from DOM and Three.js code.
- The 3D robot and furniture must remain original and must not reproduce protected character designs.

## Engineering

- Prefer small modules and browser-native APIs.
- Preserve keyboard access, reduced-motion behavior, and a non-WebGL fallback.
- Do not add a backend, account system, cookies, or remote measurement persistence. The height, onboarding state, and Local fit profile may persist in browser storage and must never leave the device.
- Do not commit, push, deploy, or create a remote repository without explicit approval.

## Agent skills

### Issue tracker

Issues and PRDs live in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels documented in `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using the root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
