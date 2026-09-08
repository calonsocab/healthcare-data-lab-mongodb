# Demo Sherpa Integration

Healthcare Data Lab can mount `demo-sherpa` as a host-owned integration for local development without making it a production dependency.

## What was added

- production builds resolve `demo-sherpa` to a local no-op stub unless `ENABLE_LOCAL_SHERPA=true`
- local Sherpa development installs `demo-sherpa` from a packed tarball instead of a live symlink
- Sherpa mounts once for the whole authenticated workspace:
  - `DemoSherpaCaptureBridge`
  - `DemoSherpaGuide`
- HDL keeps its existing `currentView` state, but exposes it to Sherpa through browser paths under `/workspace/...`
- `next.config.mjs` only transpiles `demo-sherpa` when local Sherpa mode is explicitly enabled; React itself must resolve through Next's normal runtime so Sherpa and the app share the same hook dispatcher
- a dedicated route adapter keeps both sides in sync:
  - HDL navigation changes update the browser path
  - Sherpa playback/navigation changes update `currentView`
- route talk tracks are now host-owned in `src/lib/demoSherpa/routeContext.js`

## Why the packed tarball matters

Using `file:../demo-sherpa` directly installs Sherpa as a symlink. In Next.js development, that can lead to a second React runtime or mismatched React resolution and errors like:

- `Cannot read properties of null (reading 'useMemo')`
- `(0, _react.use) is not a function`

Installing from `npm pack` gives HDL the same package shape another team would consume from a registry or GitHub release, which is the safest way to verify the integration boundary. It also avoids custom React rewrites that can conflict with Next's own compiled React runtime.

Keeping the package out of `package.json` means production installs and CI builds do not fail when the sibling `../demo-sherpa` repo is absent.

## Why `/workspace/...`

Sherpa replays and verifies navigation against real browser URLs, not just in-memory route state.

Using `/workspace/...` paths gives Sherpa a stable routing contract while keeping the Next.js app on a single shared shell. Refreshes and direct links work because HDL now has a catch-all page at:

- `src/app/workspace/[[...slug]]/page.js`

Examples:

- `/` -> `home`
- `/workspace/strategies` -> `strategies`
- `/workspace/learn/strategy-studio` -> `learn:strategy-studio`

## Main files

- `src/components/integrations/demoSherpa/HealthcareDataLabSherpa.jsx`
- `src/components/integrations/demoSherpa/SherpaHostRouter.jsx`
- `src/lib/demoSherpa/hostRoutes.js`
- `src/lib/demoSherpa/routeContext.js`
- `src/app/workspace/[[...slug]]/page.js`

## Local setup

1. Refresh the local packed package after changing `demo-sherpa`:

   ```bash
   npm run sherpa:refresh-local
   ```

2. Enable local Sherpa mode:

   ```dotenv
   ENABLE_LOCAL_SHERPA=true
   NEXT_PUBLIC_SHERPA_ENABLED=true
   ```

3. Start HDL with a clean Next cache:

   ```bash
   npm run dev:clean
   ```

If you are working directly inside `demo-sherpa`, make sure `npm install` has been run there first so `npm pack` can rebuild the package through its `prepare` script.

## Environment variables

Minimal local mode needs both the local package alias and the UI flag enabled:

```dotenv
ENABLE_LOCAL_SHERPA=true
NEXT_PUBLIC_SHERPA_ENABLED=true
```

Optional shared-catalog mode:

```dotenv
NEXT_PUBLIC_SHERPA_CATALOG_API_URL=http://localhost:9091
```

Optional host-owned AI endpoints:

```dotenv
NEXT_PUBLIC_SHERPA_TTS_ENDPOINT=/api/journey/tts
NEXT_PUBLIC_SHERPA_TRANSCRIBE_ENDPOINT=/api/journey/transcribe
NEXT_PUBLIC_SHERPA_TRANSLATE_ENDPOINT=/api/journey/translate
```

If the AI endpoints are blank and no shared Sherpa API is configured, Sherpa still works in browser-local mode for guide playback, capture, and local journey storage.
