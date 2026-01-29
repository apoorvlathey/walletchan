import React from "react";
import ReactDOM from "react-dom";
import Confirmation from "./pages/Confirmation";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "./theme";

ReactDOM.render(
  <ChakraProvider theme={theme}>
    <Confirmation />
  </ChakraProvider>,
  document.getElementById("root")
);
