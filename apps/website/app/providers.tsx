"use client";

import { ChakraProvider } from "@chakra-ui/react";
import theme from "@/theme";
import { TokenDataProvider } from "./contexts/TokenDataContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      <TokenDataProvider>{children}</TokenDataProvider>
    </ChakraProvider>
  );
}
