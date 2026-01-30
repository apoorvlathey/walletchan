# BankrWallet Transaction Handling Implementation

## Overview

BankrWallet is a Chrome extension that allows users to impersonate blockchain accounts and execute transactions through the Bankr API. This document describes the transaction handling implementation.

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
│                     - Handles transaction requests                          │
│                     - Stores pending txs in chrome.storage.local            │
│                     - Updates extension badge with pending count            │
│                     - Makes Bankr API calls                                 │
│                     - Proxies RPC calls (bypasses page CSP)                 │
│                     - Manages encrypted API key cache                       │
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
| rdns     | "bot.bankr.wallet"                         |

### Implementation Details

`src/chrome/impersonator.ts`:

```typescript
// EIP-6963 provider info
const providerInfo: EIP6963ProviderInfo = {
  uuid: crypto.randomUUID(),
  name: "Bankr Wallet",
  icon: "data:image/png;base64,...",
  rdns: "bot.bankr.wallet",
};

// Announce provider to dapps
function announceProvider() {
  const detail = Object.freeze({
    info: Object.freeze({ ...providerInfo }),
    provider: providerInstance,
  });

  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", { detail })
  );
}

// Listen for dapp requests
window.addEventListener("eip6963:requestProvider", announceProvider);
```

### Backward Compatibility

The wallet maintains backward compatibility by:

1. Setting `window.ethereum` for legacy dapps
2. Announcing via EIP-6963 for modern dapps

Dapps that support EIP-6963 will show Bankr Wallet in their wallet selection UI. Legacy dapps will still work via `window.ethereum`.

## File Structure

```
src/
├── chrome/
│   ├── impersonator.ts      # Inpage script - EIP-6963 provider + window.ethereum
│   ├── inject.ts            # Content script - message bridge
│   ├── background.ts        # Service worker - API calls, tx handling, notifications
│   ├── crypto.ts            # AES-256-GCM encryption for API key
│   ├── bankrApi.ts          # Bankr API client
│   ├── pendingTxStorage.ts  # Persistent storage for pending transactions
│   └── txHistoryStorage.ts  # Persistent storage for completed transaction history
├── constants/
│   ├── networks.ts          # Default networks configuration
│   └── chainConfig.ts       # Chain-specific styling/icons
├── pages/
│   ├── Onboarding.tsx       # Full-page onboarding wizard for first-time setup
│   └── ApiKeySetup.tsx      # API key + wallet address configuration
├── components/
│   ├── Settings/
│   │   ├── index.tsx        # Main settings page (includes clear history)
│   │   ├── Chains.tsx       # Chain RPC management
│   │   ├── AddChain.tsx     # Add new chain
│   │   ├── EditChain.tsx    # Edit existing chain
│   │   └── ChangePassword.tsx # Password change flow
│   ├── UnlockScreen.tsx     # Wallet unlock (password entry)
│   ├── PendingTxBanner.tsx  # Banner showing pending tx count
│   ├── PendingTxList.tsx    # List of pending transactions
│   ├── TxStatusList.tsx     # Recent transaction history display
│   └── TransactionConfirmation.tsx # In-popup tx confirmation with success animation
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

```
┌─────────────────────────────────────────────────────────────┐
│  Step 0: Welcome Screen                                      │
│  - Bankr logo + branding                                     │
│  - "Welcome to Bankr Wallet" heading                         │
│  - "Get Started" button                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: API Key (● ○ ○)                                     │
│  - API key input field                                       │
│  - Link: "Don't have an API key? Get one from bankr.bot"     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Wallet Address (● ● ○)                              │
│  - Address input (supports ENS resolution)                   │
│  - Link: "Find your wallet address at bankr.bot/terminal"    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Create Password (● ● ●)                             │
│  - Password + Confirm password fields (min 6 chars)          │
│  - Security warning about password recovery                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Success                                             │
│  - Animated green checkmark                                  │
│  - "You're all set!" message                                 │
│  - Floating arrow pointing to extension area                 │
│  - Extension icon + "BankrWallet" badge                      │
│  - "Pin & click the extension" instruction                   │
└─────────────────────────────────────────────────────────────┘
```

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

| Target     | Config File               | Output                          |
| ---------- | ------------------------- | ------------------------------- |
| Onboarding | vite.config.onboarding.ts | build/static/js/onboarding.js   |

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
      to: "0x...",
      data: "0x...",
      value: "0x0",
    },
  ],
});
```

### 3. Impersonator Validates & Forwards

`src/chrome/impersonator.ts`:

- Validates chain ID is in allowed list (1, 137, 8453, 130)
- Creates unique transaction ID
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
  `https://eth.sh/api/labels/${tx.to}?chainId=${tx.chainId}`
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

| Event | Title | Message |
| ----- | ----- | ------- |
| Transaction Confirmed | "Transaction Confirmed" | "Your transaction on {chainName} was successful" |
| Transaction Failed | "Transaction Failed" | "Error: {errorMessage}" |

### Implementation

```typescript
async function showNotification(
  notificationId: string,
  title: string,
  message: string
): Promise<string> {
  return new Promise((resolve) => {
    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title,
        message,
        priority: 2,
      },
      (createdId) => {
        if (chrome.runtime.lastError) {
          console.error("Notification error:", chrome.runtime.lastError);
        }
        resolve(createdId || notificationId);
      }
    );
  });
}
```

### macOS Permissions Note

On macOS, Chrome notifications require explicit permission in System Preferences:
- **System Preferences → Notifications → Google Chrome → Allow Notifications**

Without this permission, `chrome.notifications.create()` will execute without error but no notification will appear.

### Manifest Permission

```json
{
  "permissions": [
    "notifications"
  ]
}
```

## Transaction History

Completed transactions (confirmed or failed) are stored persistently and displayed on the homepage.

### Data Model

`src/chrome/txHistoryStorage.ts`:

```typescript
export type TxStatus = "processing" | "success" | "failed";

export interface CompletedTransaction {
  id: string;
  status: TxStatus;
  tx: TransactionParams;
  origin: string;
  favicon: string | null;
  chainName: string;
  chainId: number;
  createdAt: number;
  completedAt?: number;
  txHash?: string;
  error?: string;
}
```

### Storage Functions

| Function | Description |
| -------- | ----------- |
| `getTxHistory()` | Get all history (newest first, max 50) |
| `addTxToHistory(tx)` | Add new entry with "processing" status |
| `updateTxInHistory(txId, updates)` | Update status, txHash, error, completedAt |
| `clearTxHistory()` | Remove all history entries |

### Storage Details

- **Key**: `txHistory` in `chrome.storage.local`
- **Max entries**: 50 (oldest entries removed when limit exceeded)
- **Sort order**: Newest first (by `createdAt`)

### UI Component

`src/components/TxStatusList.tsx` displays the transaction history:

- **Default view**: 5 most recent transactions
- **Expandable**: Show/hide older transactions
- **Empty state**: "No recent transactions" message

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

## API Key Encryption

The Bankr API key is encrypted using AES-256-GCM with PBKDF2 key derivation.

`src/chrome/crypto.ts`:

```
User Password
      │
      ▼
PBKDF2 (100,000 iterations, random salt)
      │
      ▼
AES-256-GCM Key
      │
      ▼
Encrypt API Key (random IV)
      │
      ▼
Store in chrome.storage.local:
{
  encryptedApiKey: {
    ciphertext: "base64...",
    iv: "base64...",
    salt: "base64..."
  }
}
```

### Session Caching (Wallet Lock/Unlock)

MetaMask-style wallet lock flow:

- Decrypted API key **and password** are cached in background worker memory
- Cache expires after 15 minutes (wallet "locks")
- Cache cleared on browser close or extension suspend
- When locked, user must enter password before:
  - Viewing the main wallet interface
  - Confirming any pending transactions
- Unlock persists across popup open/close cycles (until cache expires)

#### Password Caching for API Key Changes

When changing the API key while the wallet is unlocked:

- Uses the **cached password** to encrypt the new API key
- No need to re-enter password if session is active
- If cache expires, prompts for "Current Password" with message "Session expired"
- Existing API key is **pre-filled** in the form (decrypted from cache)

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

When a transaction request is received, the background worker automatically opens a popup window:

```typescript
async function openExtensionPopup(senderWindowId?: number): Promise<void> {
  // Get the window where the dapp is running
  let targetWindow = await chrome.windows.get(senderWindowId);

  // Position at top-right of target window
  const left = targetWindow.left + targetWindow.width - popupWidth - 10;
  const top = targetWindow.top + 80;

  await chrome.windows.create({
    url: popupUrl,
    type: "popup",
    width: 380,
    height: 540,
    left,
    top,
    focused: true,
  });
}
```

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

| Target     | Config File               | Output                          |
| ---------- | ------------------------- | ------------------------------- |
| Popup      | vite.config.ts            | build/static/js/main.js         |
| Onboarding | vite.config.onboarding.ts | build/static/js/onboarding.js   |
| Inpage     | vite.config.inpage.ts     | build/static/js/inpage.js       |
| Inject     | vite.config.inject.ts     | build/static/js/inject.js       |
| Background | vite.config.background.ts | build/static/js/background.js   |

Build command: `pnpm build`

## Manifest Configuration

`public/manifest.json` key configurations:

```json
{
  "background": {
    "service_worker": "static/js/background.js",
    "type": "module"
  },
  "permissions": [
    "activeTab",
    "storage",
    "sidePanel",
    "notifications",
    "tabs"
  ]
}
```

### Permissions

| Permission    | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| `activeTab`   | Access to the currently active tab                     |
| `storage`     | Store encrypted API key, settings, transaction history |
| `sidePanel`   | Enable sidepanel mode (Chrome 114+)                    |
| `notifications` | Show transaction success/failure notifications       |
| `tabs`        | Query and close extension tabs (e.g., onboarding page) |

## Message Types

### Inpage → Content Script (postMessage)

| Type                    | Description          |
| ----------------------- | -------------------- |
| `i_sendTransaction`     | Transaction request  |
| `i_rpcRequest`          | RPC call request     |
| `i_switchEthereumChain` | Chain switch request |

### Content Script → Inpage (postMessage)

| Type                    | Description           |
| ----------------------- | --------------------- |
| `sendTransactionResult` | Transaction result    |
| `rpcResponse`           | RPC call response     |
| `switchEthereumChain`   | Chain switch response |

### Content Script → Background (chrome.runtime)

| Type              | Description        |
| ----------------- | ------------------ |
| `sendTransaction` | Submit transaction |
| `rpcRequest`      | Proxy RPC call     |

### Popup → Background (chrome.runtime)

| Type                          | Description                           |
| ----------------------------- | ------------------------------------- |
| `getPendingTxRequests`        | Get all pending tx requests           |
| `getPendingTransaction`       | Get specific tx details               |
| `isApiKeyCached`              | Check if password needed              |
| `unlockWallet`                | Unlock wallet with password           |
| `confirmTransaction`          | User approved tx (sync, waits)        |
| `confirmTransactionAsync`     | User approved tx (async, returns immediately) |
| `rejectTransaction`           | User rejected tx                      |
| `cancelTransaction`           | User cancelled in-progress tx         |
| `clearApiKeyCache`            | Clear cached API key                  |
| `getCachedPassword`           | Check if password is cached           |
| `getCachedApiKey`             | Get decrypted API key (if cached)     |
| `saveApiKeyWithCachedPassword`| Save new API key using cached password|
| `isSidePanelSupported`        | Check if browser supports sidepanel   |
| `getSidePanelMode`            | Get current sidepanel mode setting    |
| `setSidePanelMode`            | Set sidepanel mode (true/false)       |
| `getTxHistory`                | Get completed transaction history     |
| `clearTxHistory`              | Clear all transaction history         |

### Background → Views (chrome.runtime broadcast)

| Type                 | Description                                    |
| -------------------- | ---------------------------------------------- |
| `txHistoryUpdated`   | Notifies views that transaction history changed |
| `newPendingTxRequest`| Notifies views of new pending transaction      |
| `ping`               | Check if any extension view is open            |

### Views → Background (response)

| Type   | Description                              |
| ------ | ---------------------------------------- |
| `pong` | Response indicating view is open         |

## Sidepanel Support

The extension supports Chrome's Side Panel API for browsers that implement it (Chrome 114+). Browsers like Arc that don't support the Side Panel API will fallback to popup mode.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Sidepanel Detection Flow                            │
│                                                                             │
│  On Extension Load:                                                         │
│    1. Check if chrome.sidePanel API exists                                  │
│    2. Load sidePanelMode from chrome.storage.sync                           │
│    3. If supported and mode enabled:                                        │
│       - Set openPanelOnActionClick: true                                    │
│       - Clicking extension icon opens sidepanel                             │
│    4. If not supported or mode disabled:                                    │
│       - Use default popup behavior                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration

| Setting | Storage Key | Default | Description |
| ------- | ----------- | ------- | ----------- |
| Mode    | `sidePanelMode` | `true` (if supported) | Whether to use sidepanel or popup |

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

| Type | Direction | Description |
| ---- | --------- | ----------- |
| `ping` | Background → Views | Check if any extension view is open |
| `pong` | Views → Background | Response indicating view is open |
| `newPendingTxRequest` | Background → Views | Notify views of new pending transaction |
| `openPopupWindow` | Views → Background | Request to open a popup window |

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
- Body: 100% width, min-width 360px, max-height 600px
- Sidepanel: 100vh height (no max-height restriction)
- Font: Inter (UI), JetBrains Mono (code/addresses)

### Transaction Confirmation Header

```
┌─────────────────────────────────────────────────────────────┐
│  ←  │           Tx Request  < 2/2 >           │  Reject All │
└─────────────────────────────────────────────────────────────┘
     Left              Center (absolute)              Right
```

- **Back arrow**: Returns to pending list (if multiple) or main view
- **Center**: Title + navigation arrows + counter badge (when multiple txs)
- **Reject All**: Rejects all pending transactions (only shown when multiple)

### Pending Requests List

Each request shows:
- Request number badge (#1, #2, etc.)
- Origin favicon with white background (handles transparent icons)
- Origin hostname
- Chain badge with icon
- Relative timestamp ("2 mins ago")
- Target address (truncated)

### Origin Favicon Styling

Origin favicons are displayed with a white background to handle transparent icons:

```tsx
<Box
  bg="white"
  p="2px"
  borderRadius="md"
  display="flex"
  alignItems="center"
  justifyContent="center"
>
  <Image
    src={favicon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
    boxSize="16px"
    borderRadius="sm"
  />
</Box>
```

### Homepage Layout

The main view (after unlock) shows:

1. **Header**: Lock button, Settings icon, Sidepanel toggle (if supported)
2. **Wallet Address Section**:
   - "Bankr Wallet Address" label
   - Truncated address with copy button
   - Network chain badges
3. **Pending Transaction Banner** (if any pending)
4. **Recent Transactions** (TxStatusList):
   - Shows last 5 transactions by default
   - Expandable to show all
   - Empty state: "No recent transactions"

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

When handling transaction completion:

```typescript
const handleTxRejected = async () => {
  const currentTxId = selectedTxRequest?.id;  // Capture before async
  const requests = await loadPendingRequests(); // Returns fresh data

  // Use fresh data, not stale pendingRequests state
  const remaining = requests.filter((r) => r.id !== currentTxId);
  // ...
};
```

This pattern prevents the common React bug where async operations use stale closure values.
