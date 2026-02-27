import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { config } from "./config.js";

const transport = http(config.rpcUrl);

export const account = privateKeyToAccount(config.privateKey);

export const publicClient = createPublicClient({
  chain: base,
  transport,
});

export const walletClient = createWalletClient({
  account,
  chain: base,
  transport,
});
