import type { Account } from "@/chrome/types";
import type { ThemeId } from "@/theme";

export type PreviewRoute =
  | "home"
  | "onboarding"
  | "unlock"
  | "tx"
  | "signature"
  | "settings"
  | "portfolio"
  | "tx-detail"
  | "swap"
  | "shield"
  | "swap-picker"
  | "components"
  | "mobile-primitives"
  | "decision-primitives"
  | "batch"
  | "cross-batch"
  | "permission"
  | "watch-asset"
  | "add-chain"
  | "send"
  | "receive"
  | "more"
  | "connected-apps"
  | "chat"
  | "account-management"
  | "token-management"
  | "safe"
  | "all";

export type FrameMode =
  | "compact"
  | "popup"
  | "window"
  | "sidepanel"
  | "fullscreen";

export type PreviewWalletType =
  | "bankr"
  | "privateKey"
  | "seedPhrase"
  | "viewOnly";

export interface PreviewWallet {
  accountId: string;
  accountType: Exclude<Account["type"], "ledger" | "safe">;
  address: `0x${string}`;
  displayName: string;
  createdAt: number;
  seedGroupId?: string;
  derivationIndex?: number;
}

export interface PreviewState {
  route: PreviewRoute;
  theme: ThemeId;
  frame: FrameMode;
  scenario: string;
  wallet: PreviewWalletType;
}

export type PreviewFidelity = "production" | "composed" | "synthetic";
