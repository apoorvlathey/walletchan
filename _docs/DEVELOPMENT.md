# Development

This pnpm workspace contains the browser extension, website, docs site, and domain reputation service.

## Contributing changes

`master` requires a PR for every change, including documentation. No approval
or CI check is currently required by GitHub; repository validation requirements
still apply. There are no bypass actors.

Start a `codex/` branch from current `origin/master`, commit and push the topic
branch, and open a PR targeting `master`. Never push directly to `master` or
bypass its protection. Merge only when explicitly requested. After a merge,
return to `master` and fast-forward it while preserving uncommitted local work.
Leave files requested to stay local out of the PR.

## Agent instructions

`AGENTS.md` is the shared repository instruction file; do not maintain a
separate duplicate `CLAUDE.md`. Claude Code v2.1.277 and later supports it
natively through the built-in AGENTS.md plugin. Use a current Claude Code
version and keep that plugin enabled.

The default Project instructions mode loads `AGENTS.md` only when no
`CLAUDE.md` or `CLAUDE.local.md` exists in the working directory or its
ancestors. If your environment has such a file, choose
`claude-md-and-agents-md` in `/config` → Project instructions. Confirm loading
with `/context` in a fresh session. The option is user-scoped; setting it in
this repo's `.claude/settings.json` does not take effect. See the
[official Claude Code instructions guide](https://code.claude.com/docs/en/memory#read-agentsmd-files).

### Shared skills

Keep shared skill content under `.agents/skills/<name>/SKILL.md`. Claude's
`.claude/skills/<name>` entries are relative symlinks to the canonical folders,
so edits and supporting references have one owner. Edit the files in `.agents`,
not a second copy. The shipping workflow is now a skill rather than a legacy
`.claude/commands` file; Claude keeps the `/ship-extension` name.

## Contract address updates

The public [contracts repository](https://github.com/walletchan/contracts) owns
Solidity source and deployment records. This workspace keeps a reviewed local
address snapshot, so builds do not need access to another repository.

To update addresses from a reviewed contracts checkout:

```sh
pnpm sync:addresses /path/to/contracts/addresses.json
```

Review the generated diff before committing. This command never runs during
extension, website, or docs builds. Simulator source and tests are linked in
[ASSET_CHANGES_SIMULATION.md](./ASSET_CHANGES_SIMULATION.md).

## Pre-requisites

- Node.js (see `.nvmrc` for the version)
- pnpm

## Tech Stack

| App             | Framework               | UI Library | Build Tool |
| --------------- | ----------------------- | ---------- | ---------- |
| Extension       | React 18                | Chakra UI  | Vite       |
| Website         | Next.js 14 (App Router) | Chakra UI  | Next.js    |

## Validation scope

Build and check the application affected by the change. Website-only work under
`apps/website` does not require `pnpm build:extension` or the combined `pnpm build`.
Use `pnpm dev:website` and browser checks for small copy/style edits, targeted
website tests/typechecks for behavior changes, and `pnpm build:website` when a
feature is ready for final validation or release. Avoid a full build after every
small visual adjustment. Next dev and build share `.next`; stop the dev server
before a website production build and restore it afterward.

Run the full extension build when changing extension code, assets, manifest,
build configuration, or shared dependencies consumed by it. Cross-application
changes require checks for each affected consumer. Docs-only changes require
documentation/diff checks, not an application build.

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev:extension         # Build extension in DEVELOPMENT mode (vite build --mode development)
pnpm dev-sepolia:extension # Local APIs with Sepolia Privacy Pools
pnpm dev:website           # Start website dev server at localhost:3030
pnpm dev:domain-reputation # Start domain reputation service at localhost:42110

# Build
pnpm build              # Build both extension and website
pnpm build:extension    # Build extension in PRODUCTION mode (output: apps/extension/build/)
pnpm build-sepolia:extension # Production APIs with Sepolia Privacy Pools
pnpm build:website      # Build website only
pnpm build:domain-reputation # Build Railway domain reputation service
pnpm test:domain-reputation  # Test source validation, snapshots, and lookups

# Extension-specific
pnpm zip                # Build + zip (for GitHub Releases)
pnpm zip:cws            # Build + zip (strips `key` defensively, for CWS upload)
pnpm lint               # Lint extension code
pnpm typecheck:extension:ui # Strict semantic check for shared UI/theme primitives
pnpm typecheck:extension    # Full strict extension source gate
pnpm typecheck:extension:qa # Strict check for Playwright/axe QA scripts
pnpm --filter @walletchan/extension qa:preview # 235-state visual/a11y matrix
pnpm qa:extension           # Build + packaged Chrome runtime matrix

# Firefox build (separate output dir: apps/extension/build-firefox/)
pnpm build:extension:firefox   # Production Firefox build
pnpm dev:extension:firefox     # Dev Firefox build (uses local website)
pnpm zip:firefox               # Build + zip Firefox artifact for archival
pnpm sign:firefox              # Build + submit to AMO (requires WEB_EXT_API_KEY / WEB_EXT_API_SECRET)

# Contracts live in https://github.com/walletchan/contracts

# Foundry library installation (ALWAYS use git submodules)
cd /path/to/contracts && forge install <org>/<repo>   # Do NOT use --no-git

# Release: prepare a PR, then tag the merged commit (see PUBLISHING.md).
# Legacy pnpm release:* commands push directly to master; do not run them.
```

See [`PUBLISHING.md`](./PUBLISHING.md) for the full release workflow.

## Extension Build Modes: Development vs Production

The extension has independently selected API and Privacy Pools profiles. All
four commands produce the same output directory (`apps/extension/build/`), so
the most recent build is the one Chrome loads.

| Command | WalletChan APIs | Privacy Pools | Use when |
| --- | --- | --- | --- |
| `pnpm dev:extension` | localhost | Ethereum mainnet | Local API development against the live Privacy Pools deployment |
| `pnpm dev-sepolia:extension` | localhost | Sepolia | Local API development with testnet Privacy Pools |
| `pnpm build:extension` | production | Ethereum mainnet | Releases and production-equivalent testing |
| `pnpm build-sepolia:extension` | production | Sepolia | Production API testing with testnet Privacy Pools |

**What flips between modes**:

The entire `WALLETCHAN_API_BASE` constant in `apps/extension/src/constants/externalUrls.ts` flips when `import.meta.env.MODE === "development"`. Every derived endpoint (portfolio, swap, bridge, sponsored-transfer, premium-status, vault-data, clear-signing) follows it. Development → `http://localhost:3030/api`; production → `https://walletchan.eth.sh/api` so extension APIs remain reachable on ISPs that block `walletchan.com` DNS. The dev port lives in `WALLETCHAN_DEV_PORT` and matches `apps/website/package.json`'s `dev` script (`next dev -p 3030`) — change both together if you ever need to move it.

Privacy Pools defaults to mainnet in every Vite mode. The two dedicated Sepolia
commands set `VITE_PRIVACY_POOLS_PROFILE=sepolia` for compilation; this is not
a runtime or persisted profile switch.

**Rule of thumb:**

- Building to test a change end-to-end against the local website dev server → `pnpm dev:extension`.
- Building anything that will ship to users (zip, release, CWS) → `pnpm build:extension` (or `pnpm zip` / `pnpm zip:cws`, which call it internally).

Note: `import.meta.env.DEV` is **not** the right toggle — it's only true under the `vite` dev-server, not under `vite build`, so a `dev:extension` build would otherwise look like prod. Always gate on `MODE === "development"`.

## Testing Extension Changes

### TypeScript checks

`pnpm typecheck:extension:ui` is the green, strict semantic gate for the shared
mobile UI primitives, theme implementation, copy control, and full-screen
portal layer. Its boundary is explicit in `apps/extension/tsconfig.ui.json` and
keeps fast UI iteration available.

`pnpm typecheck:extension` runs strict TypeScript across all extension source,
including background, signing, storage, swap, and preview code. It is a required
green gate. Do not weaken strictness or add blanket suppressions to make it pass.

`pnpm typecheck:extension:qa` checks the Playwright/axe scripts under
`apps/extension/scripts/*-qa.ts`. Keep this green whenever preview or packaged
extension coverage changes.

### Packaged extension QA

`pnpm qa:extension` builds every manifest target, loads that exact production
package into fresh Chromium profiles, and runs the transaction, signature,
view-only/batch, daily-use, and authentication suites. The matrix covers Bankr,
private-key, and seed-phrase accounts. It uses a local dapp and rejects every
transaction/signature/batch request, so it never signs or broadcasts test work.

The packaged checks include pending-request persistence across UI close/reopen,
keyboard rejection, exactly-once EIP-1193 responses, view-only restrictions,
home actions under failed portfolio/RPC traffic, account/network switching,
manual lock, master/agent unlock, and agent-session secret restrictions. Real
WebAuthn ceremonies, assistive-technology smoke, and successful onchain sends
remain manual release checks.

1. `pnpm dev:extension` (for local testing against `pnpm dev:website`) or `pnpm build:extension` (production-mode build)
2. Go to `chrome://extensions`
3. Click refresh icon on WalletChan card
4. Test in a dapp (e.g., app.aave.com)

**Never use `pnpm build:web` to verify changes.** It only rebuilds the popup/sidepanel bundle (`main.js`) and leaves `inject.js` / `inpage.js` / `background.js` / `ens-banner.js` orphaned — Chrome then refuses to load the extension with `Could not load javascript 'static/js/inject.js' for script. Could not load manifest.` Always run `pnpm dev:extension` (dev mode) or `pnpm build:extension` (prod mode) so every script the manifest references is present in `apps/extension/build/`.

## Browser Targets (Chrome + Firefox)

The same Vite pipeline produces two artifacts:

- `pnpm build:extension` → `apps/extension/build/` (Chrome MV3 — `service_worker` background, `side_panel`)
- `pnpm build:extension:firefox` → `apps/extension/build-firefox/` (Firefox MV3 — `background.scripts` event page, no sidepanel)

`BROWSER=firefox` is the gating env. It flips Vite's `outDir` to `build-firefox/` and switches the background bundle from ES module to IIFE (Firefox event pages can't load ES modules). A post-build script (`scripts/swap-manifest.mjs`) overwrites the Chrome manifest in `build-firefox/` with the Firefox variant kept at `apps/extension/manifest.firefox.json` (deliberately stored OUTSIDE `public/` so it doesn't leak into the Chrome zip).

**Manifest drift control**: whenever you edit `apps/extension/public/manifest.json`, mirror the equivalent change in `apps/extension/manifest.firefox.json`. Chrome-only keys (`side_panel`, `permissions: ["sidePanel"]`, `background.service_worker`/`type:"module"`) MUST stay out of the Firefox manifest; Firefox-only keys (`background.scripts`, `browser_specific_settings.gecko.*`) stay out of the Chrome manifest.

See [`FIREFOX.md`](./FIREFOX.md) for the full Firefox port doc (port rationale, sidepanel/popup divergence, the `chrome.storage.session` compatibility layer, `chrome-extension://` → `moz-extension://` URL handling, AMO release flow, known gaps).

## Loading the extension in your browser

After building:

- **Chrome / Brave / Arc**: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select `apps/extension/build/`.
- **Firefox**: `pnpm --filter @walletchan/extension firefox:run` or load `apps/extension/build-firefox/` via `about:debugging` → "This Firefox" → "Load Temporary Add-on" (point at `manifest.json`).

## Running the website in development mode

```bash
pnpm dev:website
```

Starts the Next.js dev server at `http://localhost:3030`. The port is intentionally non-default — it must match `WALLETCHAN_DEV_PORT` in `apps/extension/src/constants/externalUrls.ts` so `pnpm dev:extension` can round-trip API calls against your local dev server.

## Environment Variables

When adding or using new environment variables in any app, always update (or create) the `.env.example` file in that app's directory. This ensures developers know what env vars are needed.

Domain reputation requires:

- Railway: `DOMAIN_REPUTATION_SERVICE_TOKEN` (at least 32 characters). Railway
  injects `PORT`; attach a persistent volume at `/data`, exposed through
  `RAILWAY_VOLUME_MOUNT_PATH`.
- Website/Vercel: `DOMAIN_REPUTATION_SERVICE_URL` and the identical
  `DOMAIN_REPUTATION_SERVICE_TOKEN`.
- Extension: the existing `VITE_DEFILLAMA_SEARCH_KEY`; no Railway secret is
  compiled into the extension.

## Releasing & Publishing

See [`PUBLISHING.md`](./PUBLISHING.md) for the full release workflow, Chrome Web Store upload process, and self-hosted auto-update system. Storage migration rules and the pre-release checklist live there too.

The legacy `pnpm release:*` commands push directly to `master` and must not be
used with PR-only protection. Prepare version changes in a release PR, then tag
the merged commit as described in `PUBLISHING.md`.

## Deploying long-running services (Railway)

See [`RAILWAY.md`](./RAILWAY.md). Use a Dockerfile + `railway.toml` — Nixpacks does not work with this pnpm workspace.
