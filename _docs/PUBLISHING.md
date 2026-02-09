# Publishing & Distribution

BankrWallet is distributed through two independent channels with separate extension IDs.

## Distribution Channels

| | Self-hosted (GitHub) | Chrome Web Store |
|---|---|---|
| **Extension ID** | `gmfimlibjdfoeoiohiaipblfklgammci` | `kofbkhbkfhiollbhjkbebajngppmpbgc` |
| **ID derived from** | `bankr-wallet.pem` signing key | Google's key (CWS-assigned, immutable) |
| **Update mechanism** | `update_url` in manifest.json → website API → CRX from GitHub Release | CWS built-in auto-update |
| **Audience** | Beta testers, sideloaders | General public |
| **Speed** | Instant (GitHub Release publishes immediately) | CWS review (hours to days) |
| **Listing** | [GitHub Releases](https://github.com/apoorvlathey/bankr-wallet/releases) | [Chrome Web Store](https://chromewebstore.google.com/detail/bankrwallet/kofbkhbkfhiollbhjkbebajngppmpbgc) |

### Why Two IDs?

Chrome extension IDs are derived from cryptographic keys. CWS assigns its own key (Google holds the private key), while self-hosted CRX files are signed with `bankr-wallet.pem`. These are fundamentally different keys, so the IDs differ. This is expected and cannot be changed.

CWS **rejects** uploads containing `key` or `update_url` fields. Use `pnpm zip:cws` to create a CWS-ready zip — it strips these fields from the build output before zipping (via `scripts/strip-cws-keys.sh`). The plain `pnpm zip` keeps all fields intact (used by GitHub Releases for self-hosted distribution).

## Release Process

### 1. Bump version and push tag

```bash
pnpm release:patch  # 0.2.0 → 0.2.1 (bug fixes)
pnpm release:minor  # 0.2.0 → 0.3.0 (new features)
pnpm release:major  # 0.2.0 → 1.0.0 (breaking changes)
```

This automatically:

1. Bumps the version in `apps/extension/package.json`
2. Syncs the version to `apps/extension/public/manifest.json` (via `scripts/sync-version.sh`)
3. Creates a commit and git tag (e.g. `v0.2.1`)
4. Pushes to origin with tags

### 2. GitHub Actions builds the release

The [release workflow](/.github/workflows/release.yml) triggers on `v*` tags and:

1. Builds the extension
2. Signs with `bankr-wallet.pem` → creates `bankr-wallet-vX.Y.Z.crx` (for self-hosted)
3. Creates `bankr-wallet-vX.Y.Z.zip` (with `key` + `update_url` intact)
4. Publishes both to [GitHub Releases](https://github.com/apoorvlathey/bankr-wallet/releases)

At this point, **self-hosted users** start receiving the update automatically (Chrome checks `update_url` every few hours).

### 3. Upload to Chrome Web Store

1. Build locally and create the CWS zip:
   ```bash
   pnpm build:extension
   pnpm zip:cws
   ```
2. Go to the [CWS Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Select the BankrWallet extension
4. Upload `apps/extension/cws-zip/bankr-wallet-vX.Y.Z.zip` (not the GitHub Release zip or CRX)
5. Fill in any release notes
6. Submit for review

Once approved, **CWS users** receive the update.

### Manual release (optional)

If you need to create a release without the automated workflow:

```bash
pnpm build:extension
pnpm zip        # keeps key + update_url (for GitHub Release)
pnpm zip:cws    # strips key + update_url (for CWS upload)
```

Then upload `apps/extension/zip/bankr-wallet-vX.Y.Z.zip` to a new GitHub release.

## Self-hosted Auto-Update System

### How It Works

1. `manifest.json` includes `update_url` pointing to `https://bankrwallet.app/api/extension/update.xml`
2. Chrome checks this URL every few hours for self-hosted installs
3. The website API fetches the latest GitHub Release and returns update XML with the CRX download URL
4. If a newer version exists, Chrome downloads and installs the signed CRX automatically

CWS installs ignore `update_url` entirely — CWS has its own update mechanism.

### Version Flow

```
pnpm release:patch
  → bumps version in package.json + manifest.json
  → creates git tag v0.2.1
  → pushes to GitHub

GitHub Actions (.github/workflows/release.yml)
  → builds extension
  → creates ZIP + signed CRX (using EXTENSION_SIGNING_KEY secret)
  → attaches both to GitHub Release

Chrome (periodic check, self-hosted installs only)
  → fetches https://bankrwallet.app/api/extension/update.xml
  → sees version 0.2.1 > installed 0.2.0
  → downloads CRX from GitHub Release
  → installs update automatically
```

### Verification

**Test the XML endpoint:**

```bash
curl https://bankrwallet.app/api/extension/update.xml
```

Should return XML with `appid='gmfimlibjdfoeoiohiaipblfklgammci'` and the latest version.

**Force update check in Chrome:**

1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click "Update" button

## One-Time Setup (Already Done)

Reference for if signing key or infrastructure needs to be recreated.

### 1. Generate signing key

```bash
openssl genrsa -out bankr-wallet.pem 2048
```

### 2. Get extension ID

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

### 3. Get public key for manifest.json

Extract the public key to set as the `key` field in `manifest.json`:

```bash
node -e "
const crypto = require('crypto');
const fs = require('fs');
const pem = fs.readFileSync('bankr-wallet.pem', 'utf8');
const key = crypto.createPrivateKey(pem);
const pubKey = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
console.log(pubKey.toString('base64'));
"
```

### 4. Add GitHub Secrets

In the repository settings, add:

- `EXTENSION_SIGNING_KEY`: Base64 encoded .pem file
  ```bash
  base64 -i bankr-wallet.pem | pbcopy  # macOS
  base64 -w 0 bankr-wallet.pem         # Linux
  ```

### 5. Add website environment variable

Add to your website deployment (Vercel, etc.):

```
EXTENSION_ID=gmfimlibjdfoeoiohiaipblfklgammci
```

This is the **self-hosted** extension ID (from step 2), since only CRX-installed users hit the update endpoint.

### 6. Secure backup

Store the `bankr-wallet.pem` file in a password manager. This key is the extension's identity for self-hosted distribution — losing it means self-hosted users won't receive updates.

## Backward Compatibility & Storage Migrations

Chrome extensions auto-update silently. Users cannot choose to stay on an old version. Every release must work seamlessly for users on **any** previously released version.

> **Full storage key reference:** See [`STORAGE.md`](./STORAGE.md) for every key, its shape, which files touch it, and what each version expects.

### How migrations work

`background.ts` listens for `chrome.runtime.onInstalled` with `reason === "update"`. When it fires, the `migrateFromLegacyStorage()` function runs. As a safety net, `App.tsx` also calls the `migrateFromLegacy` message handler if it detects no accounts on load.

### Rules for storage changes

1. **Never remove or rename a storage key without a migration.** If you rename `foo` to `bar`, you must read `foo`, write `bar`, and keep `foo` for at least one release cycle.
2. **Never change the shape of stored data without handling the old shape.** If `accounts` gains a new required field, set a default for entries that lack it.
3. **Migrations must be idempotent.** They can run more than once (onInstalled + App.tsx fallback). Always check if already migrated before writing.
4. **Migrations must not require the wallet to be unlocked.** `onInstalled` fires before the user opens the popup. Only use data from `chrome.storage` (no decryption, no cached passwords).

### Adding a new migration

1. Write a function in `background.ts` (or a dedicated module if complex):
   ```ts
   async function migrateXxx(): Promise<boolean> {
     // Check if already migrated — exit early
     // Read old format
     // Write new format
     // Return true if migrated, false if skipped
   }
   ```
2. Call it from the `onInstalled` `"update"` handler.
3. Add a fallback call from `App.tsx` init if needed (for cases where the service worker was inactive during install).
4. Add a message handler gated with `isExtensionPage(sender)` if the fallback needs it.

### Migration history

| Version | Migration | What it does |
|---------|-----------|--------------|
| v1.0.0 | `migrateFromLegacyStorage` | Creates `accounts` array + `activeAccountId` from legacy `address` / `encryptedApiKey` storage (v0.1.1/v0.2.0 had no multi-account system) |
| v1.0.0 | Vault key (on first unlock) | `authHandlers.ts` auto-migrates `encryptedApiKey` → `encryptedVaultKeyMaster` + `encryptedApiKeyVault` |

### Testing an update locally

1. Build and load the current extension as unpacked
2. Complete onboarding normally
3. Open the **service worker** DevTools console and strip the new storage to simulate an old user:
   ```js
   // Simulate v0.2.0 storage state
   chrome.storage.local.remove([
     'accounts',
     'encryptedVaultKeyMaster',
     'encryptedApiKeyVault',
     'agentPasswordEnabled',
   ]);
   chrome.storage.sync.remove(['activeAccountId', 'tabAccounts']);
   ```
4. Click **Reload** on `chrome://extensions` (fires `onInstalled` with `reason === "update"`)
5. Open the popup — should show unlock screen, not onboarding
6. Enter password — vault key migration runs on unlock
7. Verify the service worker console shows: `[BankrWallet] Legacy storage migration complete: 0x...`

### Pre-release checklist (storage)

Before every release that touches `chrome.storage`:

- [ ] List all storage keys added, removed, or changed
- [ ] For each change: does a user on the previous release have data in the old format?
- [ ] If yes: is there a migration that converts old → new?
- [ ] Is the migration idempotent and does it run without the wallet being unlocked?
- [ ] Test the upgrade path locally using the steps above

## Security Notes

- **Never commit the .pem file** to the repository (it's in `.gitignore`)
- Both `update_url` and CRX download URL must be HTTPS
- The website API caches GitHub responses for 5 minutes to avoid rate limits
- GitHub Actions decodes the signing key from a secret and deletes it immediately after use
- CWS publishing info and permission justifications are in `CHROME_WEBSTORE.md`
