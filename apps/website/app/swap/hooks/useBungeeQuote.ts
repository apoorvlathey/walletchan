import { useState, useEffect, useCallback, useRef } from "react";
import { parseEther } from "viem";
import {
  NATIVE_TOKEN_ADDRESS,
  SWAP_CHAIN_ID,
  FEE_BPS,
  BUNGEE_BASE_URL,
  BUNGEE_NATIVE_TOKEN,
} from "../constants";
import type { SwapQuote } from "../types";

const FEE_RECIPIENT = process.env.NEXT_PUBLIC_SWAP_FEE_RECIPIENT ?? "";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface UseBungeeQuoteParams {
  sellToken: string;
  buyToken: string;
  sellAmountEth: string;
  taker?: string;
  slippageBps?: number;
  enabled?: boolean;
}

interface BungeeRouteOutput {
  token: Record<string, unknown>;
  amount: string;
  minAmountOut?: string;
}

interface BungeeManualRoute {
  output: BungeeRouteOutput;
  quoteId: string;
  gasFee?: {
    gasAmount?: string;
    feesInUsd?: number;
  };
  routeDetails?: {
    name?: string;
  };
  estimatedTime?: number;
}

interface BungeeQuoteResult {
  input: {
    token: Record<string, unknown>;
    amount: string;
    priceInUsd?: number;
    valueInUsd?: number;
  };
  manualRoutes: BungeeManualRoute[];
  autoRoute?: unknown;
}

interface BungeeBuildTxResult {
  userOp?: string;
  txData: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    type?: string;
  };
  approvalData?: {
    amount: string;
    tokenAddress: string;
    spenderAddress: string;
    userAddress: string;
  } | null;
}

function mapBungeeToSwapQuote(
  route: BungeeManualRoute,
  input: BungeeQuoteResult["input"],
  buyToken: string
): SwapQuote {
  const buyAmount = route.output.amount;
  const minBuyAmount = route.output.minAmountOut ?? buyAmount;

  // Compute integrator fee from the output amount.
  // Bungee deducts fees from output, so the returned amount is post-fee.
  // Pre-fee = buyAmount * 10000 / (10000 - feeBps)
  // Fee = preFee - buyAmount = buyAmount * feeBps / (10000 - feeBps)
  const feeBps = BigInt(FEE_BPS);
  const buyAmountBig = BigInt(buyAmount);
  const feeAmount =
    FEE_RECIPIENT && buyAmountBig > 0n
      ? ((buyAmountBig * feeBps) / (10000n - feeBps)).toString()
      : "0";

  return {
    buyAmount,
    sellAmount: input.amount,
    buyToken,
    sellToken: NATIVE_TOKEN_ADDRESS,
    gas: route.gasFee?.gasAmount ?? "0",
    gasPrice: "0",
    totalNetworkFee: "0",
    liquidityAvailable: true,
    minBuyAmount,
    allowanceTarget: "",
    issues: {},
    fees: {
      integratorFee:
        FEE_RECIPIENT && feeAmount !== "0"
          ? {
              amount: feeAmount,
              token: buyToken,
              type: "integrator",
            }
          : undefined,
    },
    route: {
      fills: [
        {
          from: NATIVE_TOKEN_ADDRESS,
          to: buyToken,
          source: route.routeDetails?.name ?? "Bungee",
          proportionBps: "10000",
        },
      ],
    },
  };
}

export function useBungeeQuote({
  sellToken,
  buyToken,
  sellAmountEth,
  taker,
  slippageBps,
  enabled = true,
}: UseBungeeQuoteParams) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!sellToken || !buyToken || !sellAmountEth || !enabled) {
      setQuote(null);
      setError(null);
      return;
    }

    let sellAmountWei: string;
    try {
      const parsed = parseEther(sellAmountEth);
      if (parsed <= 0n) {
        setQuote(null);
        setError(null);
        return;
      }
      sellAmountWei = parsed.toString();
    } catch {
      setError("Invalid amount");
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const userAddress = taker || ZERO_ADDRESS;
      const slippagePercent =
        slippageBps !== undefined ? (slippageBps / 100).toString() : "5";

      const params = new URLSearchParams({
        userAddress,
        originChainId: SWAP_CHAIN_ID.toString(),
        destinationChainId: SWAP_CHAIN_ID.toString(),
        inputToken: BUNGEE_NATIVE_TOKEN,
        outputToken: buyToken,
        inputAmount: sellAmountWei,
        receiverAddress: userAddress,
        slippage: slippagePercent,
        enableManual: "true",
      });

      if (FEE_RECIPIENT) {
        params.set("feeBps", FEE_BPS);
        params.set("feeTakerAddress", FEE_RECIPIENT);
      }

      const response = await fetch(
        `${BUNGEE_BASE_URL}/api/v1/bungee/quote?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { message?: string }).message ||
            `Bungee API error: ${response.status}`
        );
      }

      const data = (await response.json()) as {
        success: boolean;
        result: BungeeQuoteResult;
      };

      if (
        !data.success ||
        !data.result?.manualRoutes?.length
      ) {
        setError("No routes available for this pair");
        setQuote(null);
      } else {
        const bestRoute = data.result.manualRoutes[0];
        setQuote(mapBungeeToSwapQuote(bestRoute, data.result.input, buyToken));
        setError(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch Bungee price"
      );
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [sellToken, buyToken, sellAmountEth, taker, slippageBps, enabled]);

  // Debounced auto-fetch
  useEffect(() => {
    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [fetchPrice]);

  // Fetch firm quote: get fresh quote + build-tx
  const fetchFirmQuote = useCallback(
    async (takerAddress: string): Promise<SwapQuote | null> => {
      if (!sellToken || !buyToken || !sellAmountEth) return null;

      let sellAmountWei: string;
      try {
        sellAmountWei = parseEther(sellAmountEth).toString();
      } catch {
        return null;
      }

      const slippagePercent =
        slippageBps !== undefined ? (slippageBps / 100).toString() : "5";

      // Step 1: Fresh quote to get a valid quoteId
      const quoteParams = new URLSearchParams({
        userAddress: takerAddress,
        originChainId: SWAP_CHAIN_ID.toString(),
        destinationChainId: SWAP_CHAIN_ID.toString(),
        inputToken: BUNGEE_NATIVE_TOKEN,
        outputToken: buyToken,
        inputAmount: sellAmountWei,
        receiverAddress: takerAddress,
        slippage: slippagePercent,
        enableManual: "true",
      });

      if (FEE_RECIPIENT) {
        quoteParams.set("feeBps", FEE_BPS);
        quoteParams.set("feeTakerAddress", FEE_RECIPIENT);
      }

      const quoteResponse = await fetch(
        `${BUNGEE_BASE_URL}/api/v1/bungee/quote?${quoteParams.toString()}`
      );
      if (!quoteResponse.ok) {
        throw new Error("Failed to get Bungee quote");
      }

      const quoteData = (await quoteResponse.json()) as {
        success: boolean;
        result: BungeeQuoteResult;
      };
      if (
        !quoteData.success ||
        !quoteData.result?.manualRoutes?.length
      ) {
        throw new Error("No routes available");
      }

      const bestRoute = quoteData.result.manualRoutes[0];
      const quoteId = bestRoute.quoteId;

      // Step 2: Build transaction
      const buildResponse = await fetch(
        `${BUNGEE_BASE_URL}/api/v1/bungee/build-tx?quoteId=${encodeURIComponent(quoteId)}`
      );
      if (!buildResponse.ok) {
        throw new Error("Failed to build Bungee transaction");
      }

      const buildData = (await buildResponse.json()) as {
        success: boolean;
        result: BungeeBuildTxResult;
      };
      if (!buildData.result?.txData) {
        throw new Error("No transaction data from Bungee");
      }

      const mapped = mapBungeeToSwapQuote(
        bestRoute,
        quoteData.result.input,
        buyToken
      );

      return {
        ...mapped,
        transaction: {
          to: buildData.result.txData.to,
          data: buildData.result.txData.data,
          value: buildData.result.txData.value ?? "0",
          gas: "0",
          gasPrice: "0",
        },
        issues: buildData.result.approvalData
          ? {
              allowance: {
                spender: buildData.result.approvalData.spenderAddress,
                actual: "0",
                expected: buildData.result.approvalData.amount,
              },
            }
          : {},
      };
    },
    [sellToken, buyToken, sellAmountEth, slippageBps]
  );

  return { quote, isLoading, error, refetch: fetchPrice, fetchFirmQuote };
}
