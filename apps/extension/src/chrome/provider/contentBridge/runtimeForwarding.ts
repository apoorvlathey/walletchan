import {
  acceptedRuntimeMessageType,
} from "./messagePolicy";
import {
  bridgeState,
  UNCONNECTED_ADDRESS,
  getPermissionRevision,
  getChainRevision,
  setProviderChain,
  resetDisconnectedChain,
} from "./bridgeState";

function exposedDappAddress(
  result: { accounts?: unknown[] } | null | undefined,
): string {
  return Array.isArray(result?.accounts) &&
    typeof result.accounts[0] === "string"
    ? result.accounts[0]
    : UNCONNECTED_ADDRESS;
}

export function installRuntimeToPageForwarding(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = acceptedRuntimeMessageType(message);
    if (!type) return;

    switch (type) {
      case "setAddress": {
        const address = message.msg.address as string;
        const addressChanged = bridgeState.address !== address;
        bridgeState.address = address;
        bridgeState.displayAddress = message.msg.displayAddress as string;

        chrome.runtime
          .sendMessage({ type: "getDappAccounts" })
          .then((result) => {
            bridgeState.dappConnected =
              Array.isArray(result?.accounts) &&
              typeof result.accounts[0] === "string";
            window.postMessage(
              {
                ...message,
                msg: {
                  ...message.msg,
                  address: exposedDappAddress(result),
                  emitAccountsChanged:
                    addressChanged && result?.accounts?.length > 0,
                },
              },
              "*",
            );
          })
          .catch(() => {
            bridgeState.dappConnected = false;
            window.postMessage(
              {
                ...message,
                msg: {
                  ...message.msg,
                  address: UNCONNECTED_ADDRESS,
                  emitAccountsChanged: false,
                },
              },
              "*",
            );
          });
        break;
      }
      case "setChainId": {
        const revision = getPermissionRevision();
        const chainRevision = getChainRevision();
        void chrome.runtime.sendMessage({ type: "getDappAccounts", chainId: message.msg.chainId })
          .then((result) => {
            if (revision !== getPermissionRevision() || chainRevision !== getChainRevision()) return;
            if (result?.success !== true || !result.accounts?.length) {
              resetDisconnectedChain();
              return;
            }
            bridgeState.dappConnected = true;
            setProviderChain(message.msg.chainName, message.msg.chainId);
            window.postMessage(
              { type: "setChainId", msg: { chainId: message.msg.chainId } }, "*",
            );
          }).catch(() => {
            if (revision === getPermissionRevision() && chainRevision === getChainRevision()) resetDisconnectedChain();
          });
        break;
      }
      case "setAccount":
        Object.assign(bridgeState, {
          address: message.msg.address as string,
          displayAddress: message.msg.displayAddress as string,
          accountId: message.msg.accountId as string,
          accountType: message.msg.accountType as string,
        });
        chrome.runtime
          .sendMessage({ type: "getDappAccounts" })
          .then((result) => {
            bridgeState.dappConnected =
              Array.isArray(result?.accounts) &&
              typeof result.accounts[0] === "string";
            window.postMessage(
              {
                type: "setAddress",
                msg: {
                  address: exposedDappAddress(result),
                  emitAccountsChanged: result?.accounts?.length > 0,
                },
              },
              "*",
            );
          })
          .catch(() => {
            bridgeState.dappConnected = false;
          });
        break;
      case "getInfo":
        sendResponse(bridgeState);
        break;
      case "dappPermissionRevoked":
        resetDisconnectedChain(true);
        window.postMessage(
          { type: "accountsChanged", msg: { accounts: [] } },
          "*",
        );
        break;
    }
  });
}
