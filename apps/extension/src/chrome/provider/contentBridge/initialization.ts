import type { NetworksInfo } from "@/types";
import {
  bridgeState,
  UNCONNECTED_ADDRESS,
  UNCONNECTED_CHAIN_ID,
  UNCONNECTED_CHAIN_NAME,
} from "./bridgeState";

export async function initializeInpageProvider(): Promise<void> {
  try {
    const script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.src = chrome.runtime.getURL("/static/js/inpage.js");
    script.onload = async function () {
      script.remove();
      const [account, syncState, dappAccounts] = await Promise.all([
        chrome.runtime.sendMessage({ type: "getActiveAccount" }).catch(() => null),
        chrome.storage.sync.get([
          "address",
          "displayAddress",
          "chainName",
          "networksInfo",
        ]),
        chrome.runtime
          .sendMessage({ type: "getDappAccounts" })
          .catch(() => ({ accounts: [] })),
      ]);
      const address = account?.address || syncState.address;
      const displayAddress =
        account?.displayName ||
        account?.address ||
        syncState.displayAddress ||
        address;
      const chainName = syncState.chainName as string | undefined;
      const networksInfo = syncState.networksInfo as NetworksInfo | undefined;

      if (!address || !displayAddress) {
        return;
      }
      const connected =
        dappAccounts?.success === true &&
        Array.isArray(dappAccounts?.accounts) &&
        typeof dappAccounts.accounts[0] === "string";
      const storedChain =
        connected && chainName ? networksInfo?.[chainName] : undefined;
      const initialChainId = storedChain?.chainId ?? UNCONNECTED_CHAIN_ID;
      Object.assign(bridgeState, {
        address,
        displayAddress,
        chainName: storedChain ? chainName : UNCONNECTED_CHAIN_NAME,
        chainId: initialChainId,
        dappConnected: connected,
        accountId: account?.id || "",
        accountType: account?.type || "",
      });
      window.postMessage(
        {
          type: "init",
          msg: {
            address: connected ? dappAccounts.accounts[0] : UNCONNECTED_ADDRESS,
            chainId: initialChainId,
          },
        },
        "*",
      );
    };
    (document.head ?? document.documentElement).prepend(script);
  } catch (error) {
    console.log(error);
  }
}
