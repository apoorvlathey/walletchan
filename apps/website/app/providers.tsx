"use client";

import { ChakraProvider } from "@chakra-ui/react";
import theme from "@/theme";
import { TokenDataProvider } from "./contexts/TokenDataContext";
import { VaultDataProvider } from "./contexts/VaultDataContext";

import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "./wagmiConfig";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider modalSize="compact">
            <TokenDataProvider>
              <VaultDataProvider>{children}</VaultDataProvider>
            </TokenDataProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ChakraProvider>
  );
}
