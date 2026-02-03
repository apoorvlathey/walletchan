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

## Auto-Update System

The extension uses Chrome's self-hosted auto-update mechanism. Users with the extension installed will automatically receive new versions without manual re-installation.

### How It Works

1. `manifest.json` includes an `update_url` pointing to `https://bankrwallet.app/api/extension/update.xml`
2. Chrome checks this URL every few hours
3. If a newer version exists, Chrome downloads and installs the signed CRX automatically

### Version Flow

```
pnpm release:patch
  → bumps version in package.json + manifest.json
  → creates git tag v0.1.2
  → pushes to GitHub

GitHub Actions
  → builds extension
  → creates ZIP + signed CRX
  → attaches both to GitHub Release

Chrome (periodic check)
  → fetches https://bankrwallet.app/api/extension/update.xml
  → sees version 0.1.2 > installed 0.1.1
  → downloads CRX from GitHub Release
  → installs update automatically
```

### One-Time Setup (Required Before First Release)

#### 1. Generate signing key

```bash
openssl genrsa -out bankr-wallet.pem 2048
```

#### 2. Get extension ID

Calculate the extension ID from your signing key:

```bash
node -e "
const crypto = require('crypto');
const fs = require('fs');
const pem = fs.readFileSync('bankr-wallet.pem', 'utf8');
const key = crypto.createPrivateKey(pem);
const pubKey = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
const hash = crypto.createHash('sha256').update(pubKey).digest();
const id = Array.from(hash.slice(0, 16))
  .map(b => String.fromCharCode((b >> 4) + 97) + String.fromCharCode((b & 0xf) + 97))
  .join('');
console.log(id);
"
```

This outputs the 32-character extension ID derived from your signing key.

#### 3. Add GitHub Secrets

In the repository settings, add:

- `EXTENSION_SIGNING_KEY`: Base64 encoded .pem file
  ```bash
  base64 -i bankr-wallet.pem | pbcopy  # macOS
  base64 -w 0 bankr-wallet.pem         # Linux
  ```

#### 4. Add website environment variable

Add to your website deployment (Vercel, etc.):

```
EXTENSION_ID=<32-char-id-from-step-2>
```

#### 5. Secure backup

Store the `bankr-wallet.pem` file in a password manager. This key is the extension's identity—losing it means users won't receive updates.

### Verification

**Test the XML endpoint:**

```bash
curl https://bankrwallet.app/api/extension/update.xml
```

**Force update check in Chrome:**

1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click "Update" button

### Security Notes

- **Never commit the .pem file** to the repository
- Both `update_url` and CRX download URL must be HTTPS
- The API route caches GitHub responses for 5 minutes to avoid rate limits
