import { InterfaceAbi } from "ethers";

interface ContractResult {
  ABI: string;
  ContractName: string;
  Implementation: string;
}

interface ContractResponse {
  status: string;
  message: string;
  result: ContractResult[];
}

export async function fetchContractAbi({
  address,
  chainId,
}: {
  address: string;
  chainId: number;
}): Promise<{ abi: InterfaceAbi; name: string }> {
  const res = await fetch(
    `https://eth.sh/api/source-code?address=${address}&chainId=${chainId}`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch ABI for ${address} on chain ${chainId}`);
  }

  const data: ContractResponse = await res.json();

  if (
    !data.result ||
    !Array.isArray(data.result) ||
    data.result.length === 0
  ) {
    throw new Error(`No ABI found for ${address} on chain ${chainId}`);
  }

  const { ABI, ContractName, Implementation } = data.result[0];

  // If the contract is a proxy, fetch the implementation ABI
  if (Implementation && Implementation.length > 0) {
    const implRes = await fetch(
      `https://eth.sh/api/source-code?address=${Implementation}&chainId=${chainId}`
    );

    if (implRes.ok) {
      const implData: ContractResponse = await implRes.json();
      if (
        implData.result &&
        Array.isArray(implData.result) &&
        implData.result.length > 0
      ) {
        const { ABI: implAbi, ContractName: implName } = implData.result[0];
        return { abi: JSON.parse(implAbi), name: implName };
      }
    }
  }

  return { abi: JSON.parse(ABI), name: ContractName };
}
