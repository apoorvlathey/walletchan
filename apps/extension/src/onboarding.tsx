import React from "react";
import ReactDOM from "react-dom";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "./theme";
import "./onboarding.css";
import Onboarding from "./pages/Onboarding";

ReactDOM.render(
  <ChakraProvider theme={theme}>
    <Onboarding
      onComplete={() => {
        // Tab will be closed when user opens the extension popup
      }}
    />
  </ChakraProvider>,
  document.getElementById("onboarding-root")
);
