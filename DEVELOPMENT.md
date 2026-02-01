# Development

This is a pnpm workspaces monorepo containing the browser extension (`apps/extension`) and the landing page website (`apps/website`).

## Pre-requisites

- Node.js (see .nvmrc for the version)
- pnpm

## Project Structure

```
bankr-wallet/
├── apps/
│   ├── extension/    # Browser extension (Vite + React + Chakra UI)
│   └── website/      # Landing page (Next.js + Chakra UI)
├── packages/
│   └── shared/       # Shared design tokens and assets
└── package.json      # Root workspace
```

## Building from source

1. Install dependencies: `pnpm install`
2. Build the extension: `pnpm build:extension`
3. The built extension will be in `apps/extension/build/`

## Running the extension in development mode

1. Install dependencies: `pnpm install`
2. Build the extension: `pnpm build:extension`
3. Load the extension in your browser:
   - Chrome/Brave/Arc: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select `apps/extension/build/`
   - Or use the scripts:
     - Chrome: `pnpm --filter @bankr-wallet/extension chrome:run`
     - Firefox: `pnpm --filter @bankr-wallet/extension firefox:run`

## Running the website in development mode

```bash
pnpm dev:website
```

This starts the Next.js dev server at `http://localhost:3000`.

## Workspace Commands

From the root directory:

| Command                | Description                           |
| ---------------------- | ------------------------------------- |
| `pnpm install`         | Install all dependencies              |
| `pnpm build:extension` | Build the browser extension           |
| `pnpm build:website`   | Build the website                     |
| `pnpm build`           | Build both extension and website      |
| `pnpm dev:extension`   | Run extension in dev mode             |
| `pnpm dev:website`     | Run website in dev mode               |
| `pnpm zip`             | Create extension zip for distribution |
| `pnpm lint`            | Lint the extension code               |

## Creating a Release

Releases are automated via GitHub Actions. When you push a version tag, the workflow will:

1. Build the extension
2. Create a zip file
3. Publish a GitHub release with the zip attached

### Steps to release a new version:

Run one of these commands based on the type of release:

```bash
pnpm release:patch  # 0.1.0 → 0.1.1 (bug fixes)
pnpm release:minor  # 0.1.0 → 0.2.0 (new features)
pnpm release:major  # 0.1.0 → 1.0.0 (breaking changes)
```

This automatically:

1. Bumps the version in `apps/extension/package.json`
2. Syncs the version to `apps/extension/public/manifest.json`
3. Creates a commit and git tag
4. Pushes to origin with tags
5. GitHub Actions creates the release at [Releases](https://github.com/apoorvlathey/bankr-wallet/releases)

### Manual release (optional)

If you need to create a release manually:

```bash
pnpm build:extension
pnpm zip
```

Then upload `apps/extension/zip/bankr-wallet-vX.Y.Z.zip` to a new GitHub release.
