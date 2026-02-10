import { useReadContracts } from "wagmi";
import { erc20Abi, type Address } from "viem";
import { base } from "wagmi/chains";
import { NATIVE_TOKEN_ADDRESS } from "../constants";

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

export function useTokenInfo(tokenAddress: string | undefined) {
  const isNative =
    tokenAddress?.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
  const isValidAddress =
    tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(tokenAddress) && !isNative;

  const { data, isLoading, error } = useReadContracts({
    contracts: isValidAddress
      ? [
          {
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: "name",
            chainId: base.id,
          },
          {
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: "symbol",
            chainId: base.id,
          },
          {
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: "decimals",
            chainId: base.id,
          },
        ]
      : undefined,
    query: {
      enabled: !!isValidAddress,
    },
  });

  if (isNative) {
    return {
      tokenInfo: { name: "Ether", symbol: "ETH", decimals: 18 } as TokenInfo,
      isLoading: false,
      error: null,
    };
  }

  const tokenInfo: TokenInfo | null =
    data &&
    data[0].status === "success" &&
    data[1].status === "success" &&
    data[2].status === "success"
      ? {
          name: data[0].result as string,
          symbol: data[1].result as string,
          decimals: data[2].result as number,
        }
      : null;

  return { tokenInfo, isLoading, error };
}
