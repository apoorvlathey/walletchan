import { handleGetClearSigningDescriptor } from "@/chrome/clearSigningHandlers";
import { resolveTokenMetadata } from "@/chrome/tokenMetadata";
import { getStoredNetworksInfo } from "@/lib/chains";
import { resolveExplorerTransactionPage } from "@/lib/explorerTransaction";

const EXPLORER_PAGE_PATH = "/explorer.html";
const EXPLORER_MESSAGE_TYPES = new Set([
  "GET_CLEAR_SIGNING_DESCRIPTOR",
  "resolveTokenMetadata",
  "EXPLORER_TRANSACTION_FRAME_EVENT",
]);

function isExplorerExtensionFrame(
  sender: chrome.runtime.MessageSender,
  extensionRoot = chrome.runtime.getURL("/"),
): boolean {
  if (!sender.url) return false;
  try {
    const senderUrl = new URL(sender.url);
    const rootUrl = new URL(extensionRoot);
    return (
      senderUrl.protocol === rootUrl.protocol &&
      senderUrl.host === rootUrl.host &&
      senderUrl.pathname === EXPLORER_PAGE_PATH
    );
  } catch {
    return false;
  }
}

async function authorizeExplorerMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
): Promise<boolean> {
  if (!isExplorerExtensionFrame(sender) || !sender.tab?.url) return false;
  const page = resolveExplorerTransactionPage(
    sender.tab.url,
    await getStoredNetworksInfo(),
  );
  if (!page) return false;

  if (message.type === "EXPLORER_TRANSACTION_FRAME_EVENT") {
    return (
      typeof message.token === "string" &&
      /^[0-9a-f]{32}$/.test(message.token) &&
      (message.action === "resize" || message.action === "dismiss") &&
      (message.action !== "resize" ||
        (Number.isFinite(message.height) &&
          Number(message.height) >= 1 &&
          Number(message.height) <= 100_000))
    );
  }

  if (Number(message.chainId) !== page.chain.chainId) return false;

  if (message.type === "GET_CLEAR_SIGNING_DESCRIPTOR") {
    return (
      message.kind === "calldata" &&
      typeof message.address === "string" &&
      /^0x[0-9a-fA-F]{40}$/.test(message.address)
    );
  }
  return (
    message.type === "resolveTokenMetadata" &&
    typeof message.tokenAddress === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(message.tokenAddress)
  );
}

/**
 * Public-metadata-only route for the extension iframe embedded on recognized
 * explorer transaction pages. It runs before the wallet/provider audience
 * gate and never grants the frame general wallet-UI authority.
 */
export function handleExplorerTransactionMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  if (!EXPLORER_MESSAGE_TYPES.has(message?.type)) return false;
  if (!isExplorerExtensionFrame(sender)) return false;

  void authorizeExplorerMessage(message, sender).then(async (authorized) => {
    if (!authorized) {
      sendResponse({ success: false, error: "Unauthorized" });
      return;
    }
    try {
      if (message.type === "EXPLORER_TRANSACTION_FRAME_EVENT") {
        if (sender.tab?.id === undefined) {
          throw new Error("Explorer tab is unavailable");
        }
        await chrome.tabs.sendMessage(
          sender.tab.id,
          {
            type: message.type,
            token: message.token,
            action: message.action,
            height: message.height,
          },
          { frameId: 0 },
        );
        sendResponse({ success: true });
        return;
      }
      if (message.type === "GET_CLEAR_SIGNING_DESCRIPTOR") {
        sendResponse(await handleGetClearSigningDescriptor(message));
        return;
      }
      const data = await resolveTokenMetadata(
        Number(message.chainId),
        message.tokenAddress,
        { includeCustomTokens: false },
      );
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Explorer metadata lookup failed",
      });
    }
  });
  return true;
}

export const explorerTransactionMessagePolicy = {
  isExplorerExtensionFrame,
};
