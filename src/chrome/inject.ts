import { NetworksInfo } from "../types";

/**
 * Get the favicon URL from the current page
 */
function getFaviconUrl(): string | null {
  // Try standard favicon link elements
  const standardFavicon = document.querySelector(
    'link[rel="icon"], link[rel="shortcut icon"]'
  ) as HTMLLinkElement | null;
  if (standardFavicon?.href) {
    return standardFavicon.href;
  }

  // Try Apple touch icon (usually higher quality)
  const appleTouchIcon = document.querySelector(
    'link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'
  ) as HTMLLinkElement | null;
  if (appleTouchIcon?.href) {
    return appleTouchIcon.href;
  }

  // Fallback to default /favicon.ico
  return new URL("/favicon.ico", window.location.origin).href;
}

let store = {
  address: "",
  displayAddress: "",
  chainName: "",
};

const init = async () => {
  // inject inpage.js into webpage
  try {
    let script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.src = chrome.runtime.getURL("/static/js/inpage.js");
    script.onload = async function () {
      // @ts-ignore
      this.remove();

      // initialize web3 provider (window.ethereum)
      const { address } = (await chrome.storage.sync.get("address")) as {
        address: string | undefined;
      };
      const { displayAddress } = (await chrome.storage.sync.get(
        "displayAddress"
      )) as {
        displayAddress: string | undefined;
      };
      let { chainName } = (await chrome.storage.sync.get("chainName")) as {
        chainName: string | undefined;
      };
      const { networksInfo } = (await chrome.storage.sync.get(
        "networksInfo"
      )) as { networksInfo: NetworksInfo | undefined };

      if (
        networksInfo &&
        chainName &&
        networksInfo[chainName] &&
        address &&
        displayAddress
      ) {
        store = {
          address,
          displayAddress,
          chainName,
        };

        window.postMessage(
          {
            type: "init",
            msg: {
              address,
              chainId: networksInfo[chainName].chainId,
              rpcUrl: networksInfo[chainName].rpcUrl,
            },
          },
          "*"
        );
      }
    };
    document.head
      ? document.head.prepend(script)
      : document.documentElement.prepend(script);
  } catch (e) {
    console.log(e);
  }
};

// Receive messages from popup.js and forward it to the injected code (impersonator.ts)
chrome.runtime.onMessage.addListener((msgObj, sender, sendResponse) => {
  if (msgObj.type) {
    switch (msgObj.type) {
      case "setAddress": {
        const address = msgObj.msg.address as string;
        const displayAddress = msgObj.msg.displayAddress as string;

        store.address = address;
        store.displayAddress = displayAddress;
        break;
      }
      case "setChainId": {
        const chainName = msgObj.msg.chainName as string;

        store.chainName = chainName;
        break;
      }
      case "getInfo": {
        sendResponse(store);

        break;
      }
    }
  }

  window.postMessage(msgObj, "*");
});

// Receive messages from injected impersonator.ts code
window.addEventListener("message", async (e) => {
  // only accept messages from us
  if (e.source !== window) {
    return;
  }

  if (!e.data.type) {
    return;
  }

  switch (e.data.type) {
    case "i_switchEthereumChain": {
      const chainId = e.data.msg.chainId as number;
      const { networksInfo } = (await chrome.storage.sync.get(
        "networksInfo"
      )) as { networksInfo: NetworksInfo | undefined };

      if (!networksInfo) {
        break;
      }

      let rpcUrl: string | undefined;
      let chainName: string;
      for (const _chainName of Object.keys(networksInfo)) {
        if (networksInfo[_chainName].chainId === chainId) {
          rpcUrl = networksInfo[_chainName].rpcUrl;
          chainName = _chainName;
          break;
        }
      }

      if (!rpcUrl) {
        break;
      }

      store.chainName = chainName!;
      // send message to switchEthereumChain with RPC, in impersonator.ts
      window.postMessage(
        {
          type: "switchEthereumChain",
          msg: {
            chainId,
            rpcUrl,
          },
        },
        "*"
      );
      break;
    }

    case "i_sendTransaction": {
      const { id, from, to, data, value, chainId } = e.data.msg as {
        id: string;
        from: string;
        to: string;
        data: string;
        value: string;
        chainId: number;
      };

      // Forward to background worker
      chrome.runtime.sendMessage(
        {
          type: "sendTransaction",
          tx: { from, to, data, value, chainId },
          origin: window.location.origin,
          favicon: getFaviconUrl(),
        },
        (result: { success: boolean; txHash?: string; error?: string }) => {
          // Send result back to impersonator.ts
          window.postMessage(
            {
              type: "sendTransactionResult",
              msg: {
                id,
                success: result.success,
                txHash: result.txHash,
                error: result.error,
              },
            },
            "*"
          );
        }
      );
      break;
    }

    case "i_rpcRequest": {
      const { id, rpcUrl, method, params } = e.data.msg as {
        id: string;
        rpcUrl: string;
        method: string;
        params: any[];
      };

      // Forward RPC request to background worker
      chrome.runtime.sendMessage(
        {
          type: "rpcRequest",
          id,
          rpcUrl,
          method,
          params,
        },
        (response: { result?: any; error?: string }) => {
          // Send result back to impersonator.ts
          window.postMessage(
            {
              type: "rpcResponse",
              msg: {
                id,
                result: response?.result,
                error: response?.error,
              },
            },
            "*"
          );
        }
      );
      break;
    }
  }
});

init();

// to remove isolated modules error
export {};
