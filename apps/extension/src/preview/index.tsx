import React from "react";
import { createRoot } from "react-dom/client";
import { ColorModeScript } from "@chakra-ui/react";
import { ThemeProvider } from "@/theme";
import { NetworksProvider } from "@/contexts/NetworksContext";
import { bootstrapThemeAttribute } from "@/theme/bootstrap";
import { SELECTED_THEME_STORAGE_KEY } from "@/theme";
import { installPreviewChrome } from "./previewChrome";
import PreviewApp from "./PreviewApp";
import { parsePreviewState } from "./previewState";
import "../index.css";
import "./preview.css";

const parsedPreviewState = parsePreviewState(window.location.href);
const previewTheme = parsedPreviewState.state.route === "onboarding"
  ? "midnight"
  : parsedPreviewState.state.theme;
window.localStorage.setItem(
  SELECTED_THEME_STORAGE_KEY,
  previewTheme,
);
installPreviewChrome();
void chrome.storage.local.set({
  [SELECTED_THEME_STORAGE_KEY]: previewTheme,
});
document.body.classList.toggle("preview-canvas", parsedPreviewState.canvas);
bootstrapThemeAttribute();

createRoot(document.getElementById("preview-root")!).render(
  <ThemeProvider fixedThemeId={parsedPreviewState.state.route === "onboarding" ? "midnight" : undefined}>
    <NetworksProvider>
      <ColorModeScript />
      <PreviewApp />
    </NetworksProvider>
  </ThemeProvider>,
);
