# BankrWallet Transaction Handling Implementation

## Overview

BankrWallet is a Chrome extension that allows users to impersonate blockchain accounts and execute transactions through the Bankr API. This document describes the transaction handling implementation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  Dapp                                        │
│                         (e.g., app.aave.com)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ eth_sendTransaction / RPC calls
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Inpage Script (inpage.js)                           │
│                         ImpersonatorProvider class                          │
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
│                     - Opens confirmation popup                              │
│                     - Makes Bankr API calls                                 │
│                     - Proxies RPC calls (bypasses page CSP)                 │
│                     - Manages encrypted API key                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│    Confirmation Popup        │    │       Bankr API              │
│    (confirmation.html)       │    │  api.bankr.bot               │
│    - Shows tx details        │    │  - POST /agent/prompt        │
│    - Password input          │    │  - GET /agent/job/{id}       │
│    - Approve/Reject/Cancel   │    │  - POST /agent/job/{id}/cancel│
└──────────────────────────────┘    └──────────────────────────────┘
```

## Supported Chains

Only the following chains are supported for transaction signing:

| Chain    | Chain ID | Default RPC                  |
| -------- | -------- | ---------------------------- |
| Ethereum | 1        | https://eth.llamarpc.com     |
| Polygon  | 137      | https://polygon-rpc.com      |
| Base     | 8453     | https://mainnet.base.org     |
| Unichain | 130      | https://mainnet.unichain.org |

These are configured in `src/constants/networks.ts` and pre-populated on first install.

## File Structure

```
src/
├── chrome/
│   ├── impersonator.ts    # Inpage script - fake window.ethereum provider
│   ├── inject.ts          # Content script - message bridge
│   ├── background.ts      # Service worker - API calls, tx handling
│   ├── crypto.ts          # AES-256-GCM encryption for API key
│   └── bankrApi.ts        # Bankr API client
├── constants/
│   └── networks.ts        # Default networks configuration
├── pages/
│   ├── Confirmation.tsx   # Transaction confirmation popup UI
│   └── ApiKeySetup.tsx    # API key configuration UI
├── components/
│   └── Settings/
│       └── index.tsx      # Settings with API key management
└── confirmation.tsx       # Confirmation popup entry point
```

## Transaction Flow

### 1. Dapp Initiates Transaction

```javascript
// Dapp calls
await window.ethereum.request({
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

### 2. Impersonator Validates & Forwards

`src/chrome/impersonator.ts`:

- Validates chain ID is in allowed list (1, 137, 8453, 130)
- Creates unique transaction ID
- Posts message to content script
- Returns Promise that resolves when tx completes

### 3. Content Script Bridges to Background

`src/chrome/inject.ts`:

- Receives `i_sendTransaction` message
- Forwards to background via `chrome.runtime.sendMessage`
- Sends result back to inpage via `postMessage`

### 4. Background Opens Confirmation Popup

`src/chrome/background.ts`:

- Validates chain ID again (double-check)
- Checks if API key is configured
- Creates pending transaction entry
- Opens confirmation popup window (400x600)

### 5. User Confirms Transaction

`src/pages/Confirmation.tsx`:

- Displays: origin, network, from, to, value, data
- If API key not cached: prompts for password
- User clicks Confirm or Reject

### 6. Background Submits to Bankr API

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

### 7. Result Returned to Dapp

- Transaction hash extracted via regex: `/0x[a-fA-F0-9]{64}/`
- Returned through the message chain back to dapp
- Dapp receives the tx hash from `eth_sendTransaction`

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

### Session Caching

To avoid asking for password on every transaction:

- Decrypted API key is cached in background worker memory
- Cache expires after 15 minutes
- Cache cleared on browser close or extension suspend
- First transaction after timeout requires password

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

| Target       | Config File                 | Output                        |
| ------------ | --------------------------- | ----------------------------- |
| Popup        | vite.config.ts              | build/static/js/main.js       |
| Inpage       | vite.config.inpage.ts       | build/static/js/inpage.js     |
| Inject       | vite.config.inject.ts       | build/static/js/inject.js     |
| Background   | vite.config.background.ts   | build/static/js/background.js |
| Confirmation | vite.config.confirmation.ts | build/confirmation.html       |

Build command: `pnpm build`

## Manifest Configuration

`public/manifest.json` key additions:

```json
{
  "background": {
    "service_worker": "static/js/background.js",
    "type": "module"
  }
}
```

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

### Popup/Confirmation → Background (chrome.runtime)

| Type                    | Description                   |
| ----------------------- | ----------------------------- |
| `getPendingTransaction` | Get tx details for popup      |
| `isApiKeyCached`        | Check if password needed      |
| `confirmTransaction`    | User approved tx              |
| `rejectTransaction`     | User rejected tx              |
| `cancelTransaction`     | User cancelled in-progress tx |
| `clearApiKeyCache`      | Clear cached API key          |

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
