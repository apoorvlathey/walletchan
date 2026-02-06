# BankrWallet

Browser wallet extension + landing page website in a pnpm workspace monorepo.

## Project Overview

**What it does**: BankrWallet is a Chrome extension that impersonates blockchain accounts and executes transactions through the Bankr API. Like MetaMask, but AI-powered with no seed phrases.

**Supported chains**: Base (8453), Ethereum (1), Polygon (137), Unichain (130)

## AI Session Workflow

**At the start of each session**, before writing any code:

1. **Read `IMPLEMENTATION.md`** when working on extension logic, message passing, background handlers, or crypto
2. **Read `STYLING.md`** when working on any UI components or styling
3. **Read `WEBSITE.md`** when working on the landing page

**After making significant changes:**

- **Update `IMPLEMENTATION.md`** if you modified:
  - Message types or message flow
  - Background handler logic
  - Storage keys or encryption patterns
  - New features or architectural decisions
- Keep the documentation in sync with the code - future sessions depend on accurate docs

## Monorepo Structure

```
bankr-wallet/
├── apps/
│   ├── extension/    # Browser extension (Vite + React + Chakra UI)
│   └── website/      # Landing page (Next.js + Chakra UI)
├── packages/
│   └── shared/       # Shared design tokens and assets
├── IMPLEMENTATION.md # Extension architecture and message flows
├── STYLING.md        # Bauhaus design system (colors, typography, components)
├── WEBSITE.md        # Website PRD and section specs
└── DEVELOPMENT.md    # Detailed build and release instructions
```

## Tech Stack

| App       | Framework               | UI Library | Build Tool |
| --------- | ----------------------- | ---------- | ---------- |
| Extension | React 18                | Chakra UI  | Vite       |
| Website   | Next.js 14 (App Router) | Chakra UI  | Next.js    |

**Design System**: Bauhaus - geometric, primary colors (Red #D02020, Blue #1040C0, Yellow #F0C020), hard shadows, thick borders. See `STYLING.md`.

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev:extension      # Build extension in dev mode
pnpm dev:website        # Start website dev server at localhost:3000

# Build
pnpm build              # Build both extension and website
pnpm build:extension    # Build extension only (output: apps/extension/build/)
pnpm build:website      # Build website only

# Extension-specific
pnpm zip                # Create distribution zip
pnpm lint               # Lint extension code

# Release (auto-bumps version, syncs manifest, creates tag, pushes)
pnpm release:patch      # 0.1.0 → 0.1.1
pnpm release:minor      # 0.1.0 → 0.2.0
pnpm release:major      # 0.1.0 → 1.0.0
```

## Extension Architecture

The extension has 5 build targets (see `apps/extension/vite.config.*.ts`):

| Script        | Purpose                                            |
| ------------- | -------------------------------------------------- |
| main.js       | Popup/sidepanel UI (React app)                     |
| onboarding.js | Full-page onboarding wizard                        |
| inpage.js     | Injected provider (EIP-6963 + window.ethereum)     |
| inject.js     | Content script (bridges inpage ↔ background)       |
| background.js | Service worker (API calls, storage, notifications) |

**Message flow**: Dapp → inpage.js → inject.js → background.js → Bankr API

For detailed architecture, message types, and flows, see `IMPLEMENTATION.md`.

## Key Extension Files

```
apps/extension/src/
├── chrome/
│   ├── background.ts        # Service worker (message router)
│   ├── authHandlers.ts      # Unlock, password change, vault key migration
│   ├── sessionCache.ts      # Credential caching, auto-lock, session restore
│   ├── txHandlers.ts        # Transaction/signature handling, account mgmt
│   ├── chatHandlers.ts      # Bankr AI chat prompt handling
│   ├── sidepanelManager.ts  # Sidepanel/popup mode, Arc browser detection
│   ├── crypto.ts            # AES-256-GCM encryption for API keys
│   ├── cryptoUtils.ts       # Shared crypto utilities (PBKDF2, base64)
│   ├── vaultCrypto.ts       # Vault encryption for private keys
│   ├── bankrApi.ts          # Bankr API client
│   ├── impersonator.ts      # Inpage provider (EIP-6963)
│   └── inject.ts            # Content script bridge
├── components/
│   ├── TransactionConfirmation.tsx
│   ├── SignatureRequestConfirmation.tsx
│   ├── UnlockScreen.tsx
│   └── Settings/
├── pages/
│   └── Onboarding.tsx
└── App.tsx                   # Main popup app
```

## Key Website Files

```
apps/website/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── components/        # Hero, Features, TokenSection, etc.
└── lib/
    └── theme.ts           # Chakra UI Bauhaus theme
```

## Documentation References

When working on features, refer to these docs:

| Doc                              | When to read                                          |
| -------------------------------- | ----------------------------------------------------- |
| `IMPLEMENTATION.md`              | Extension internals, message types, tx flow           |
| `CHAT.md`                        | Chat interface to directly chat & prompt to bankr api |
| `STYLING.md`                     | UI components, design tokens, Bauhaus system          |
| `WEBSITE.md`                     | Website sections, layout specs, animations            |
| `DEVELOPMENT.md`                 | Build process, release workflow                       |
| `openclaw-skills/bankr/SKILL.md` | Bankr API interactions, workflows, error handling     |

## Important Patterns

- **API key encryption**: AES-256-GCM with PBKDF2 (600k iterations)
- **Session caching**: Decrypted API key cached in background worker memory with auto-lock timeout
- **Per-tab chain state**: Each browser tab maintains its own selected chain
- **Transaction persistence**: Pending transactions survive popup close (stored in chrome.storage.local)
- **EIP-6963**: Modern wallet discovery alongside legacy window.ethereum

## Code Quality Guidelines

### File Size & Modularity
- **Keep files under ~400 lines.** If a file grows beyond that, split it into focused modules by responsibility.
- **One concern per file.** Each module should have a clear, single purpose (e.g., `sessionCache.ts` owns all credential caching, `authHandlers.ts` owns all unlock/password logic).
- **background.ts is a message router only.** It registers Chrome event listeners and delegates to handler modules. Never add business logic directly to it.

### Reuse Over Duplication
- **Extract shared utilities** when the same logic appears in 2+ files. See `cryptoUtils.ts` for the pattern (shared constants + functions used by both `crypto.ts` and `vaultCrypto.ts`).
- **Reuse existing React components** before creating new ones. Check `components/` for existing UI patterns.
- **Use dependency injection** to avoid circular imports (e.g., `tryRestoreSession(unlockFn)` in `sessionCache.ts` takes a callback instead of importing `authHandlers.ts` directly).

### Naming & Organization
- **Handler files**: `*Handlers.ts` (e.g., `authHandlers.ts`, `txHandlers.ts`, `chatHandlers.ts`)
- **State/cache files**: descriptive names (e.g., `sessionCache.ts`, `pendingTxStorage.ts`)
- **Utility files**: `*Utils.ts` (e.g., `cryptoUtils.ts`)
- **Keep related functions together** - if functions share state (like in-memory Maps), they belong in the same module.

### When Adding New Features
- Place new message handlers in the appropriate `*Handlers.ts` file, not in `background.ts`.
- Add the message routing case to the switch in `background.ts` (just a 1-3 line delegation).
- If a feature doesn't fit existing modules, create a new focused module rather than growing an existing one.
- Update `IMPLEMENTATION.md` and this file's Key Extension Files section if you add new modules.

## Development Practices

### Storage/Encryption Changes

When modifying how data is stored or encrypted (e.g., the vault key system):

1. **Audit ALL read AND write paths** - grep for storage key names (`encryptedApiKey`, `encryptedApiKeyVault`, etc.)
2. **Check every file** that touches the data - `background.ts` has multiple handlers, `AccountSettingsModal.tsx` can save directly
3. **Common mistake**: updating read paths but forgetting write paths in different files/handlers

### Key Storage Locations

| Key | Purpose |
| --- | ------- |
| `encryptedApiKeyVault` | API key encrypted with vault key (current format) |
| `encryptedApiKey` | API key encrypted with password (legacy format) |
| `encryptedVaultKeyMaster` | Vault key encrypted with master password |

**Rule**: Check `cachedVaultKey` to determine which system is active before saving API keys.

### User-Reported Anomalies

When a user reports something unexpected (like a wrong value appearing):
- Don't dismiss it - trace the full data flow
- Ask: "Where does this value come from? What code path could produce it?"
- The anomaly is often a symptom of a deeper storage/migration issue

## Testing Extension Changes

1. `pnpm build:extension`
2. Go to `chrome://extensions`
3. Click refresh icon on BankrWallet card
4. Test in a dapp (e.g., app.aave.com)
