# BankrWallet Transaction Handling Implementation

## Overview

BankrWallet is a Chrome extension that supports two types of accounts:

1. **Bankr API Accounts** - AI-powered wallets that execute transactions through the Bankr API
2. **Private Key Accounts** - Standard wallets with local key storage for transaction signing

This document describes the core architecture and transaction handling implementation.

**Related Documentation:**

- [SECURITY.md](./SECURITY.md) - Security audit guide, threat model, and pre-commit checklists
- [PK_ACCOUNTS.md](./PK_ACCOUNTS.md) - Private key accounts implementation (security, signing, storage)
- [CHAT.md](./CHAT.md) - Chat feature implementation (AI conversations with Bankr agent)

## Account Types

The extension supports two distinct account types that can be used simultaneously:

| Feature               | Bankr API Account         | Private Key Account                 |
| --------------------- | ------------------------- | ----------------------------------- |
| Transaction Execution | Via Bankr API             | Local signing + RPC broadcast       |
| Message Signing       | ❌ Not supported          | ✅ Full support                     |
| Key Storage           | API key encrypted locally | Private key encrypted locally       |
| Setup                 | API key + wallet address  | Private key import                  |
| Use Case              | AI-powered transactions   | Agent wallets, bots, standard usage |

### Account Selection

- Users can configure one or both account types during onboarding
- When both accounts are set up, the first account added becomes the default active account
- Each browser tab maintains its own active account selection (similar to per-tab chain)
- The popup/sidepanel shows the account for the currently active tab
- Account switching emits `accountsChanged` events to connected dApps

### Address Synchronization

The extension maintains address consistency between storage and the active account:

1. **On Onboarding**: When both account types are configured, the first account's address (PK account) is saved to `chrome.storage.sync.address` since it becomes the active account.

2. **On Account Switch**: When `setActiveAccount` is called, the background worker:
   - Updates `activeAccountId` in storage
   - Updates `address` and `displayAddress` in `chrome.storage.sync`
   - The storage change listener broadcasts `setAddress` to all tabs

3. **On Content Script Init**: The inject.ts script:
   - Reads the initial address from `chrome.storage.sync`
   - Verifies with background that the address matches the active account
   - If mismatched (e.g., stale storage), emits `accountsChanged` with the correct address

4. **On Address Change**: The inject.ts `setAddress` handler now emits `accountsChanged` when the address changes, ensuring dApps are notified of updates from any source.

### Transaction Routing

When a dApp initiates a transaction:

1. Extension checks the active account type for that tab
2. **Bankr Account**: Transaction submitted to Bankr API → API executes → returns tx hash
3. **PK Account**: Transaction signed locally with viem → broadcast to RPC → returns tx hash

For detailed implementation of private key accounts, see [PK_ACCOUNTS.md](./PK_ACCOUNTS.md).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  Dapp                                        │
│                         (e.g., app.aave.com)                                │
│                                                                             │
│  Provider Discovery:                                                        │
│    - EIP-6963: Listen for eip6963:announceProvider events (modern)          │
│    - Legacy: Access window.ethereum directly                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ eth_sendTransaction / RPC calls
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Inpage Script (inpage.js)                           │
│                         ImpersonatorProvider class                          │
│                         - Announces via EIP-6963 events                     │
│                         - Sets window.ethereum (legacy)                     │
│                         - Intercepts wallet methods                         │
│                         - Proxies RPC calls via postMessage                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ postMessage (i_sendTransaction, i_rpcRequest)
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Content Script (inject.js)                           │
│                        - Bridges inpage ↔ background                        │
│                        - Forwards messages via chrome.runtime               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ chrome.runtime.sendMessage
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Background Service Worker (background.js)               │
│                     - Message router + Chrome event listeners               │
│                     - Delegates to: sessionCache, authHandlers,             │
│                       txHandlers, chatHandlers, sidepanelManager            │
│                     - Makes Bankr API calls, proxies RPC calls              │
│                     - Manages encrypted credential cache                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│    Extension Popup           │    │       Bankr API              │
│    (index.html)              │    │  api.bankr.bot               │
│    - Unlock screen           │    │  - POST /agent/prompt        │
│    - Pending tx banner       │    │  - GET /agent/job/{id}       │
│    - In-popup tx confirm     │    │  - POST /agent/job/{id}/cancel│
│    - Settings management     │    │                              │
└──────────────────────────────┘    └──────────────────────────────┘
```

## Supported Chains

Only the following chains are supported for transaction signing (listed in dropdown order):

| Chain    | Chain ID | Default RPC                  |
| -------- | -------- | ---------------------------- |
| Base     | 8453     | https://mainnet.base.org     |
| Ethereum | 1        | https://eth.llamarpc.com     |
| Polygon  | 137      | https://polygon-rpc.com      |
| Unichain | 130      | https://mainnet.unichain.org |

These are configured in `src/constants/networks.ts` and pre-populated on first install.

**Default Network**: Base is set as the default network for new installations.

## Provider Discovery (EIP-6963)

BankrWallet implements [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963) for multi-wallet discovery, allowing dapps to detect and display the wallet alongside other installed wallets.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  Dapp                                        │
│                   1. Listens for eip6963:announceProvider                   │
│                   2. Dispatches eip6963:requestProvider                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ CustomEvent with provider detail
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Inpage Script (inpage.js)                           │
│                                                                             │
│  On init:                                                                   │
│    1. Set window.ethereum (legacy support)                                  │
│    2. Dispatch eip6963:announceProvider event                               │
│                                                                             │
│  On eip6963:requestProvider event:                                          │
│    → Re-announce provider                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Provider Info

The wallet announces itself with the following EIP-6963 provider info:

| Property | Value                                      |
| -------- | ------------------------------------------ |
| uuid     | Random UUIDv4 (generated per page session) |
| name     | "Bankr Wallet"                             |
| icon     | Data URI of wallet icon (128x128 PNG)      |
| rdns     | "app.bankrwallet"                          |

### Implementation Details

The provider info, announcement function, and request listener are in `src/chrome/impersonator.ts`. The wallet announces on init and re-announces on `eip6963:requestProvider` events.

### Backward Compatibility

The wallet maintains backward compatibility by:

1. Setting `window.ethereum` for legacy dapps
2. Announcing via EIP-6963 for modern dapps

Dapps that support EIP-6963 will show Bankr Wallet in their wallet selection UI. Legacy dapps will still work via `window.ethereum`.

### Multi-Wallet Conflict Handling

Some wallets (like Rabby) aggressively claim `window.ethereum` using `Object.defineProperty` with a getter-only descriptor, which prevents other wallets from setting it via direct assignment. BankrWallet handles this gracefully:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      window.ethereum Claim Strategy                          │
│                                                                             │
│  1. Try to delete existing window.ethereum property                         │
│     (clears getter-only descriptors if configurable)                        │
│                                                                             │
│  2. Try direct assignment: window.ethereum = provider                       │
│     (works if property doesn't exist or has a setter)                       │
│                                                                             │
│  3. If direct assignment fails, use Object.defineProperty with:             │
│     - configurable: true                                                    │
│     - writable: true                                                        │
│     - enumerable: true                                                      │
│                                                                             │
│  4. If all attempts fail:                                                   │
│     - Log a warning (not an error)                                          │
│     - Continue with EIP-6963 announcements                                  │
│     - Modern dapps will still discover the wallet                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**See**: `src/chrome/impersonator.ts` → `setWindowEthereum()` for the full claim strategy implementation.

**Internal Provider References**:

To avoid issues with other wallets intercepting `window.ethereum`, all internal operations use the `providerInstance` variable directly:

- `setAddress` and `setChainId` message handlers use `providerInstance`
- `wallet_switchEthereumChain` captures `this` reference before async operations
- EIP-6963 announcements use `providerInstance`

This ensures the wallet functions correctly even when `window.ethereum` is claimed by another extension.

## File Structure

```
src/
├── chrome/
│   ├── impersonator.ts      # Inpage script - EIP-6963 provider + window.ethereum
│   ├── inject.ts            # Content script - message bridge
│   ├── background.ts        # Service worker - message router + Chrome event listeners
│   ├── sessionCache.ts      # Credential caching, session persistence, auto-lock
│   ├── authHandlers.ts      # Wallet unlock, vault key system, password management
│   ├── txHandlers.ts        # Transaction/signature handlers, notifications
│   ├── chatHandlers.ts      # Bankr AI chat prompt handling
│   ├── sidepanelManager.ts  # Side panel detection and mode management
│   ├── cryptoUtils.ts       # Shared crypto utilities (PBKDF2, base64, constants)
│   ├── crypto.ts            # AES-256-GCM encryption for API key and vault
│   ├── vaultCrypto.ts       # Vault encryption/decryption for private keys
│   ├── types.ts             # Account and vault type definitions
│   ├── localSigner.ts       # Transaction and message signing with viem
│   ├── accountStorage.ts    # Account CRUD operations
│   ├── bankrApi.ts          # Bankr API client
│   ├── chatApi.ts           # Chat API client for Bankr agent
│   ├── chatStorage.ts       # Persistent storage for chat conversations
│   ├── pendingTxStorage.ts  # Persistent storage for pending transactions
│   ├── pendingSignatureStorage.ts # Persistent storage for pending signature requests
│   └── txHistoryStorage.ts  # Persistent storage for completed transaction history
├── constants/
│   ├── networks.ts          # Default networks configuration
│   └── chainConfig.ts       # Chain-specific styling/icons
├── pages/
│   ├── Onboarding.tsx       # Full-page onboarding wizard for first-time setup
│   └── ApiKeySetup.tsx      # API key + wallet address configuration
├── components/
│   ├── Chat/
│   │   ├── ChatView.tsx     # Main chat orchestrator (list/chat modes)
│   │   ├── ChatList.tsx     # Past conversations list
│   │   ├── ChatHeader.tsx   # Navigation and actions
│   │   ├── ChatInput.tsx    # Text input + send button
│   │   ├── MessageList.tsx  # Scrollable message container
│   │   ├── MessageBubble.tsx # Individual message display
│   │   └── ShapesLoader.tsx # Animated Bauhaus loading indicator
│   ├── Settings/
│   │   ├── index.tsx        # Main settings page (includes clear history)
│   │   ├── Chains.tsx       # Chain RPC management
│   │   ├── AddChain.tsx     # Add new chain
│   │   ├── EditChain.tsx    # Edit existing chain
│   │   ├── ChangePassword.tsx # Password change flow
│   │   ├── AutoLockSettings.tsx # Auto-lock timeout configuration
│   │   └── AgentPasswordSettings.tsx # Agent password set/remove (master only)
│   ├── AccountSwitcher.tsx  # Account dropdown and selection
│   ├── AccountSettingsModal.tsx # Account settings (rename, reveal key, remove, change API key)
│   ├── RevealPrivateKeyModal.tsx # Password-protected private key reveal
│   ├── AddAccount.tsx       # Add new account screen
│   ├── UnlockScreen.tsx     # Wallet unlock (password entry)
│   ├── PendingTxBanner.tsx  # Banner showing pending tx/signature count
│   ├── PendingTxList.tsx    # List of pending transactions and signature requests
│   ├── TxStatusList.tsx     # Recent transaction history display
│   ├── TransactionConfirmation.tsx # In-popup tx confirmation with success animation
│   └── SignatureRequestConfirmation.tsx # Signature request display (confirm for PK, reject for Bankr)
├── hooks/
│   └── useChat.ts           # Chat state management hook
├── onboarding.tsx           # React entry point for onboarding page
└── App.tsx                  # Main popup application

public/
├── onboarding.html          # HTML entry point for onboarding page
└── manifest.json            # Extension manifest
```

## Onboarding Flow

When the extension is first installed or reset, users are guided through a step-by-step onboarding wizard in a full-page browser tab.

### Auto-Open on Install

The background service worker listens for the `onInstalled` event:

```typescript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const onboardingUrl = chrome.runtime.getURL("onboarding.html");
    await chrome.tabs.create({ url: onboardingUrl });
  }
});
```

### Onboarding Steps

The onboarding flow varies based on account type selection:

**Step 0: Welcome Screen**

- Bankr logo + branding
- "Welcome to Bankr Wallet" heading
- "Get Started" button

**Step 1: Account Type Selection**

- Choose: Bankr Wallet, Private Key, or both
- Checkbox: "Set up both account types"

**Step 2a: Bankr Setup** (if Bankr or both selected)

- API key input field
- Wallet address input (supports ENS resolution)
- Display name (optional) - allows custom naming like "My Bankr Wallet"
- Links to bankr.bot for API key and terminal

**Step 2b: Private Key Setup** (if PK or both selected)

- Private key input with show/hide toggle
- Auto-derives and displays address
- Display name (optional) - allows custom naming like "My Trading Wallet"
- Security warning about local storage

**Step 3: Create Password**

- Password + Confirm password fields (min 6 chars)
- Security warning about password recovery

**Step 4: Success**

- Animated green checkmark
- "You're all set!" message
- Floating arrow pointing to extension area
- "Pin & click the extension" instruction

### Tab Auto-Close

When the user opens the extension popup after completing onboarding, the onboarding tab is automatically closed:

```typescript
// In App.tsx init()
const onboardingUrlPattern = chrome.runtime.getURL("onboarding.html") + "*";
const onboardingTabs = await chrome.tabs.query({ url: onboardingUrlPattern });
for (const tab of onboardingTabs) {
  if (tab.id) {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}
```

**Note**: This requires the `tabs` permission in manifest.json to query and close `chrome-extension://` URLs.

### Already Configured Check

If a user navigates to the onboarding page when the extension is already configured, they're shown the success screen directly (no sensitive data exposed):

```typescript
useEffect(() => {
  const checkExistingSetup = async () => {
    const hasApiKey = await hasEncryptedApiKey();
    if (hasApiKey) {
      setStep("success");
    }
    setIsCheckingSetup(false);
  };
  checkExistingSetup();
}, []);
```

### Build Configuration

The onboarding page has its own Vite build config:

| Target     | Config File               | Output                        |
| ---------- | ------------------------- | ----------------------------- |
| Onboarding | vite.config.onboarding.ts | build/static/js/onboarding.js |

Build command: `pnpm build:onboarding` (included in `pnpm build`)

## Transaction Flow

### 1. Dapp Discovers & Connects to Wallet

Modern dapps (EIP-6963):

```javascript
// Dapp listens for wallet announcements
window.addEventListener("eip6963:announceProvider", (event) => {
  const { info, provider } = event.detail;
  // info.name === "Bankr Wallet"
  // provider is the EIP-1193 provider
});

// Dapp requests wallets to announce
window.dispatchEvent(new Event("eip6963:requestProvider"));
```

Legacy dapps:

```javascript
// Direct access to injected provider
const provider = window.ethereum;
```

### 2. Dapp Initiates Transaction

```javascript
// Dapp calls (works with both EIP-6963 provider or window.ethereum)
await provider.request({
  method: "eth_sendTransaction",
  params: [
    {
      to: "0x...", // null for contract deployment
      data: "0x...",
      value: "0x0",
    },
  ],
});
```

**Contract Deployment**: When the `to` field is `null` (not address zero), the transaction is treated as a contract deployment. This is supported across both Bankr API and Private Key accounts. The confirmation UI shows a "Contract Deployment" badge instead of a recipient address.

### 3. Impersonator Validates & Forwards

`src/chrome/impersonator.ts`:

- Validates chain ID is in allowed list (1, 137, 8453, 130)
- Creates unique transaction ID
- Allows `to` to be null for contract deployment transactions
- Posts message to content script
- Returns Promise that resolves when tx completes

### 4. Content Script Bridges to Background

`src/chrome/inject.ts`:

- Receives `i_sendTransaction` message
- Forwards to background via `chrome.runtime.sendMessage`
- Sends result back to inpage via `postMessage`

### 5. Background Stores Pending Transaction & Opens Popup

`src/chrome/background.ts`:

- Validates chain ID again (double-check)
- Checks if API key is configured
- Stores pending transaction in `chrome.storage.local`
- Updates extension badge with pending count
- **Auto-opens popup window** for user confirmation

### 6. Popup Auto-Opens for Transaction Confirmation

The extension automatically opens a popup window when a transaction request is received:

- Popup positioned at **top-right of the dapp's browser window**
- Works correctly across **multiple monitors** (follows the dapp's window)
- If popup already exists, focuses the existing window instead of creating a new one
- Shows the **newest transaction** by default (e.g., "2/2" not "1/2")

### 7. User Confirms Transaction in Popup

`src/App.tsx` + `src/components/TransactionConfirmation.tsx`:

- If wallet locked (API key not cached): shows unlock screen first
- Shows pending transaction banner if requests exist
- Displays: origin (with favicon), network, to address (with labels), value, data
- User clicks Confirm or Reject
- Closing popup does NOT cancel transaction (persisted)

#### Address Labels

The "to" address displays labels fetched from eth.sh API:

```typescript
const response = await fetch(
  `https://eth.sh/api/labels/${tx.to}?chainId=${tx.chainId}`,
);
const labels = await response.json();
// Displays as badges below the address (e.g., "Uniswap V3: Router")
```

#### Multiple Transaction Handling

When multiple transactions are pending:

- **Navigation**: Arrow buttons (`<` `>`) to switch between transactions
- **Counter**: Badge showing position (e.g., "2/2")
- **Reject All**: Button to reject all pending transactions at once
- **Header Layout**: Back arrow (left) | "Tx Request < 2/2 >" (center) | "Reject All" (right)

Each transaction maintains its own response callback - rejecting/confirming one transaction only affects that specific dapp's request.

### 7. Background Submits to Bankr API

`src/chrome/bankrApi.ts`:

- Formats transaction as JSON prompt:

```json
Submit this transaction:
{
  "to": "0x...",
  "data": "0x...",
  "value": "0",
  "chainId": 8453
}
```

- POST to `https://api.bankr.bot/agent/prompt`
- Polls `GET /agent/job/{jobId}` every 2 seconds
- Extracts transaction hash from response

### 8. Result Returned to Dapp

- Transaction hash extracted via regex: `/0x[a-fA-F0-9]{64}/`
- Returned through the message chain back to dapp
- Dapp receives the tx hash from `eth_sendTransaction`

## Signature Request Handling

Signature support differs by account type:

| Account Type | Signature Support                        |
| ------------ | ---------------------------------------- |
| Bankr API    | ❌ Not supported (reject only)           |
| Private Key  | ✅ Full support (sign locally with viem) |

When dapps request signatures, the extension displays the request details. For Bankr accounts, only rejection is allowed. For Private Key accounts, users can confirm to sign the message locally.

### Supported Signature Methods

| Method                 | Description                      |
| ---------------------- | -------------------------------- |
| `personal_sign`        | Sign a plain text message        |
| `eth_sign`             | Sign arbitrary data (deprecated) |
| `eth_signTypedData`    | Sign typed data (EIP-712)        |
| `eth_signTypedData_v3` | Sign typed data v3               |
| `eth_signTypedData_v4` | Sign typed data v4               |

### Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Signature Request Flow                                  │
│                                                                             │
│  1. Dapp calls personal_sign, eth_signTypedData_v4, etc.                    │
│  2. Impersonator creates pending promise with sigId                         │
│  3. Request forwarded to background via content script                      │
│  4. Background stores in pendingSignatureRequests storage                   │
│  5. Popup/sidepanel shows SignatureRequestConfirmation                      │
│  6. User action depends on account type:                                    │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  Bankr API Account:                                              │    │
│     │    - Only REJECT button shown                                    │    │
│     │    - Warning: "Signatures not supported"                         │    │
│     │    - Rejection returns error to dapp                             │    │
│     ├─────────────────────────────────────────────────────────────────┤    │
│     │  Private Key Account:                                            │    │
│     │    - CONFIRM and REJECT buttons shown                            │    │
│     │    - Confirm: Signs message locally using viem                   │    │
│     │    - Signature returned to dapp                                  │    │
│     └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UI Display

The SignatureRequestConfirmation component shows:

- Origin (with favicon)
- Network badge
- Method name (e.g., "Personal Sign", "Sign Typed Data v4")
- Decoded message content (for personal_sign)
- Raw data with copy button

**For Bankr API Accounts:**

- Warning box: "Signatures are not supported for this account type"
- Reject button only (red) - emphasizes that signing is not possible

**For Private Key Accounts:**

- Sign button (yellow): Signs the message locally
- Reject button (white/secondary): Cancels the request - matches transaction confirmation style

### Combined Navigation

When both transaction and signature requests are pending:

- Counter shows combined total (e.g., "1/3" for 2 tx + 1 sig)
- Transaction requests appear first in the list
- Navigation arrows allow moving between all request types
- "Reject All" button rejects both transactions and signatures
- Pending list shows both types with TX/SIG badges

## Async Transaction Confirmation

When a user confirms a transaction, the extension uses an async flow that allows the popup to close immediately while processing continues in the background.

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Async Transaction Confirmation Flow                      │
│                                                                             │
│  1. User clicks "Confirm" in popup/sidepanel                                │
│  2. Popup sends "confirmTransactionAsync" to background                     │
│  3. Background immediately responds with { success: true }                  │
│  4. Popup behavior:                                                         │
│     - Sidepanel: Navigate back to main view immediately                     │
│     - Popup: Show success animation, then close after 1 second              │
│  5. Background processes transaction in parallel:                           │
│     a. Adds to history with status: "processing"                            │
│     b. Calls Bankr API and polls for result                                 │
│     c. On success: Updates history, shows notification                      │
│     d. On failure: Updates history with error, shows notification           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Success Animation (Popup Mode Only)

When confirming a transaction in popup mode, a full-screen success animation is shown:

```typescript
// Animation keyframes
const scaleIn = keyframes`
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
`;

const checkmarkDraw = keyframes`
  0% { stroke-dashoffset: 50; }
  100% { stroke-dashoffset: 0; }
`;
```

The animation shows:

- Green circular badge with animated checkmark
- "Transaction Sent" heading
- "Your transaction has been submitted" subtext
- Auto-closes popup after 1 second

In sidepanel mode, the view navigates back immediately without the animation (sidepanel stays open for further interactions).

## Browser Notifications

The extension uses Chrome's Notifications API to alert users when transactions complete while the popup/sidepanel is closed.

### Notification Types

| Event                 | Title                   | Message                                          |
| --------------------- | ----------------------- | ------------------------------------------------ |
| Transaction Confirmed | "Transaction Confirmed" | "Your transaction on {chainName} was successful" |
| Transaction Failed    | "Transaction Failed"    | "Error: {errorMessage}"                          |

**See**: `src/chrome/txHandlers.ts` → `showNotification()` for implementation.

### macOS Permissions Note

On macOS, Chrome notifications require explicit permission in System Preferences:

- **System Preferences → Notifications → Google Chrome → Allow Notifications**

Without this permission, `chrome.notifications.create()` will execute without error but no notification will appear.

### Manifest Permission

The `"notifications"` permission is required in `manifest.json`.

## Transaction History

Completed transactions (confirmed or failed) are stored persistently and displayed on the homepage.

### Data Model

**See**: `src/chrome/txHistoryStorage.ts` for `CompletedTransaction` interface and `TxStatus` type. Each entry tracks the transaction params, origin, chain, status (processing/success/failed), timestamps, and result (txHash or error).

### Storage Functions

| Function                           | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `getTxHistory()`                   | Get all history (newest first, max 50)    |
| `addTxToHistory(tx)`               | Add new entry with "processing" status    |
| `updateTxInHistory(txId, updates)` | Update status, txHash, error, completedAt |
| `clearTxHistory()`                 | Remove all history entries                |

### Storage Details

- **Key**: `txHistory` in `chrome.storage.local`
- **Max entries**: 50 (oldest entries removed when limit exceeded)
- **Sort order**: Newest first (by `createdAt`)

### UI Component

`src/components/TxStatusList.tsx` displays the transaction history:

- **Default view**: 5 most recent transactions
- **Expandable**: Show/hide older transactions
- **Empty state**: "No recent transactions" message
- **Account filtering**: Only shows transactions from the currently selected account (filtered by `tx.from` address)

Each transaction shows:

- Origin favicon and hostname
- Chain badge with icon
- Status badge:
  - **Processing**: Blue badge with spinner
  - **Confirmed**: Green badge with checkmark, explorer link
  - **Failed**: Red badge with warning icon, error message
- Relative timestamp ("Just now", "5m ago", "2h ago")

### Real-time Updates

The component listens for `txHistoryUpdated` messages to refresh automatically:

```typescript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "txHistoryUpdated") {
    chrome.runtime.sendMessage({ type: "getTxHistory" }, (result) => {
      setHistory(result || []);
    });
  }
});
```

### Clear History

Users can clear transaction history via Settings:

- Navigate to Settings → "Clear Transaction History"
- Confirmation modal prevents accidental deletion
- Message: "This will permanently delete all transaction records. This action cannot be undone."

## RPC Proxy (CSP Bypass)

Many dapps have strict Content Security Policy that blocks connections to RPC endpoints. The inpage script runs in the page's context and is subject to these restrictions.

**Solution**: Proxy all RPC calls through the background worker.

```
Inpage                    Content Script              Background
   │                           │                          │
   │ i_rpcRequest              │                          │
   │ {rpcUrl, method, params}  │                          │
   ├──────────────────────────►│                          │
   │                           │ rpcRequest               │
   │                           ├─────────────────────────►│
   │                           │                          │ fetch(rpcUrl)
   │                           │                          │
   │                           │ {result}                 │
   │                           │◄─────────────────────────┤
   │ rpcResponse               │                          │
   │◄──────────────────────────┤                          │
```

The background worker is not subject to page CSP, so it can call any RPC endpoint.

## Chain Switching

The extension supports dapp-initiated chain switching via `wallet_switchEthereumChain`. Each tab maintains its own selected chain, and the popup/sidepanel reflects the chain for the currently active tab.

### Dapp-Initiated Chain Switch

When a dapp calls `wallet_switchEthereumChain`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Dapp Chain Switch Flow                                  │
│                                                                             │
│  1. Dapp calls wallet_switchEthereumChain({ chainId: "0x2105" })            │
│  2. Impersonator sends i_switchEthereumChain to content script              │
│  3. Content script looks up chainId in networksInfo:                        │
│     - If FOUND: Save chainName to storage, send switchEthereumChain         │
│     - If NOT FOUND: Send switchEthereumChainError with error message        │
│  4. Impersonator receives response:                                         │
│     - Success: Updates provider chainId, emits chainChanged event           │
│     - Error: Rejects promise with error (dapp can catch and handle)         │
│  5. Popup/sidepanel storage listener detects chainName change               │
│  6. Network dropdown updates to reflect new chain                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Unsupported Chain Handling

If the dapp requests an unsupported chain ID:

- Content script checks `networksInfo` for the chain
- If not found, sends `switchEthereumChainError` message
- Impersonator rejects the promise with error: `"Chain {chainId} is not supported"`
- Dapp receives the error and can display appropriate UI

### Per-Tab Chain State

Each browser tab maintains its own chain selection:

- **Content script store**: `store.chainName` holds the chain for that tab
- **Storage sync**: When chain changes, `chainName` is saved to `chrome.storage.sync`
- **Tab switching**: Popup listens for `chrome.tabs.onActivated` events
- **State query**: On tab switch, popup queries new tab via `getInfo` message
- **UI update**: Network dropdown updates to show the active tab's chain

### Popup/Sidepanel Chain Sync

The extension UI stays in sync with chain changes through multiple mechanisms:

| Trigger             | Mechanism                  | Description                          |
| ------------------- | -------------------------- | ------------------------------------ |
| Dapp switches chain | `chrome.storage.onChanged` | Detects `chainName` storage updates  |
| User switches tabs  | `chrome.tabs.onActivated`  | Queries new tab's content script     |
| User selects chain  | `useUpdateEffect`          | Sends `setChainId` to content script |
| Popup opens         | `init()`                   | Queries current tab via `getInfo`    |

## Sensitive Data Encryption

Both the Bankr API key and private keys are encrypted using AES-256-GCM with PBKDF2 key derivation.

`src/chrome/crypto.ts` and `src/chrome/vaultCrypto.ts`:

### Legacy System (Pre-Vault Key)

```
User Password
      │
      ▼
PBKDF2 (600,000 iterations, random salt)
      │
      ▼
AES-256-GCM Key
      │
      ▼
Encrypt Sensitive Data (random IV)
      │
      ▼
Store in chrome.storage.local:
{
  encryptedApiKey: { ... },    // API key encrypted with password
  encryptedVault: { ... },      // Private keys encrypted with password
}
```

### Vault Key System (Current)

After migration, the vault key system is used for better multi-password support:

```
Master/Agent Password
      │
      ▼
PBKDF2 (600,000 iterations)
      │
      ▼
Decrypt Vault Key from encryptedVaultKeyMaster or encryptedVaultKeyAgent
      │
      ▼
Vault Key (32-byte AES)
      │
      ▼
Decrypt Sensitive Data:
{
  encryptedVaultKeyMaster: { ... },  // Vault key encrypted with master password
  encryptedVaultKeyAgent: { ... },   // Vault key encrypted with agent password (optional)
  encryptedApiKeyVault: { ... },     // API key encrypted with vault key
  encryptedVault: { ... },           // Private keys (still uses legacy format)
  accounts: [...]                     // Account metadata (no sensitive data)
}
```

**IMPORTANT**: When saving API keys after vault key migration, always use `encryptedApiKeyVault` (encrypted with vault key), NOT `encryptedApiKey` (encrypted with password). The background worker's `handleSaveApiKeyWithCachedPassword()` and `addBankrAccount` handler automatically detect which system is in use and save to the correct location.

**Security Note**: Private keys are ONLY decrypted in the service worker (background.ts) and NEVER exposed to content scripts, inpage scripts, or the UI layer. See [PK_ACCOUNTS.md](./PK_ACCOUNTS.md) for detailed security architecture.

### Session Caching (Wallet Lock/Unlock)

Wallet lock flow for secure credential management:

- Decrypted API key, **private keys vault**, and password are cached in background worker memory
- **Private keys are NEVER sent to UI** - only used internally for signing
- Cache expires based on **configurable auto-lock timeout** (default: 15 minutes)
- Cache cleared on browser close or extension suspend
- When locked, user must enter password before:
  - Viewing the main wallet interface
  - Confirming any pending transactions or signature requests
- Unlock persists across popup open/close cycles (until cache expires)

#### Agent Password (Optional Secondary Password)

Users can optionally configure an **agent password** that allows AI agents to unlock the wallet for normal operations while protecting private key reveal:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Agent Password Architecture                          │
│                                                                             │
│  Vault Key System:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Master Password → PBKDF2 → encrypts vault key → encryptedVaultKeyMaster│
│  │  Agent Password  → PBKDF2 → encrypts vault key → encryptedVaultKeyAgent │
│  │                                    ↓                                    │
│  │                              Vault Key (32-byte AES)                    │
│  │                                    ↓                                    │
│  │                    Decrypts: API key, private key vault                 │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Access Levels:                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Master Password:                                                    │   │
│  │    ✅ Unlock wallet                                                  │   │
│  │    ✅ Sign transactions                                              │   │
│  │    ✅ Sign messages                                                  │   │
│  │    ✅ Reveal private keys                                            │   │
│  │    ✅ Manage agent password settings                                 │   │
│  │    ✅ Change master password                                         │   │
│  │    ✅ Change Bankr API key & address                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Agent Password:                                                     │   │
│  │    ✅ Unlock wallet                                                  │   │
│  │    ✅ Sign transactions                                              │   │
│  │    ✅ Sign messages                                                  │   │
│  │    ❌ Reveal private keys (blocked)                                  │   │
│  │    ❌ Manage agent password settings (blocked)                       │   │
│  │    ❌ Change master password (blocked)                               │   │
│  │    ❌ Change Bankr API key & address (blocked)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Storage Schema** (in `chrome.storage.local`):

| Key | Description |
| --- | ----------- |
| `encryptedVaultKeyMaster` | Vault key encrypted with master password |
| `encryptedVaultKeyAgent` | Vault key encrypted with agent password (optional) |
| `encryptedApiKeyVault` | API key encrypted with vault key (current format) |
| `encryptedApiKey` | API key encrypted with password (legacy, kept for migration) |
| `agentPasswordEnabled` | Boolean flag for UI |

**Migration**: Existing users are automatically migrated to the vault key system on first unlock. The migration:
1. Generates a new 256-bit vault key
2. Encrypts vault key with master password
3. Re-encrypts API key with vault key into `encryptedApiKeyVault`
4. Legacy `encryptedApiKey` is kept but no longer read after migration

**API Key Saving**: When saving/updating API keys after wallet setup:
- If `cachedVaultKey` exists → encrypt with vault key → save to `encryptedApiKeyVault`
- If no vault key (legacy) → encrypt with password → save to `encryptedApiKey`
- This is handled automatically by `handleSaveApiKeyWithCachedPassword()` and `addBankrAccount` handler

**Security Invariants**:
1. Private key reveal is **always blocked** when unlocked with agent password
2. Agent password management requires master password
3. Master password change requires master password (agent cannot change it)
4. Bankr API key & address change requires master password
5. Both passwords use the same auto-lock timeout
6. No timing leak between password types (tries master first, then agent)
7. Changing master password does NOT invalidate agent password

#### Auto-Lock Timeout Configuration

Users can configure the auto-lock timeout via Settings → Auto-Lock:

| Option         | Value (ms) | Description                        |
| -------------- | ---------- | ---------------------------------- |
| 1 minute       | 60,000     | Quick lock for high security       |
| 5 minutes      | 300,000    | Short timeout                      |
| **15 minutes** | 900,000    | **Default**                        |
| 30 minutes     | 1,800,000  | Medium timeout                     |
| 1 hour         | 3,600,000  | Extended session                   |
| 4 hours        | 14,400,000 | Long session                       |
| Never          | 0          | Never auto-lock (manual lock only) |

**Implementation Details**:

- Setting stored in `chrome.storage.sync` with key `autoLockTimeout`
- Background worker caches the timeout value in memory for performance
- Storage change listener keeps cached value in sync across tabs
- When timeout is `0` ("Never"), cache validation always passes
- Changes take effect immediately (no restart required)
- **Validation**: `setAutoLockTimeout` validates against allowed values and returns `false` for invalid values

**Message Types**:

| Type                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `getAutoLockTimeout` | Get current timeout value                                |
| `setAutoLockTimeout` | Set new timeout value (validated against allowed values) |

#### Session Restoration (Auto-Lock "Never" Mode)

When auto-lock is set to "Never", the extension stores session data in `chrome.storage.session` to allow seamless credential recovery after service worker restarts. This prevents the annoying "Wallet is locked" prompts that would otherwise occur when Chrome suspends and restarts the service worker.

**Why This Is Needed**:

Chrome MV3 service workers are frequently suspended/restarted to save resources. When this happens:
1. All in-memory state is cleared (`cachedApiKey`, `cachedVault`, `cachedVaultKey`, etc.)
2. The `suspend` event clears cached credentials
3. Without session restoration, users would see unlock prompts even with auto-lock "Never"

**How It Works**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Session Restoration Architecture                         │
│                                                                             │
│  On Unlock (when auto-lock is "Never"):                                     │
│    1. Generate session ID: crypto.randomUUID()                              │
│    2. Encrypt password with random AES-256-GCM key                          │
│    3. Store in chrome.storage.session:                                      │
│       - sessionId: unique session identifier                                │
│       - sessionStartedAt: timestamp                                         │
│       - autoLockNever: true                                                 │
│       - encryptedSessionPassword: { data, key, iv }                         │
│                                                                             │
│  On Service Worker Restart (credentials lost):                              │
│    1. Handler checks: getCachedApiKey() === null                            │
│    2. If auto-lock is "Never" (timeout === 0):                              │
│       - Call tryRestoreSession()                                            │
│       - Read encryptedSessionPassword from session storage                  │
│       - Decrypt password                                                    │
│       - Call handleUnlockWallet(password) to restore credentials            │
│       - Re-store session password for future restarts                       │
│    3. Operation continues with restored credentials                         │
│                                                                             │
│  On Manual Lock:                                                            │
│    1. clearSessionStorage() is called                                       │
│    2. All session data is removed                                           │
│    3. Session cannot be restored until next unlock                          │
│                                                                             │
│  On Auto-Lock Setting Change:                                               │
│    - "Never" → timed: Clear session storage (no more restoration)           │
│    - Timed → "Never" (while unlocked): Store session for restoration        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Security Considerations**:

- Password is encrypted with a random key (not stored in plain text)
- `chrome.storage.session` is cleared when the browser closes
- Session storage is not synced across devices
- Session storage is only accessible to the background service worker
- Manual lock always clears session storage

**Handlers with Session Restoration**:

The following message handlers attempt session restoration when auto-lock is "Never" and credentials are not cached:

| Handler                          | Purpose                                        |
| -------------------------------- | ---------------------------------------------- |
| `isWalletUnlocked`               | Main lock state check (used by UI)             |
| `submitChatPrompt`               | Chat with Bankr AI                             |
| `getCachedApiKey`                | Display API key in settings                    |
| `saveApiKeyWithCachedPassword`   | Update API key while unlocked                  |
| `addPrivateKeyAccount`           | Add new private key account                    |
| `revealPrivateKey`               | Reveal private key (security-sensitive)        |

**Storage Schema** (in `chrome.storage.session`):

| Key                        | Type    | Description                           |
| -------------------------- | ------- | ------------------------------------- |
| `sessionId`                | string  | Unique session identifier             |
| `sessionStartedAt`         | number  | Timestamp when session started        |
| `autoLockNever`            | boolean | Whether auto-lock is "Never"          |
| `encryptedSessionPassword` | object  | Encrypted password { data, key, iv }  |

**Message Types**:

| Type                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `validateSession`    | Check if session is valid (returns { valid, sessionId }) |
| `tryRestoreSession`  | Attempt to restore session (returns boolean)             |

**UI Port Reconnection**:

The UI (App.tsx) maintains a keepalive port to the service worker. When the service worker restarts:

1. The port disconnects
2. `onDisconnect` listener detects this
3. After 100ms delay, `establishKeepalivePort()` reconnects
4. This ensures `activeUIConnections` tracking remains accurate

**See**: `src/App.tsx` → `establishKeepalivePort()` for the automatic reconnection implementation.

#### Password Caching for API Key Changes

When changing the API key while the wallet is unlocked:

- Uses the **cached password** to encrypt the new API key
- No need to re-enter password if session is active
- If cache expires, prompts for "Current Password" with message "Session expired"
- Existing API key is **pre-filled** in the form (decrypted from cache)

#### Password Change Flow

When changing the wallet password (Settings → Change Password):

- **No current password required**: User is already authenticated (wallet unlocked)
- **Must be unlocked with master password**: Agent password sessions cannot change the password
- **Session check**: Periodic check (every 30 seconds) ensures session hasn't expired
- **Auto-redirect**: If session expires while on the form, user is redirected to unlock screen
- **Cache cleared**: After password change, user must unlock with new password
- Password handling stays entirely in background worker (never exposed to UI)

**With Vault Key System** (current):
1. Decrypt vault key with cached (old) password to get raw bytes
2. Re-encrypt vault key with new password
3. Save updated `encryptedVaultKeyMaster`
4. API key and private keys stay encrypted with the vault key (unchanged)
5. **Agent password remains valid** - `encryptedVaultKeyAgent` is unchanged

**Legacy System** (pre-vault key migration):
1. Decrypt API key with old password
2. Re-encrypt API key with new password
3. Re-encrypt private key vault with new password

### Pending Transaction Storage

Transactions are stored persistently in `chrome.storage.local`:

- Closing popup does NOT reject/cancel pending transactions
- Pending requests survive popup close, browser restart
- Extension badge shows count of pending requests
- Transactions auto-expire after 30 minutes
- User can review and confirm/reject at any time

#### Pending Requests List

When multiple transactions are pending:

- Shows all pending requests with **request numbers** (#1, #2, etc.)
- Displays: origin favicon, hostname, chain badge, timestamp, target address
- Click any request to view full details
- **Reject All** button at the bottom to reject all pending transactions

## Popup Window Positioning

When a transaction request is received, the background worker automatically opens a popup window positioned at the top-right of the dapp's window.

**See**: `src/chrome/txHandlers.ts` → `openExtensionPopup()` for implementation.

**Multi-Monitor Support**:

- Uses `senderWindowId` from the message sender's tab to identify the correct window
- Falls back to `chrome.windows.getLastFocused()` if sender window not available
- Allows negative `left` coordinates for monitors positioned left of primary
- Popup appears on the same monitor as the dapp requesting the transaction

## Cancellation

Users can cancel in-progress transactions:

1. **Local Abort**: `AbortController` stops the polling loop
2. **API Cancel**: POST to `https://api.bankr.bot/agent/job/{jobId}/cancel`

## Response Handling

The Bankr API returns various response formats. Success is detected by:

1. **Transaction hash in response**: Regex `/0x[a-fA-F0-9]{64}/`
2. **Block explorer URL**: basescan.org, etherscan.io, polygonscan.com, etc.

Error is detected by keywords: "missing required", "error", "can't", "cannot", "unable", "invalid", "not supported"

## Build Configuration

The extension has 5 build targets:

| Target     | Config File               | Output                        |
| ---------- | ------------------------- | ----------------------------- |
| Popup      | vite.config.ts            | build/static/js/main.js       |
| Onboarding | vite.config.onboarding.ts | build/static/js/onboarding.js |
| Inpage     | vite.config.inpage.ts     | build/static/js/inpage.js     |
| Inject     | vite.config.inject.ts     | build/static/js/inject.js     |
| Background | vite.config.background.ts | build/static/js/background.js |

Build command: `pnpm build`

## Manifest Configuration

`public/manifest.json` key configurations:

```json
{
  "background": {
    "service_worker": "static/js/background.js",
    "type": "module"
  },
  "permissions": ["activeTab", "storage", "sidePanel", "notifications", "tabs"]
}
```

### Permissions

| Permission      | Purpose                                                |
| --------------- | ------------------------------------------------------ |
| `activeTab`     | Access to the currently active tab                     |
| `storage`       | Store encrypted API key, settings, transaction history |
| `sidePanel`     | Enable sidepanel mode (Chrome 114+)                    |
| `notifications` | Show transaction success/failure notifications         |
| `tabs`          | Query and close extension tabs (e.g., onboarding page) |

## Message Types

### Inpage → Content Script (postMessage)

| Type                    | Description          |
| ----------------------- | -------------------- |
| `i_sendTransaction`     | Transaction request  |
| `i_signatureRequest`    | Signature request    |
| `i_rpcRequest`          | RPC call request     |
| `i_switchEthereumChain` | Chain switch request |

### Content Script → Inpage (postMessage)

| Type                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `sendTransactionResult`    | Transaction result                                   |
| `signatureRequestResult`   | Signature result (rejection or signature for PK)     |
| `rpcResponse`              | RPC call response                                    |
| `switchEthereumChain`      | Chain switch success (chainId, rpcUrl)               |
| `switchEthereumChainError` | Chain switch error (unsupported chain)               |
| `setAddress`               | Account changed (address, displayAddress)            |
| `accountsChanged`          | Emitted when address changes (for dApp notification) |

### Content Script → Background (chrome.runtime)

| Type               | Description              |
| ------------------ | ------------------------ |
| `sendTransaction`  | Submit transaction       |
| `signatureRequest` | Submit signature request |
| `rpcRequest`       | Proxy RPC call           |

### Popup → Background (chrome.runtime)

| Type                               | Description                                             |
| ---------------------------------- | ------------------------------------------------------- |
| `getPendingTxRequests`             | Get all pending tx requests                             |
| `getPendingTransaction`            | Get specific tx details                                 |
| `isApiKeyCached`                   | Check if password needed                                |
| `unlockWallet`                     | Unlock wallet with password                             |
| `lockWallet`                       | Lock wallet (clear cached credentials)                  |
| `confirmTransaction`               | User approved tx (sync, waits)                          |
| `confirmTransactionAsync`          | User approved tx (async, returns immediately)           |
| `rejectTransaction`                | User rejected tx                                        |
| `getPendingSignatureRequests`      | Get all pending signature requests                      |
| `rejectSignatureRequest`           | User rejected signature request                         |
| `cancelTransaction`                | User cancelled in-progress tx                           |
| `clearApiKeyCache`                 | Clear cached API key                                    |
| `getCachedPassword`                | Check if password is cached                             |
| `getCachedApiKey`                  | Get decrypted API key (if cached)                       |
| `saveApiKeyWithCachedPassword`     | Save new API key using cached password                  |
| `changePasswordWithCachedPassword` | Change password using cached password                   |
| `isSidePanelSupported`             | Check if browser supports sidepanel                     |
| `getSidePanelMode`                 | Get current sidepanel mode setting                      |
| `setSidePanelMode`                 | Set sidepanel mode (true/false)                         |
| `setArcBrowser`                    | Mark browser as Arc (disables sidepanel)                |
| `getAutoLockTimeout`               | Get current auto-lock timeout (ms)                      |
| `setAutoLockTimeout`               | Set auto-lock timeout (ms)                              |
| `getTxHistory`                     | Get completed transaction history                       |
| `clearTxHistory`                   | Clear all transaction history                           |
| `getAccounts`                      | Get all accounts (metadata only)                        |
| `getActiveAccount`                 | Get currently active account                            |
| `setActiveAccount`                 | Set active account by ID (also updates storage address) |
| `addPrivateKeyAccount`             | Import new private key account                          |
| `removeAccount`                    | Remove account by ID                                    |
| `getTabAccount`                    | Get account for specific tab                            |
| `setTabAccount`                    | Set account for specific tab                            |
| `confirmSignatureRequest`          | Sign message (PK accounts only)                         |
| `revealPrivateKey`                 | Reveal private key (requires password verification)     |
| `updateAccountDisplayName`         | Update account display name                             |

### Background → Views (chrome.runtime broadcast)

| Type                         | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `txHistoryUpdated`           | Notifies views that transaction history changed |
| `newPendingTxRequest`        | Notifies views of new pending transaction       |
| `newPendingSignatureRequest` | Notifies views of new pending signature request |
| `accountsUpdated`            | Notifies views that accounts list changed       |
| `ping`                       | Check if any extension view is open             |

### Views → Background (response)

| Type   | Description                      |
| ------ | -------------------------------- |
| `pong` | Response indicating view is open |

## Sidepanel Support

The extension supports Chrome's Side Panel API for browsers that implement it (Chrome 114+). Some browsers like Arc have the `chrome.sidePanel` API but it doesn't function properly, so the extension uses a conservative approach to ensure compatibility.

### Browser Compatibility

| Browser | Sidepanel Support | Default Mode |
| ------- | ----------------- | ------------ |
| Chrome  | ✅ Full support   | Sidepanel    |
| Brave   | ✅ Full support   | Sidepanel    |
| Arc     | ❌ Broken API     | Popup        |
| Firefox | ❌ No API         | Popup        |

### Arc Browser Detection

Arc browser has `chrome.sidePanel` defined but it doesn't work properly. The extension detects Arc using a CSS variable that Arc injects:

```typescript
function isArcBrowser(): boolean {
  try {
    const arcPaletteTitle = getComputedStyle(
      document.documentElement,
    ).getPropertyValue("--arc-palette-title");
    return !!arcPaletteTitle && arcPaletteTitle.trim().length > 0;
  } catch {
    return false;
  }
}
```

This detection happens in:

- **Onboarding page**: Sets `isArcBrowser` flag in storage before user completes setup
- **App.tsx**: Checks on mount and updates storage if Arc is detected

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sidepanel Initialization Flow                            │
│                                                                             │
│  Background Service Worker Startup:                                         │
│    1. Check storage for isArcBrowser, sidePanelMode, sidePanelVerified      │
│    2. If Arc browser detected → ensure popup mode (openPanelOnActionClick   │
│       = false)                                                              │
│    3. If sidePanelVerified === false → ensure popup mode                    │
│    4. If sidePanelMode === true AND sidePanelVerified === true:             │
│       - Enable sidepanel (openPanelOnActionClick: true)                     │
│    5. Otherwise → default to popup mode (safe default)                      │
│                                                                             │
│  After Onboarding Completes (non-Arc browsers):                             │
│    1. Check if Arc was detected during onboarding                           │
│    2. If NOT Arc → send setSidePanelMode(true) to background                │
│    3. Background verifies sidepanel works and enables it                    │
│    4. sidePanelVerified set to true on success                              │
│                                                                             │
│  On App.tsx Mount (existing users):                                         │
│    1. If sidePanelMode is undefined (never set) and not Arc:                │
│       - Try to enable sidepanel mode                                        │
│       - This handles upgrades from older versions                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration

| Setting     | Storage Key         | Default                                 | Description                                 |
| ----------- | ------------------- | --------------------------------------- | ------------------------------------------- |
| Mode        | `sidePanelMode`     | `true` (after onboarding, if supported) | Whether to use sidepanel or popup           |
| Verified    | `sidePanelVerified` | Set on first successful enable          | Whether sidepanel has been tested and works |
| Arc Browser | `isArcBrowser`      | Detected via CSS variable               | Whether running in Arc browser              |

### UI Toggle

A sidepanel toggle button is available on both the **unlock screen** (top-right corner) and **main view header** (only visible when sidepanel is supported).

When toggling from popup to sidepanel mode:

- The setting is persisted in `chrome.storage.sync`
- The extension's action behavior is updated via `chrome.sidePanel.setPanelBehavior`
- A toast notification instructs user to close popup and click extension icon (Chrome doesn't allow programmatic sidepanel opening)

When toggling from sidepanel to popup mode:

- A popup window is opened
- The sidepanel closes automatically

### Transaction Requests

When a dapp requests a transaction, the extension uses a ping/pong mechanism to detect open views:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Transaction Request Flow                                │
│                                                                             │
│  1. Background receives eth_sendTransaction from dapp                       │
│  2. Stores pending tx in chrome.storage.local                               │
│  3. Broadcasts "newPendingTxRequest" message to all extension views         │
│  4. Sends "ping" message to check if any view is open                       │
│     - If view responds "pong": Don't open popup (broadcast updated it)      │
│     - If no response: Open popup window                                     │
│  5. Open view displays transaction confirmation UI                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

This ensures:

- If sidepanel is already open → it updates in-place, no popup opened
- If popup is already open → it updates in-place, no duplicate popup
- If nothing is open → a popup window is opened (can't programmatically open sidepanel)

### Message Types for Sidepanel

| Type                   | Direction          | Description                                     |
| ---------------------- | ------------------ | ----------------------------------------------- |
| `ping`                 | Background → Views | Check if any extension view is open             |
| `pong`                 | Views → Background | Response indicating view is open                |
| `newPendingTxRequest`  | Background → Views | Notify views of new pending transaction         |
| `openPopupWindow`      | Views → Background | Request to open a popup window                  |
| `setArcBrowser`        | Views → Background | Notify background that Arc browser was detected |
| `isSidePanelSupported` | Views → Background | Check if sidepanel is supported and verified    |
| `setSidePanelMode`     | Views → Background | Enable/disable sidepanel mode                   |

### Key Design Decisions

**Conservative Default**: The extension defaults to popup mode on startup and only enables sidepanel after verification. This ensures:

- Arc browser users always get a working popup
- New installs work immediately without sidepanel configuration issues
- Sidepanel is only enabled after explicit verification that it works

**Detection Timing**: Arc detection happens at multiple points:

1. **Onboarding page** (first install): Earliest possible detection, before user ever clicks extension icon
2. **App.tsx mount** (subsequent loads): Catches cases where onboarding was skipped or flags were cleared
3. **Storage persistence**: Once detected, the `isArcBrowser` flag persists across sessions

### CSS Handling

The extension detects if it's running in a sidepanel context by checking window dimensions:

- Sidepanel: height > 620px (browser provides more vertical space)
- Popup: height ≤ 600px (fixed popup dimensions)

When in sidepanel:

- `body.sidepanel-mode` class is added
- CSS adjusts to use full viewport height (100vh)

## UI Layout

### Popup Dimensions

- Window: 380px width, 540px height (created by background.ts)
- HTML: 360px width, 600px height (fixed for popup)
- Sidepanel: 100vh height (no max-height restriction)
- Font: Inter (UI), JetBrains Mono (code/addresses)

### Transaction/Signature Confirmation Header

The confirmation views use a two-row header layout:

```
┌─────────────────────────────────────────────────────────────┐
│  ←  │               < 1/2 >               │  Reject All │  ← Row 1
├─────────────────────────────────────────────────────────────┤
│                   Transaction Request                       │  ← Row 2
└─────────────────────────────────────────────────────────────┘
```

**Row 1:**

- **Back arrow** (left): Returns to pending list (if multiple) or main view
- **Navigation** (center, absolute): `< 1/2 >` arrows + counter badge
- **Reject All** (right): Rejects all pending requests (only shown when multiple)

**Row 2:**

- **Title** (centered): "Transaction Request" or "Signature Request" (larger font)

### Pending Requests List

The list shows both transaction and signature requests. Each request shows:

- Request number badge (#1, #2, etc.)
- Origin favicon with white background (handles transparent icons)
- Origin hostname
- Type badge: **TX** (blue) or **SIG** (orange/warning)
- Chain badge with icon
- Relative timestamp ("2 mins ago")
- For transactions: Target address (truncated)
- For signatures: Method name (e.g., "Personal Sign", "Typed Data")

### Origin Favicon Styling

Origin favicons are displayed with a white background container to handle transparent icons. Falls back to Google's favicon service if no favicon is available.

### Homepage Layout

The main view (after unlock) shows:

1. **Header**: Chat History button (Bankr accounts only), Lock button, Sidepanel toggle (if supported), Settings icon
2. **Account Switcher**: Dropdown to switch between accounts (if multiple)
3. **Wallet Address Section**:
   - "Bankr Wallet Address" label
   - Truncated address with copy button
   - Explorer link icon
4. **Chain Selector**: Dropdown to select network
5. **Pending Transaction Banner** (if any pending)
6. **Recent Transactions** (TxStatusList):
   - Shows last 5 transactions by default (filtered by current account)
   - Expandable to show all
   - Empty state: "No recent transactions"
7. **Footer**: "Chat with Bankr" button (Bankr accounts only)

**Note**: The Chat History button in the header and "Chat with Bankr" button in the footer are only visible when the currently selected account is a Bankr API account. Private Key accounts do not have access to the Bankr chat feature.

### Lock Wallet Button

The header includes a lock icon button that allows users to manually lock the wallet:

- Clears the cached API key and password from memory
- Redirects to the unlock screen
- Useful for security when stepping away from the computer

Sends `lockWallet` message to background and redirects to the unlock screen.

### Footer Attribution

All main screens display a centered footer with attribution:

- **Text**: "Built by @apoorveth"
- **X Logo**: SVG icon linking to https://x.com/apoorveth
- **Pages with footer**:
  - Homepage (main view)
  - Unlock/Password screen
  - Onboarding (welcome, form steps, success)
  - Settings page

## Security Considerations

1. **API Key Protection**: Encrypted with AES-256-GCM, password never stored
2. **Chain Restriction**: Only 4 supported chains, validated at multiple layers
3. **User Confirmation**: Every transaction requires explicit user approval
4. **Origin Display**: Shows requesting dapp's origin in confirmation popup
5. **Cancellation**: Users can cancel long-running transactions

## Error Handling

| Error                       | Handling                         |
| --------------------------- | -------------------------------- |
| Unsupported chain           | Immediate rejection with message |
| API key not configured      | Redirect to settings             |
| Wrong password              | Retry prompt in popup            |
| API error                   | Display error message            |
| Transaction timeout (5 min) | Auto-fail with timeout message   |
| Network error               | Display error, allow retry       |

## React State Management

### Transaction Component Keys

The `TransactionConfirmation` component uses `key={selectedTxRequest.id}` to force React to remount when switching between transactions. This ensures:

- All closures capture fresh values
- No stale state when confirming/rejecting
- Correct transaction ID sent to background

### Avoiding Stale State

When handling transaction completion, always capture the current transaction ID before async operations and reload pending requests fresh from storage rather than using React state. This prevents the common bug where async operations use stale closure values.
