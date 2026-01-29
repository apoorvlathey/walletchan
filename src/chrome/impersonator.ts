import { EventEmitter } from "events";
import { hexValue } from "@ethersproject/bytes";
import { Logger } from "@ethersproject/logger";

const logger = new Logger("ethers/5.7.0");

type Window = Record<string, any>;

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

        const setChainIdPromise = new Promise((resolve) => {
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
              }
            },
            { signal: controller.signal } as AddEventListenerOptions
          );
        });

        await setChainIdPromise;
        return null;
      }
      case "eth_sign": {
        return throwUnsupported("eth_sign not supported");
      }
      case "personal_sign": {
        return throwUnsupported("personal_sign not supported");
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

        (window as Window).ethereum = impersonatedProvider;
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
          callbacks.reject(new Error(e.data.msg.error || "Transaction failed"));
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
