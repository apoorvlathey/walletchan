import { useState, useEffect, useCallback, useRef } from "react";
import { parseEther } from "viem";
import {
  NATIVE_TOKEN_ADDRESS,
  SWAP_CHAIN_ID,
  FEE_BPS,
  RELAY_BASE_URL,
  RELAY_NATIVE_TOKEN,
} from "../constants";
import type { SwapQuote } from "../types";

const FEE_RECIPIENT = process.env.NEXT_PUBLIC_SWAP_FEE_RECIPIENT ?? "";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface UseRelayQuoteParams {
  sellToken: string;
  buyToken: string;
  sellAmountEth: string;
  taker?: string;
  slippageBps?: number;
  enabled?: boolean;
}

// --- Relay API response types ---

interface RelayCurrency {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface RelayFeeItem {
  currency: RelayCurrency;
  amount: string;
  amountFormatted: string;
  amountUsd: string;
}

interface RelayFees {
  gas: RelayFeeItem;
  relayer: RelayFeeItem;
  relayerGas: RelayFeeItem;
  relayerService: RelayFeeItem;
  app: RelayFeeItem;
}

interface RelayCurrencyAmount {
  currency: RelayCurrency;
  amount: string;
  amountFormatted: string;
  amountUsd: string;
  minimumAmount?: string;
}

interface RelayDetails {
  operation: string;
  currencyIn: RelayCurrencyAmount;
  currencyOut: RelayCurrencyAmount;
  rate: string;
  timeEstimate: number;
  slippageTolerance: {
    origin: { percent: number };
    destination: { percent: number };
  };
  route?: {
    swaps?: Array<{
      router?: string;
    }>;
  };
}

interface RelayStepItem {
  status: string;
  data: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  };
}

interface RelayStep {
  id: string;
  action: string;
  description: string;
  kind: string;
  requestId: string;
  items: RelayStepItem[];
}

interface RelayQuoteResponse {
  steps: RelayStep[];
  fees: RelayFees;
  details: RelayDetails;
}

function mapRelayToSwapQuote(
  response: RelayQuoteResponse,
  buyToken: string
): SwapQuote {
  const { details, fees, steps } = response;

  const buyAmount = details.currencyOut.amount;
  const minBuyAmount = details.currencyOut.minimumAmount ?? buyAmount;
  const sellAmount = details.currencyIn.amount;

  // Find the transaction step (swap, deposit, or send)
  const txStep = steps.find((s) => s.kind === "transaction");
  const txData = txStep?.items?.[0]?.data;

  // Map app fee to integratorFee
  const hasAppFee = fees.app && BigInt(fees.app.amount || "0") > 0n;

  return {
    buyAmount,
    sellAmount,
    buyToken,
    sellToken: NATIVE_TOKEN_ADDRESS,
    gas: fees.gas?.amount ?? "0",
    gasPrice: "0",
    totalNetworkFee: "0",
    liquidityAvailable: steps.length > 0,
    minBuyAmount,
    allowanceTarget: "",
    issues: {},
    fees: {
      integratorFee: hasAppFee
        ? {
            amount: fees.app.amount,
            token: fees.app.currency.address,
            type: "integrator",
          }
        : undefined,
    },
    route: {
      fills: [
        {
          from: NATIVE_TOKEN_ADDRESS,
          to: buyToken,
          source: "Relay",
          proportionBps: "10000",
        },
      ],
    },
    // Include transaction data if available (for firm quotes)
    ...(txData
      ? {
          transaction: {
            to: txData.to,
            data: txData.data,
            value: txData.value ?? "0",
            gas: "0",
            gasPrice: "0",
          },
        }
      : {}),
  };
}

function buildQuoteBody(
  buyToken: string,
  sellAmountWei: string,
  userAddress: string,
  slippageBps?: number
) {
  const body: Record<string, unknown> = {
    user: userAddress,
    originChainId: SWAP_CHAIN_ID,
    destinationChainId: SWAP_CHAIN_ID,
    originCurrency: RELAY_NATIVE_TOKEN,
    destinationCurrency: buyToken,
    amount: sellAmountWei,
    tradeType: "EXACT_INPUT",
  };

  if (slippageBps !== undefined) {
    body.slippageTolerance = slippageBps.toString();
  }

  if (FEE_RECIPIENT) {
    body.appFees = [{ recipient: FEE_RECIPIENT, fee: FEE_BPS }];
  }

  return body;
}

export function useRelayQuote({
  sellToken,
  buyToken,
  sellAmountEth,
  taker,
  slippageBps,
  enabled = true,
}: UseRelayQuoteParams) {
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
      const body = buildQuoteBody(buyToken, sellAmountWei, userAddress, slippageBps);

      const response = await fetch(`${RELAY_BASE_URL}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { message?: string }).message ||
            `Relay API error: ${response.status}`
        );
      }

      const data = (await response.json()) as RelayQuoteResponse;

      if (!data.steps?.length) {
        setError("No routes available for this pair");
        setQuote(null);
      } else {
        setQuote(mapRelayToSwapQuote(data, buyToken));
        setError(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch Relay price"
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

  // Fetch firm quote: re-fetch with real taker address (quotes expire ~30s)
  const fetchFirmQuote = useCallback(
    async (takerAddress: string): Promise<SwapQuote | null> => {
      if (!sellToken || !buyToken || !sellAmountEth) return null;

      let sellAmountWei: string;
      try {
        sellAmountWei = parseEther(sellAmountEth).toString();
      } catch {
        return null;
      }

      const body = buildQuoteBody(buyToken, sellAmountWei, takerAddress, slippageBps);

      const response = await fetch(`${RELAY_BASE_URL}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { message?: string }).message ||
            "Failed to get Relay quote"
        );
      }

      const data = (await response.json()) as RelayQuoteResponse;

      if (!data.steps?.length) {
        throw new Error("No routes available");
      }

      return mapRelayToSwapQuote(data, buyToken);
    },
    [sellToken, buyToken, sellAmountEth, slippageBps]
  );

  return { quote, isLoading, error, refetch: fetchPrice, fetchFirmQuote };
}
