import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "./theme";
import "./index.css";
import { NetworksProvider } from "@/contexts/NetworksContext";

ReactDOM.render(
  <ChakraProvider theme={theme}>
    <NetworksProvider>
      <App />
    </NetworksProvider>
  </ChakraProvider>,
  document.getElementById("root")
);
