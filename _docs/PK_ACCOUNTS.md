# Private Key Accounts Implementation

## Overview

This document describes the implementation of private key (PK) accounts alongside the existing Bankr API wallet support. Users can now choose to use either account type or both, with the extension handling transaction signing locally for PK accounts.

## Security Architecture

**CRITICAL: Security is the top priority.** Private keys are extremely sensitive and must never be exposed or leaked.

### Encryption Standards

The extension uses the same robust encryption as existing API key storage:

| Property       | Value               |
| -------------- | ------------------- |
| Algorithm      | AES-256-GCM         |
| Key Derivation | PBKDF2-SHA256       |
| Iterations     | 600,000             |
| Salt Length    | 16 bytes (128 bits) |
| IV Length      | 12 bytes (96 bits)  |

This matches industry standards and NIST recommendations for password-based encryption.

### Key Storage Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Private Key Security Model                          │
│                                                                             │
│  Layer 1: At-Rest Encryption                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  chrome.storage.local                                                │   │
│  │  └── encryptedVault: {                                               │   │
│  │        ciphertext: "base64...",  // AES-256-GCM encrypted            │   │
│  │        iv: "base64...",          // Random IV (12 bytes)             │   │
│  │        salt: "base64..."         // Random salt (16 bytes)           │   │
│  │      }                                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Layer 2: Memory Isolation                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Service Worker (background.ts) - ONLY location with decrypted keys  │   │
│  │  └── cachedVault: {                                                  │   │
│  │        accounts: [{address, encryptedPK}],  // Decrypted on demand   │   │
│  │        timestamp: number                     // Auto-lock timeout    │   │
│  │      }                                                               │   │
│  │  Content scripts / Inpage: NO access to keys                         │   │
│  │  Popup/Sidepanel UI: NO access to keys                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Layer 3: Access Control                                                    │
│  - Keys decrypted only when signing is required                            │
│  - Auto-lock clears decrypted keys from memory                             │
│  - Service worker suspension clears all sensitive data                     │
│  - Only signed results returned to content scripts (never raw keys)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Guarantees

1. **Private keys are NEVER exposed to:**
   - Content scripts (inject.ts)
   - Inpage scripts (impersonator.ts)
   - Popup/Sidepanel UI components
   - Any web page or dApp
   - Browser console or devtools (in release builds)

2. **Private keys are ONLY decrypted:**
   - In the service worker (background.ts)
   - When explicitly signing a transaction or message
   - After user confirms the action in the popup

3. **Memory Protection:**
   - Auto-lock timeout clears decrypted vault from memory
   - Service worker suspension event clears all sensitive data
   - Extension reset performs full security wipe

## Account Settings & Management

### Account Settings Modal

Each account has a settings gear icon in the account switcher dropdown. Clicking it opens a modal with:

1. **Display Name**: Editable field to set a friendly name for the account
2. **Reveal Private Key** (PK accounts only): Password-protected key reveal
3. **Remove Account**: Delete account with confirmation warning

### Reveal Private Key Feature

For Private Key accounts, users can reveal their private key through a secure, password-protected flow.

**Security Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Reveal Private Key Flow                               │
│                                                                             │
│  1. User clicks settings gear icon next to account in dropdown              │
│  2. AccountSettingsModal opens                                              │
│  3. User clicks "Reveal Private Key" button (yellow, PK accounts only)      │
│  4. RevealPrivateKeyModal opens                                             │
│  5. Modal checks session password type (master vs agent)                    │
│  6. IF AGENT SESSION: Show blocked message with instructions                │
│  7. IF MASTER SESSION: Show password entry form                             │
│  8. User enters password → sent to background.ts                            │
│  9. Background verifies password AND password type                          │
│  10. If valid: decrypt vault, return private key to modal                   │
│  11. Modal displays key (masked by default, with show/hide toggle)          │
│  12. User can copy key to clipboard                                         │
│  13. On modal close: private key cleared from component state               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Message Type:**

| Type               | Direction       | Payload                   | Response                                                                           |
| ------------------ | --------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `revealPrivateKey` | UI → Background | `{ accountId, password }` | `{ success, privateKey? }` or `{ success: false, error, requiresMasterPassword? }` |

**Security Guarantees:**

1. **Password Required**: User must re-enter password each time (no auto-reveal)
2. **Session Verification**: Password is verified against the cached session password
3. **Memory Cleanup**: Private key is cleared from React state when modal closes
4. **No Persistence**: Revealed key is never stored - only held in component state briefly
5. **Vault Decryption**: If vault not cached, full decryption is performed with the password
6. **Agent Password Blocked**: If unlocked with agent password, reveal is blocked regardless of password entry

### Agent Password Restriction

When the wallet is unlocked with an **agent password** (see IMPLEMENTATION.md for Agent Password details), private key reveal is **always blocked**. This is a core security feature that allows AI agents to use the wallet for transactions while protecting the underlying private keys.

**Why This Restriction Exists:**

- Agent passwords are designed for AI agents to operate wallets
- Agents should be able to sign transactions but never export keys
- Master password is required for sensitive operations like key reveal

**UI Behavior When Unlocked with Agent Password:**

```
┌─────────────────────────────────────────────────────────────────┐
│  [Warning icon]  REVEAL PRIVATE KEY                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔒 You are unlocked with an agent password.              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Private key reveal is only available when unlocked with        │
│  your **master password**.                                       │
│                                                                  │
│  To reveal the private key:                                      │
│  │ 1. Lock your wallet                                          │
│  │ 2. Unlock with your master password                          │
│  │ 3. Try revealing the key again                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │                    [Close]                          │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

**UI Behavior When Agent Password is Enabled (Master Session):**

When agent password is configured but the user is unlocked with master password, the reveal modal shows "Master Password" in the prompt to clarify which password is needed:

```
Enter your **Master** password to reveal the private key for [Account Name]
```

**UI States:**

```
State 1: Password Entry
┌─────────────────────────────────────────────────────────────────┐
│  [Warning icon]  REVEAL PRIVATE KEY                              │
│                                                                  │
│  ⚠️ Never share your private key. Anyone with it has full       │
│     control of your wallet.                                      │
│                                                                  │
│  Password                                                        │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  [••••••••••••]                              [👁]      │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                  │
│  [Error message if wrong password]                               │
│                                                                  │
│  ┌────────────────┐  ┌────────────────────────┐                 │
│  │    Cancel      │  │  Reveal  (yellow)      │                 │
│  └────────────────┘  └────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘

State 2: Key Revealed
┌─────────────────────────────────────────────────────────────────┐
│  [Key icon]  YOUR PRIVATE KEY                                    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  0x1234...abcd (or full key if show toggle on)  [👁]  │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │              [📋 Copy to Clipboard]                 │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │                    [Done]                           │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Remove Account

Users can remove accounts from the wallet:

1. **Confirmation Required**: A confirmation dialog warns about the action
2. **PK Warning**: For Private Key accounts, an additional warning emphasizes backing up the key first
3. **Data Cleanup**: Removes account from accounts list and private key from vault

**Message Type:**

| Type            | Direction       | Payload         | Response                                     |
| --------------- | --------------- | --------------- | -------------------------------------------- |
| `removeAccount` | UI → Background | `{ accountId }` | `{ success }` or `{ success: false, error }` |

### Update Display Name

Users can set or change the display name for any account:

**Message Type:**

| Type                       | Direction       | Payload                      | Response                                     |
| -------------------------- | --------------- | ---------------------------- | -------------------------------------------- |
| `updateAccountDisplayName` | UI → Background | `{ accountId, displayName }` | `{ success }` or `{ success: false, error }` |

## Account Types

### Bankr API Account (Existing)

- Transactions submitted to Bankr API for execution
- No local key storage
- API key encrypted with user password
- Signatures NOT supported (Bankr API limitation)

### Private Key Account (New)

- Transactions signed locally using viem
- Private key encrypted with user password
- Full signature support (personal_sign, signTypedData, etc.)
- Requires broadcasting via RPC

## Data Model

### Account Structure

```typescript
// src/chrome/types.ts

export type AccountType = "bankr" | "privateKey";

export interface BaseAccount {
  id: string; // UUID
  type: AccountType;
  address: string; // Ethereum address (0x...)
  displayName?: string; // Optional user-friendly name
  createdAt: number; // Timestamp
}

export interface BankrAccount extends BaseAccount {
  type: "bankr";
  // API key stored separately in encryptedApiKey
}

export interface PrivateKeyAccount extends BaseAccount {
  type: "privateKey";
  // Private key stored in encryptedVault
}

export type Account = BankrAccount | PrivateKeyAccount;

// Encrypted vault for private keys
export interface EncryptedVault {
  ciphertext: string; // base64 encoded
  iv: string; // base64 encoded
  salt: string; // base64 encoded
}

// Decrypted vault structure (only in memory)
export interface DecryptedVault {
  accounts: {
    id: string;
    privateKey: string; // 0x-prefixed hex string
  }[];
}
```

### Storage Schema

```typescript
// chrome.storage.local
{
  // Existing
  encryptedApiKey: EncryptedData,
  pendingTxRequests: PendingTxRequest[],
  pendingSignatureRequests: PendingSignatureRequest[],
  txHistory: CompletedTransaction[],

  // New
  encryptedVault: EncryptedVault,  // Encrypted private keys
  accounts: Account[],             // Account metadata (no sensitive data)
}

// chrome.storage.sync
{
  // Existing
  address: string,           // Current active address
  displayAddress: string,    // Display name for current address
  chainName: string,

  // New
  activeAccountId: string,   // Currently selected account ID
  tabAccounts: {             // Per-tab account selection
    [tabId: string]: string  // tabId -> accountId
  }
}
```

## Cryptographic Operations

### Library Choice: ox.sh + viem

We use a layered approach:

- **ox.sh** (`ox` package): Low-level cryptographic operations (keystore encryption/decryption)
- **viem**: High-level operations (transaction signing, message signing, RPC calls)

viem is built on top of ox, so they work seamlessly together.

### Vault Encryption/Decryption with ox Keystore

```typescript
// src/chrome/vaultCrypto.ts

import { Keystore } from "ox";
import { privateKeyToAddress } from "viem/accounts";

export interface VaultEntry {
  id: string;
  keystore: Keystore.Keystore; // Encrypted keystore JSON
}

export interface DecryptedEntry {
  id: string;
  privateKey: `0x${string}`;
}

/**
 * Encrypts a private key using ox Keystore (standard JSON keystore format)
 * Uses scrypt KDF for strong password-based encryption
 */
export async function encryptPrivateKey(
  privateKey: `0x${string}`,
  password: string,
): Promise<Keystore.Keystore> {
  return Keystore.encrypt(privateKey, password, {
    kdf: "scrypt",
    scrypt: {
      n: 262144, // CPU/memory cost parameter
      r: 8, // Block size
      p: 1, // Parallelization
    },
  });
}

/**
 * Decrypts a keystore to retrieve the private key
 * CRITICAL: Only call from service worker
 */
export async function decryptPrivateKey(
  keystore: Keystore.Keystore,
  password: string,
): Promise<`0x${string}`> {
  return Keystore.decrypt(keystore, password);
}

/**
 * Saves encrypted vault to storage
 */
export async function saveVault(entries: VaultEntry[]): Promise<void> {
  await chrome.storage.local.set({ encryptedVault: entries });
}

/**
 * Loads encrypted vault from storage
 */
export async function loadVault(): Promise<VaultEntry[]> {
  const { encryptedVault } = await chrome.storage.local.get("encryptedVault");
  return encryptedVault || [];
}

/**
 * Adds a new private key to the vault
 */
export async function addKeyToVault(
  password: string,
  privateKey: `0x${string}`,
  accountId: string,
): Promise<void> {
  const entries = await loadVault();

  // Check for duplicate addresses
  const newAddress = privateKeyToAddress(privateKey);
  for (const entry of entries) {
    const existingKey = await decryptPrivateKey(entry.keystore, password);
    if (privateKeyToAddress(existingKey) === newAddress) {
      throw new Error("This private key is already imported");
    }
  }

  // Encrypt and add
  const keystore = await encryptPrivateKey(privateKey, password);
  entries.push({ id: accountId, keystore });
  await saveVault(entries);
}

/**
 * Removes a private key from the vault
 */
export async function removeKeyFromVault(accountId: string): Promise<void> {
  const entries = await loadVault();
  const filtered = entries.filter((e) => e.id !== accountId);
  await saveVault(filtered);
}

/**
 * Gets decrypted private key for an account
 * CRITICAL: Only call from service worker when signing
 */
export async function getPrivateKey(
  accountId: string,
  password: string,
): Promise<`0x${string}` | null> {
  const entries = await loadVault();
  const entry = entries.find((e) => e.id === accountId);
  if (!entry) return null;
  return decryptPrivateKey(entry.keystore, password);
}
```

## Transaction Signing with Viem

### Setup

```typescript
// src/chrome/localSigner.ts

import {
  createWalletClient,
  http,
  parseTransaction,
  serializeTransaction,
  type WalletClient,
  type Account,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, polygon, base } from "viem/chains";

// Chain configurations
const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  8453: base,
  130: {
    id: 130,
    name: "Unichain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://mainnet.unichain.org"] } },
  } as Chain,
};
```

### Transaction Signing

```typescript
// src/chrome/localSigner.ts

export interface SignTransactionParams {
  to: string;
  data?: string;
  value?: string;
  chainId: number;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

/**
 * Signs and broadcasts a transaction locally
 * CRITICAL: Only call from service worker with decrypted private key
 */
export async function signAndBroadcastTransaction(
  privateKey: `0x${string}`,
  params: SignTransactionParams,
  rpcUrl: string,
): Promise<{ txHash: string }> {
  const account = privateKeyToAccount(privateKey);
  const chain = CHAIN_MAP[params.chainId];

  if (!chain) {
    throw new Error(`Unsupported chain: ${params.chainId}`);
  }

  const client = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  // Get nonce if not provided
  const nonce =
    params.nonce ??
    (await client.getTransactionCount({
      address: account.address,
    }));

  // Estimate gas if not provided
  const gasEstimate = params.gas
    ? BigInt(params.gas)
    : await client.estimateGas({
        account,
        to: params.to as `0x${string}`,
        data: params.data as `0x${string}` | undefined,
        value: params.value ? BigInt(params.value) : 0n,
      });

  // Send transaction
  const txHash = await client.sendTransaction({
    to: params.to as `0x${string}`,
    data: params.data as `0x${string}` | undefined,
    value: params.value ? BigInt(params.value) : 0n,
    gas: gasEstimate,
    nonce,
    // EIP-1559 if supported
    ...(params.maxFeePerGas && {
      maxFeePerGas: BigInt(params.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(params.maxPriorityFeePerGas || "0"),
    }),
  });

  return { txHash };
}
```

### Message Signing

```typescript
// src/chrome/localSigner.ts

import { hashMessage, hashTypedData } from "viem";

export type SignatureMethod =
  | "personal_sign"
  | "eth_sign"
  | "eth_signTypedData"
  | "eth_signTypedData_v3"
  | "eth_signTypedData_v4";

/**
 * Signs a message using the appropriate method
 * CRITICAL: Only call from service worker with decrypted private key
 */
export async function signMessage(
  privateKey: `0x${string}`,
  method: SignatureMethod,
  params: any[],
): Promise<string> {
  const account = privateKeyToAccount(privateKey);

  switch (method) {
    case "personal_sign": {
      // params: [message, address]
      const message = params[0];
      const signature = await account.signMessage({
        message:
          typeof message === "string" && message.startsWith("0x")
            ? { raw: message as `0x${string}` }
            : message,
      });
      return signature;
    }

    case "eth_sign": {
      // params: [address, message]
      // Note: eth_sign signs raw hash (dangerous, deprecated)
      const messageHash = params[1] as `0x${string}`;
      const signature = await account.signMessage({
        message: { raw: messageHash },
      });
      return signature;
    }

    case "eth_signTypedData":
    case "eth_signTypedData_v3":
    case "eth_signTypedData_v4": {
      // params: [address, typedData]
      const typedData =
        typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];

      const signature = await account.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });
      return signature;
    }

    default:
      throw new Error(`Unsupported signature method: ${method}`);
  }
}
```

## Background Service Worker Updates

### New Message Types

```typescript
// Message types for private key accounts

// Account Management
| "getAccounts"              | Get all accounts (metadata only)
| "getActiveAccount"         | Get currently active account
| "setActiveAccount"         | Set active account by ID (also updates storage address)
| "addPrivateKeyAccount"     | Import new PK account
| "removeAccount"            | Remove account by ID
| "getTabAccount"            | Get account for specific tab
| "setTabAccount"            | Set account for specific tab

// Signing (PK accounts only)
| "confirmTransactionPK"     | Sign and broadcast transaction
| "confirmSignatureRequest"  | Sign message request

// Account Settings
| "revealPrivateKey"         | Reveal private key (password verification required)
| "updateAccountDisplayName" | Update account display name
```

### setActiveAccount Behavior

When `setActiveAccount` is called, the background worker:

1. Updates `activeAccountId` in `chrome.storage.sync`
2. Retrieves the account details by ID
3. Updates `address` and `displayAddress` in `chrome.storage.sync` to match the new active account
4. The storage change listener in background.ts detects the address change
5. Broadcasts `setAddress` message to all tabs
6. Each tab's inject.ts emits `accountsChanged` to notify dApps

This ensures that:

- New tabs opening after account switch get the correct address from storage
- Existing tabs receive `accountsChanged` events
- The provider always returns the correct address for `eth_accounts`

### Updated Transaction Handler

```typescript
// In background.ts

async function handleConfirmTransactionAsync(
  txId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const pending = await getPendingTxRequestById(txId);
  if (!pending) {
    return { success: false, error: "Transaction not found or expired" };
  }

  // Get active account
  const account = await getActiveAccountForOrigin(pending.origin);

  if (account.type === "bankr") {
    // Existing Bankr API flow
    return handleBankrTransaction(txId, password, pending);
  } else {
    // New local signing flow
    return handleLocalTransaction(txId, password, pending, account);
  }
}

async function handleLocalTransaction(
  txId: string,
  password: string,
  pending: PendingTxRequest,
  account: PrivateKeyAccount,
): Promise<{ success: boolean; error?: string }> {
  // Get or decrypt vault
  let vault = getCachedVault();
  if (!vault) {
    vault = await decryptAndCacheVault(password);
    if (!vault) {
      return { success: false, error: "Invalid password" };
    }
  }

  // Get private key for this account
  const vaultEntry = vault.accounts.find((a) => a.id === account.id);
  if (!vaultEntry) {
    return { success: false, error: "Account not found in vault" };
  }

  // Remove from pending
  await removePendingTxRequest(txId);

  // Process in background
  processLocalTransactionInBackground(txId, pending, vaultEntry.privateKey);

  return { success: true };
}
```

### Signature Request Handler

```typescript
// In background.ts

async function handleConfirmSignatureRequest(
  sigId: string,
  password: string,
): Promise<SignatureResult> {
  const pending = await getPendingSignatureRequestById(sigId);
  if (!pending) {
    return { success: false, error: "Signature request not found" };
  }

  // Get active account
  const account = await getActiveAccount();

  if (account.type === "bankr") {
    // Bankr API doesn't support signing
    return {
      success: false,
      error: "Signatures are not supported for Bankr API accounts",
    };
  }

  // Get private key from vault
  const vault = await getOrDecryptVault(password);
  const vaultEntry = vault?.accounts.find((a) => a.id === account.id);

  if (!vaultEntry) {
    return { success: false, error: "Account not found" };
  }

  try {
    // Sign the message
    const signature = await signMessage(
      vaultEntry.privateKey as `0x${string}`,
      pending.signature.method,
      pending.signature.params,
    );

    // Remove from pending
    await removePendingSignatureRequest(sigId);

    return { success: true, signature };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Signing failed",
    };
  }
}
```

## Onboarding Flow Updates

### Step 0: Account Type Selection

```
┌─────────────────────────────────────────────────────────────────┐
│  Choose Account Type                                             │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐         │
│  │   [🤖 Bankr API]    │  │   [🔑 Private Key]     │         │
│  │                        │  │                        │         │
│  │  AI-powered wallet     │  │  Standard wallet with  │         │
│  │  No private keys       │  │  full signing support  │         │
│  │  Execute via Bankr API │  │  Local key storage     │         │
│  └────────────────────────┘  └────────────────────────┘         │
│                                                                  │
│  □ Set up both account types                                     │
│                                                                  │
│                        [Continue →]                              │
└─────────────────────────────────────────────────────────────────┘
```

### Bankr Account Setup (if selected)

```
┌─────────────────────────────────────────────────────────────────┐
│  Setup Bankr Wallet                                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Bankr API Key                                            │   │
│  │  [••••••••••••••••••••••••••••••••••]            [👁]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Wallet Address                                           │   │
│  │  [0x... or ENS name]                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Display Name (Optional)                                   │   │
│  │  [My Main Wallet]                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Links: Get API key | Find wallet address                        │
│                                                                  │
│                        [Continue →]                              │
└─────────────────────────────────────────────────────────────────┘
```

### Private Key Onboarding Steps

```
Step 1 (PK Selected): Enter Private Key
┌─────────────────────────────────────────────────────────────────┐
│  Import Private Key                                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Private Key                                              │   │
│  │  [••••••••••••••••••••••••••••••••••••••••••]   [👁]     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Detected Address: 0x742d...4F28                                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Display Name (Optional)                                   │   │
│  │  [My Trading Wallet]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ⚠️ Your private key is encrypted locally and never leaves      │
│     your device. Only you have access to it.                     │
│                                                                  │
│                        [Continue →]                              │
└─────────────────────────────────────────────────────────────────┘

Step 2: Create Password (same as existing)

Step 3: Success (same as existing)
```

**Note**: The display name field is optional and allows users to set a friendly name for their account (e.g., "Trading Bot", "DeFi Wallet"). This name appears in the account switcher dropdown.

### Account Order and Active Account Selection

When onboarding with both account types ("Set up both account types" checkbox):

1. **PK account is added first** → becomes the active account
2. **Bankr account is added second** → available but not active by default
3. **Storage address** → set to the PK account address (the active account)

This ensures that immediately after onboarding:

- The extension UI shows the PK account
- Dapps connecting receive the PK account address
- The user can switch to the Bankr account via the account dropdown

## Homepage UI Updates

### Account Switcher Dropdown

```
┌─────────────────────────────────────────────────────────────────┐
│  [Header Bar]                                                    │
│                                                                  │
│  Current Account                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🤖  Bankr Wallet  (0x742d...4F28)              [v]     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Dropdown (when opened):                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✓ 🤖  Bankr Wallet         0x742d...4F28               │   │
│  │    🔑  Agent Wallet         0x1a2b...3C4D               │   │
│  │    🔑  Trading Bot          0x5e6f...7G8H               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  [+ Add Account]                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Add Account Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]              Add Account                               │
│                                                                  │
│  Account Type                                                    │
│  ○ Bankr Wallet (requires API key)                              │
│  ● Private Key                                                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Private Key                                              │   │
│  │  [0x...]                                          [👁]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Account Name (optional)                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Agent Wallet #2]                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Resolved Address: 0x9a8b...7C6D                                │
│                                                                  │
│                        [Import Account]                          │
└─────────────────────────────────────────────────────────────────┘
```

## UI Differences by Account Type

The extension UI adapts based on the currently selected account type:

| Feature                           | Bankr Account       | Private Key Account            |
| --------------------------------- | ------------------- | ------------------------------ |
| Chat History button (header)      | ✅ Visible          | ❌ Hidden                      |
| "Chat with Bankr" button (footer) | ✅ Visible          | ❌ Hidden                      |
| Signature buttons                 | Reject only (red)   | Sign (yellow) + Reject (white) |
| Transaction History               | Filtered by account | Filtered by account            |

**Rationale**: The Bankr chat feature uses the Bankr API, which is only available for Bankr accounts. Private Key accounts sign locally and don't interact with the Bankr API for chat.

## Transaction History Filtering

The recent transactions list (`TxStatusList`) is filtered by the currently selected account:

- Only transactions where `tx.from` matches the active account address are displayed
- When switching accounts, the transaction list updates automatically
- Each account sees only their own transaction history
- Filtering is case-insensitive (addresses normalized to lowercase)

## Per-Tab Account Management

Similar to per-tab chain management, each browser tab maintains its own selected account.

### Storage Structure

```typescript
// In chrome.storage.sync
{
  tabAccounts: {
    "12345": "account-uuid-1",  // Tab ID -> Account ID
    "67890": "account-uuid-2",
  },
  activeAccountId: "account-uuid-1"  // Default/fallback
}
```

### Tab Account Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Per-Tab Account Management                               │
│                                                                             │
│  1. User opens dApp in Tab A                                                 │
│     - Content script reads address from chrome.storage.sync                 │
│     - Sends init message to inpage with address                             │
│     - Verifies with background that address matches active account          │
│     - If mismatch detected, emits accountsChanged with correct address      │
│                                                                             │
│  2. User switches account in popup while Tab A is active                    │
│     - Background updates activeAccountId                                    │
│     - Background updates address/displayAddress in chrome.storage.sync      │
│     - Storage change listener broadcasts setAddress to Tab A                │
│     - inject.ts receives setAddress, emits accountsChanged to dApp          │
│                                                                             │
│  3. User switches to Tab B (different dApp)                                 │
│     - Tab B has its own account selection (or default)                      │
│     - Popup shows Tab B's account                                           │
│     - Tab A keeps its account selection                                     │
│                                                                             │
│  4. User switches back to Tab A                                             │
│     - Popup queries Tab A's content script                                  │
│     - Account dropdown updates to show Tab A's account                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Address Synchronization on Init

When the content script initializes, it performs a verification step to ensure the provider has the correct active account address:

```typescript
// In inject.ts init()
// After reading address from storage and initializing provider:
chrome.runtime.sendMessage({ type: "getActiveAccount" }, (account) => {
  if (account && account.address !== address) {
    // Storage was stale, emit accountsChanged with correct address
    window.postMessage(
      {
        type: "accountsChanged",
        msg: { address: account.address },
      },
      "*",
    );
  }
});
```

This handles edge cases where:

- Storage may be stale after extension updates
- Multiple accounts exist and active account doesn't match storage
- Race conditions during onboarding

## Signature Request Confirmation Updates

For private key accounts, the signature confirmation screen shows both **Reject** and **Sign** buttons.

**Button Styling:**

- **Reject button**: White/secondary style (matches transaction confirmation)
- **Sign button**: Yellow background (Bauhaus primary action style)

Note: For Bankr accounts (which don't support signing), the Reject button is red to emphasize that signing is not available.

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]      < 1/1 >                           [Reject All]   │
│                                                                  │
│                    Signature Request                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Origin: app.uniswap.org                                  │   │
│  │  Network: [Ethereum icon] Ethereum                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Method: Personal Sign                                           │
│                                                                  │
│  Message:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Sign this message to verify your identity                │   │
│  │  Nonce: 1234567890                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────┐  ┌────────────────────┐                   │
│  │ [REJECT] (white) │  │  [SIGN] (yellow)   │                   │
│  └──────────────────┘  └────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## File Changes Summary

### New Files

| File                                       | Description                               |
| ------------------------------------------ | ----------------------------------------- |
| `src/chrome/types.ts`                      | Account and vault type definitions        |
| `src/chrome/vaultCrypto.ts`                | Keystore encryption/decryption using ox   |
| `src/chrome/localSigner.ts`                | Transaction and message signing with viem |
| `src/chrome/accountStorage.ts`             | Account CRUD operations                   |
| `src/components/AccountSwitcher.tsx`       | Account dropdown component                |
| `src/components/AccountSettingsModal.tsx`  | Account settings (rename, reveal, remove) |
| `src/components/RevealPrivateKeyModal.tsx` | Password-protected private key reveal     |
| `src/components/AddAccount.tsx`            | Add new account screen                    |

### Modified Files

| File                                              | Changes                                 |
| ------------------------------------------------- | --------------------------------------- |
| `src/pages/Onboarding.tsx`                        | Add account type selection step         |
| `src/chrome/background.ts`                        | Add PK account handlers, local signing  |
| `src/chrome/inject.ts`                            | Per-tab account tracking                |
| `src/chrome/impersonator.ts`                      | Support for account switching           |
| `src/App.tsx`                                     | Account switcher, per-tab account state |
| `src/components/SignatureRequestConfirmation.tsx` | Add confirm button for PK accounts      |
| `src/components/TransactionConfirmation.tsx`      | Handle both account types               |
| `package.json`                                    | Add viem dependency                     |

## Dependencies

```json
{
  "dependencies": {
    "viem": "^2.x.x",
    "ox": "^0.x.x"
  }
}
```

**Note**: viem is built on top of ox, so ox may already be included as a transitive dependency. We explicitly include it for direct access to the Keystore API.

## Additional Security Considerations

### Why ox Keystore Format

We use the standard JSON Keystore format via `ox` for private key encryption:

```typescript
// ox Keystore with scrypt KDF
{
  cipher: "aes-128-ctr",
  kdf: "scrypt",
  kdfparams: {
    n: 262144,   // CPU/memory cost
    r: 8,        // Block size
    p: 1,        // Parallelization
    dklen: 32,
    salt: "..."
  }
}
```

**Benefits**:

- Industry standard format (compatible with geth, other wallets)
- Scrypt KDF is memory-hard (resistant to GPU/ASIC attacks)
- Well-audited implementation in ox library
- Each key encrypted independently (compromise of one doesn't affect others)

**Note**: We continue using our existing AES-256-GCM encryption for the Bankr API key (non-standard format is fine there since it's not portable).

### Browser Extension Lifecycle Security

**Critical Note**: Browser extensions have strict limits on background activity and will be shut down when idle. This has security implications:

1. **Service Worker Suspension**: When the browser suspends our service worker:
   - All cached credentials (decrypted vault, password) are cleared from memory
   - This is actually a security feature - keys don't persist indefinitely
   - Users must re-enter password after suspension

2. **Keep-Alive Not Recommended**: Using ping/keep-alive to prevent suspension:
   - Reduces security by keeping keys in memory longer
   - Tabs are also throttled when idle
   - We accept suspension as a security boundary

3. **Graceful Handling**:
   - Listen for `suspend` event to ensure clean memory wipe
   - Handle reconnection gracefully when service worker restarts
   - Never persist decrypted keys to storage

### Preventing Timing Attacks

From analysis of wallet drainer detection methods, malicious sites can detect automated wallets through timing analysis:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Timing Attack Prevention                               │
│                                                                             │
│  Malicious sites detect automation by measuring:                            │
│  - Time between eth_requestAccounts call and response                       │
│  - Human users: 1-5 seconds (reading popup, clicking)                       │
│  - Automated: < 20ms (instant response)                                     │
│                                                                             │
│  Our defense:                                                               │
│  - Always require user confirmation via popup (natural delay)               │
│  - Never auto-approve transactions even for "trusted" sites                 │
│  - Popup must be user-initiated, not programmatically opened                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Event Emission Requirements

To be recognized as a legitimate wallet by dApps (and avoid detection as automation), our provider must properly emit EIP-1193 events:

- `connect` - When wallet connects to a chain
- `disconnect` - When wallet disconnects
- `accountsChanged` - When active account changes
- `chainChanged` - When network changes

The current implementation already handles these correctly in `impersonator.ts`.

## Security Audit Checklist

Before deployment, verify:

- [ ] Private keys NEVER logged to console
- [ ] Private keys NEVER sent via chrome.runtime messages to UI
- [ ] Vault decryption ONLY happens in service worker
- [ ] Auto-lock properly clears cached vault
- [ ] Service worker suspension clears all sensitive data
- [ ] Reset function wipes all keys from memory and storage
- [ ] No private key data in content script or inpage contexts
- [ ] Transaction signing validates chain ID before signing
- [ ] Signature requests validate account ownership
- [ ] Error messages don't leak key material

## Testing Plan

### Unit Tests

1. Vault encryption/decryption with correct password
2. Vault decryption fails with wrong password
3. Transaction signing produces valid signatures
4. Message signing for all methods (personal_sign, signTypedData, etc.)
5. Account CRUD operations

### Integration Tests

1. Full onboarding flow for PK accounts
2. Account switching updates dApp correctly
3. Transaction confirmation signs and broadcasts
4. Signature confirmation returns valid signature
5. Per-tab account persistence
6. Auto-lock clears sensitive data

### Security Tests

1. Verify private keys not accessible from content script
2. Verify private keys not in chrome.storage in plaintext
3. Verify memory cleared after auto-lock timeout
4. Verify memory cleared after extension reset
5. Test with browser devtools open (no key leakage)

## References

### Standards

- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) - Ethereum Provider JavaScript API
- [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963) - Multi Injected Provider Discovery
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) - Typed structured data hashing and signing

### Libraries

- [viem](https://viem.sh) - TypeScript interface for Ethereum (signing, transactions)
- [ox](https://oxlib.sh) - Low-level Ethereum utilities (keystore encryption)

### Security

- Industry-standard wallet architecture patterns (encrypted vault, keyring controllers)
- Scrypt KDF for memory-hard password derivation
- Browser extension lifecycle security (service worker suspension)
