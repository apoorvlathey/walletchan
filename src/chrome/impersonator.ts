import { EventEmitter } from "events";
import { hexValue } from "@ethersproject/bytes";
import { Logger } from "@ethersproject/logger";

const logger = new Logger("ethers/5.7.0");

type Window = Record<string, any>;

// EIP-6963 interfaces
interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: ImpersonatorProvider;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: "eip6963:announceProvider";
  detail: EIP6963ProviderDetail;
}

// Wallet icon as data URI (128x128 PNG)
const WALLET_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF+mlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDIyLTA5LTIyVDE4OjAxOjIyKzA1OjMwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIyLTA5LTIyVDE4OjAxOjIyKzA1OjMwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMi0wOS0yMlQxODowMToyMiswNTozMCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo2YzAyZTc5MC00NDg5LTRmNDUtOWM0NC1jYjAyZmFjZGE2YjUiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDoxYjU2YzVhZS1lNjllLWRmNGUtYTlhYi0wMDg1YjBmZjkzMjQiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo5OGRmNDJlZS1lOWIyLWE5NDktYTc3MS01NjE0NWY4NzkzZTAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0ic1JHQiBJRUM2MTk2Ni0yLjEiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjk4ZGY0MmVlLWU5YjItYTk0OS1hNzcxLTU2MTQ1Zjg3OTNlMCIgc3RFdnQ6d2hlbj0iMjAyMi0wOS0yMlQxODowMToyMiswNTozMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo2YzAyZTc5MC00NDg5LTRmNDUtOWM0NC1jYjAyZmFjZGE2YjUiIHN0RXZ0OndoZW49IjIwMjItMDktMjJUMTg6MDE6MjIrMDU6MzAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE5IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4QRddWAAAqaElEQVR42u29WYxk15nn9zvnrrFHRu6ZtW8sFtemqJaollotcdrdmk2j6QY8wMCwZ15m7BdjAAPGvM/LPBoGjIG3Fxs2PLCBcff0jKe7Na1utUiJlEiqiqyVVZVVWVmZlXtmLDfucs7xw7kRGVksFmvJrYo8QCCzsiJv3rjf/3zL/1uOMMbwGMsHjgKvAL8BvAScAMaBENB8tfZiSSAFVoDbwAXgI+Ay8AkQPeqFxGMA4DvA3wW+BkwAVaAClADnK5nsyzK5sDcH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";

// Session UUID for EIP-6963 (generated once per page load)
const SESSION_UUID = crypto.randomUUID();

// Allowed chain IDs: Ethereum, Polygon, Base, Unichain
const ALLOWED_CHAIN_IDS = new Set([1, 137, 8453, 130]);

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  8453: "Base",
  130: "Unichain",
};

// Pending transaction callbacks
const pendingTxCallbacks = new Map<
  string,
  { resolve: (hash: string) => void; reject: (error: Error) => void }
>();

// Pending signature request callbacks
const pendingSignatureCallbacks = new Map<
  string,
  { resolve: (result: string) => void; reject: (error: Error) => void }
>();

// Pending RPC request callbacks
const pendingRpcCallbacks = new Map<
  string,
  { resolve: (result: any) => void; reject: (error: Error) => void }
>();

// Helper to make RPC calls through content script (to bypass page CSP)
function rpcCall(rpcUrl: string, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    pendingRpcCallbacks.set(requestId, { resolve, reject });

    window.postMessage(
      {
        type: "i_rpcRequest",
        msg: {
          id: requestId,
          rpcUrl,
          method,
          params,
        },
      },
      "*"
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRpcCallbacks.has(requestId)) {
        pendingRpcCallbacks.delete(requestId);
        reject(new Error("RPC request timeout"));
      }
    }, 30000);
  });
}

class ImpersonatorProvider extends EventEmitter {
  isImpersonator = true;
  isMetaMask = true;

  private address: string;
  private rpcUrl: string;
  private chainId: number;

  constructor(chainId: number, rpcUrl: string, address: string) {
    super();

    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
    this.address = address;
  }

  setAddress = (address: string) => {
    this.address = address;
    this.emit("accountsChanged", [address]);
  };

  setChainId = (chainId: number, rpcUrl: string) => {
    this.rpcUrl = rpcUrl;

    if (this.chainId !== chainId) {
      this.chainId = chainId;
      this.emit("chainChanged", hexValue(chainId));
    }
  };

  // Helper to make RPC calls through the proxy
  private async rpc(method: string, params: any[] = []): Promise<any> {
    return rpcCall(this.rpcUrl, method, params);
  }

  request(request: { method: string; params?: Array<any> }): Promise<any> {
    return this.send(request.method, request.params || []);
  }

  async send(method: string, params?: Array<any>): Promise<any> {
    const throwUnsupported = (message: string): never => {
      return logger.throwError(message, Logger.errors.UNSUPPORTED_OPERATION, {
        method: method,
        params: params,
      });
    };

    let coerce = (value: any) => value;

    switch (method) {
      // modified methods
      case "eth_requestAccounts":
      case "eth_accounts":
        return [this.address];

      case "net_version": {
        return this.chainId;
      }
      case "eth_chainId": {
        return hexValue(this.chainId);
      }
      case "wallet_addEthereumChain":
      case "wallet_switchEthereumChain": {
        // @ts-ignore
        const chainId = Number(params[0].chainId as string);

        const setChainIdPromise = new Promise<null>((resolve, reject) => {
          // send message to content_script (inject.ts) to fetch corresponding RPC
          window.postMessage(
            {
              type: "i_switchEthereumChain",
              msg: {
                chainId,
              },
            },
            "*"
          );

          // receive from content_script (inject.ts)
          const controller = new AbortController();
          window.addEventListener(
            "message",
            (e: any) => {
              // only accept messages from us
              if (e.source !== window) {
                return;
              }

              if (!e.data.type) {
                return;
              }

              switch (e.data.type) {
                case "switchEthereumChain": {
                  const chainId = e.data.msg.chainId as number;
                  const rpcUrl = e.data.msg.rpcUrl as string;
                  (
                    (window as Window).ethereum as ImpersonatorProvider
                  ).setChainId(chainId, rpcUrl);
                  // remove this listener as we already have a listener for "message" and don't want duplicates
                  controller.abort();

                  resolve(null);
                  break;
                }
                case "switchEthereumChainError": {
                  const errorChainId = e.data.msg.chainId as number;
                  // Only handle error for this specific chain switch request
                  if (errorChainId === chainId) {
                    controller.abort();
                    reject(
                      new Error(
                        e.data.msg.error ||
                          `Chain ${chainId} is not supported`
                      )
                    );
                  }
                  break;
                }
              }
            },
            { signal: controller.signal } as AddEventListenerOptions
          );
        });

        await setChainIdPromise;
        return null;
      }
      case "eth_sign":
      case "personal_sign":
      case "eth_signTypedData":
      case "eth_signTypedData_v3":
      case "eth_signTypedData_v4": {
        const sigId = crypto.randomUUID();

        return new Promise<string>((resolve, reject) => {
          // Store callbacks for this signature request
          pendingSignatureCallbacks.set(sigId, { resolve, reject });

          // Send signature request to content script
          window.postMessage(
            {
              type: "i_signatureRequest",
              msg: {
                id: sigId,
                method: method,
                params: params || [],
                chainId: this.chainId,
              },
            },
            "*"
          );
        });
      }
      case "eth_sendTransaction": {
        // Validate chain ID
        if (!ALLOWED_CHAIN_IDS.has(this.chainId)) {
          return logger.throwError(
            `Chain ${this.chainId} not supported. Supported chains: ${Array.from(
              ALLOWED_CHAIN_IDS
            )
              .map((id) => CHAIN_NAMES[id] || id)
              .join(", ")}`,
            Logger.errors.UNSUPPORTED_OPERATION,
            { method, params }
          );
        }

        // @ts-ignore
        const txParams = params[0] as {
          to?: string;
          data?: string;
          value?: string;
          gas?: string;
          gasPrice?: string;
        };

        if (!txParams.to) {
          return logger.throwError(
            "eth_sendTransaction requires 'to' address",
            Logger.errors.INVALID_ARGUMENT,
            { method, params }
          );
        }

        const txId = crypto.randomUUID();

        return new Promise<string>((resolve, reject) => {
          // Store callbacks for this transaction
          pendingTxCallbacks.set(txId, { resolve, reject });

          // Send transaction request to content script
          window.postMessage(
            {
              type: "i_sendTransaction",
              msg: {
                id: txId,
                from: this.address,
                to: txParams.to,
                data: txParams.data || "0x",
                value: txParams.value || "0x0",
                chainId: this.chainId,
              },
            },
            "*"
          );
        });
      }
      // RPC methods - proxied through content script to bypass CSP
      case "eth_gasPrice":
      case "eth_blockNumber":
      case "eth_getBalance":
      case "eth_getStorageAt":
      case "eth_getTransactionCount":
      case "eth_getBlockTransactionCountByHash":
      case "eth_getBlockTransactionCountByNumber":
      case "eth_getCode":
      case "eth_sendRawTransaction":
      case "eth_call":
      case "eth_estimateGas":
      case "estimateGas":
      case "eth_getBlockByHash":
      case "eth_getBlockByNumber":
      case "eth_getTransactionByHash":
      case "eth_getTransactionReceipt":
      case "eth_getUncleCountByBlockHash":
      case "eth_getUncleCountByBlockNumber":
      case "eth_getTransactionByBlockHashAndIndex":
      case "eth_getTransactionByBlockNumberAndIndex":
      case "eth_getUncleByBlockHashAndIndex":
      case "eth_getUncleByBlockNumberAndIndex":
      case "eth_newFilter":
      case "eth_newBlockFilter":
      case "eth_newPendingTransactionFilter":
      case "eth_uninstallFilter":
      case "eth_getFilterChanges":
      case "eth_getFilterLogs":
      case "eth_getLogs":
      case "eth_feeHistory":
      case "eth_maxPriorityFeePerGas": {
        // Forward all RPC calls through the proxy
        return await this.rpc(method, params || []);
      }
    }

    // Default: forward to RPC
    return await this.rpc(method, params || []);
  }
}

// Store the provider instance for EIP-6963 announcements
let providerInstance: ImpersonatorProvider | null = null;

// EIP-6963 provider info
const providerInfo: EIP6963ProviderInfo = {
  uuid: SESSION_UUID,
  name: "Bankr Wallet",
  icon: WALLET_ICON,
  rdns: "bot.bankr.wallet",
};

// Announce provider via EIP-6963
function announceProvider() {
  if (!providerInstance) return;

  const detail: EIP6963ProviderDetail = Object.freeze({
    info: Object.freeze({ ...providerInfo }),
    provider: providerInstance,
  });

  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail,
    }) as EIP6963AnnounceProviderEvent
  );
}

// Listen for EIP-6963 provider requests from dapps
window.addEventListener("eip6963:requestProvider", () => {
  announceProvider();
});

// receive from content_script (inject.ts)
window.addEventListener("message", (e: any) => {
  // only accept messages from us
  if (e.source !== window) {
    return;
  }

  if (!e.data.type) {
    return;
  }

  switch (e.data.type) {
    case "init": {
      const address = e.data.msg.address as string;
      const chainId = e.data.msg.chainId as number;
      const rpcUrl = e.data.msg.rpcUrl as string;
      try {
        const impersonatedProvider = new ImpersonatorProvider(
          chainId,
          rpcUrl,
          address
        );

        // Store for EIP-6963 announcements
        providerInstance = impersonatedProvider;

        // Legacy: Set window.ethereum for backward compatibility
        (window as Window).ethereum = impersonatedProvider;

        // EIP-6963: Announce provider to dapps
        announceProvider();
      } catch (e) {
        console.error("Impersonator Error:", e);
      }

      break;
    }
    case "setAddress": {
      const address = e.data.msg.address as string;
      ((window as Window).ethereum as ImpersonatorProvider).setAddress(address);
      break;
    }
    case "setChainId": {
      const chainId = e.data.msg.chainId as number;
      const rpcUrl = e.data.msg.rpcUrl as string;
      ((window as Window).ethereum as ImpersonatorProvider).setChainId(
        chainId,
        rpcUrl
      );
      break;
    }
    case "sendTransactionResult": {
      const txId = e.data.msg.id as string;
      const callbacks = pendingTxCallbacks.get(txId);
      if (callbacks) {
        pendingTxCallbacks.delete(txId);
        if (e.data.msg.success && e.data.msg.txHash) {
          callbacks.resolve(e.data.msg.txHash);
        } else {
          const errorMessage = e.data.msg.error || "Transaction failed";
          // Check if this is a user rejection (EIP-1193 error code 4001)
          const isUserRejection = errorMessage.toLowerCase().includes("rejected by user") ||
                                   errorMessage.toLowerCase().includes("user rejected") ||
                                   errorMessage.toLowerCase().includes("user denied");
          const error = new Error(errorMessage) as Error & { code: number };
          if (isUserRejection) {
            error.code = 4001; // EIP-1193: User Rejected Request
          }
          callbacks.reject(error);
        }
      }
      break;
    }
    case "signatureRequestResult": {
      const sigId = e.data.msg.id as string;
      const callbacks = pendingSignatureCallbacks.get(sigId);
      if (callbacks) {
        pendingSignatureCallbacks.delete(sigId);
        if (e.data.msg.success && e.data.msg.signature) {
          callbacks.resolve(e.data.msg.signature);
        } else {
          const errorMessage = e.data.msg.error || "Signature request rejected";
          // Check if this is a user rejection (EIP-1193 error code 4001)
          const isUserRejection = errorMessage.toLowerCase().includes("rejected") ||
                                   errorMessage.toLowerCase().includes("cancelled") ||
                                   errorMessage.toLowerCase().includes("denied");
          const error = new Error(errorMessage) as Error & { code: number };
          if (isUserRejection) {
            error.code = 4001; // EIP-1193: User Rejected Request
          }
          callbacks.reject(error);
        }
      }
      break;
    }
    case "rpcResponse": {
      const requestId = e.data.msg.id as string;
      const callbacks = pendingRpcCallbacks.get(requestId);
      if (callbacks) {
        pendingRpcCallbacks.delete(requestId);
        if (e.data.msg.error) {
          callbacks.reject(new Error(e.data.msg.error));
        } else {
          callbacks.resolve(e.data.msg.result);
        }
      }
      break;
    }
  }
});
