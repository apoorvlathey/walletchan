import { getStoredNetworksInfo } from "@/lib/chains";
import {
  extractExplorerTransactionHash,
  getExplorerSiteName,
  resolveExplorerTransactionPage,
  type ExplorerTransactionPage,
} from "@/lib/explorerTransaction";
import {
  EXPLORER_ENHANCEMENTS_STORAGE_KEY,
  getExplorerEnhancementsEnabled,
  resolveExplorerEnhancementsEnabled,
} from "@/lib/explorerEnhancementPreference";

const HOST_ID = "walletchan-explorer-transaction";
const MAX_PANEL_HEIGHT = 2_400;
const FALLBACK_PANEL_HEIGHT = 176;
const NAVIGATION_POLL_MS = 400;
let removeMountedFrame: (() => void) | null = null;
let pendingUrl: string | null = null;
let evaluatedUrl: string | null = null;
let dismissedUrl: string | null = null;
let resolvedUrl: string | null = null;
let resolvedPage: ExplorerTransactionPage | null = null;
let explorerEnhancementsEnabled = false;
let explorerPreferenceRevision = 0;

type ExplorerFrameMessage = {
  type?: unknown;
  token?: unknown;
  action?: unknown;
  height?: unknown;
};

type NativeElementState = {
  element: HTMLElement;
  display: string;
  displayPriority: string;
  hidden: boolean;
};

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedText(value: string | null): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return (
    typeof value === "object" &&
    value !== null &&
    "style" in value &&
    "hidden" in value
  );
}

function findInputDataContainer(): HTMLElement | null {
  const rawTab = document.getElementById("rawtab");
  if (isHtmlElement(rawTab?.parentElement)) return rawTab.parentElement;

  const inputData = document.getElementById("inputdata");
  const directColumn = inputData?.closest(".col-md-9");
  if (isHtmlElement(directColumn)) return directColumn;

  const labels = document.querySelectorAll("div, dt, th, td, span");
  for (const label of labels) {
    if (normalizedText(label.textContent) !== "input data:") continue;
    const row = label.closest(".row, tr");
    const value = row?.querySelector(".col-md-9, td:last-child");
    if (isHtmlElement(value)) return value;
  }
  return null;
}

function removeExistingHost(): void {
  removeMountedFrame?.();
  removeMountedFrame = null;
  document.getElementById(HOST_ID)?.remove();
}

async function resolveCurrentPage(
  sourceUrl: string,
): Promise<ExplorerTransactionPage | null> {
  if (resolvedUrl === sourceUrl) return resolvedPage;
  pendingUrl = sourceUrl;
  try {
    const page = resolveExplorerTransactionPage(
      sourceUrl,
      await getStoredNetworksInfo(),
    );
    if (window.location.href === sourceUrl) {
      resolvedUrl = sourceUrl;
      resolvedPage = page;
    }
    return page;
  } finally {
    if (pendingUrl === sourceUrl) pendingUrl = null;
  }
}

function createTab(label: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `tab ${className}`;
  button.setAttribute("role", "tab");
  button.textContent = label;
  return button;
}

function captureNativeElements(container: HTMLElement): NativeElementState[] {
  return Array.from(container.children)
    .filter(
      (element): element is HTMLElement =>
        isHtmlElement(element) && element.id !== HOST_ID,
    )
    .map((element) => ({
      element,
      display: element.style.getPropertyValue("display"),
      displayPriority: element.style.getPropertyPriority("display"),
      hidden: element.hidden,
    }));
}

function refreshNativeElementStates(states: NativeElementState[]): void {
  for (const state of states) {
    state.display = state.element.style.getPropertyValue("display");
    state.displayPriority = state.element.style.getPropertyPriority("display");
    state.hidden = state.element.hidden;
  }
}

function setNativeElementsVisible(
  states: NativeElementState[],
  visible: boolean,
): void {
  for (const state of states) {
    if (!visible) {
      state.element.hidden = true;
      state.element.style.setProperty("display", "none", "important");
      continue;
    }
    state.element.hidden = state.hidden;
    if (state.display) {
      state.element.style.setProperty(
        "display",
        state.display,
        state.displayPriority,
      );
    } else {
      state.element.style.removeProperty("display");
    }
  }
}

function mountInputDataTabs(
  container: HTMLElement,
  sourceUrl: string,
  page: ExplorerTransactionPage,
): void {
  const nativeElements = captureNativeElements(container);
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.display = "block";
  host.style.width = "100%";
  host.style.margin = "0 0 8px";

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; display: block; width: 100%; color-scheme: light dark; }
    .tabs { display: flex; align-items: center; gap: 4px; min-height: 40px; border-bottom: 1px solid rgba(107, 114, 128, .24); font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .tab { appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 12px; margin: 0 0 -1px; border: 0; border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; background: transparent; color: #667085; cursor: pointer; font: inherit; }
    .tab:hover { background: rgba(107, 114, 128, .08); color: #344054; }
    .tab:active { background: rgba(107, 114, 128, .13); }
    .tab:focus-visible { outline: 0; box-shadow: inset 0 0 0 2px #2563eb; }
    .tab[aria-selected="true"] { border-bottom-color: #2563eb; color: #101828; }
    .tab.wallet[aria-selected="true"] { border-bottom-color: #f59e0b; }
    .logo { width: 20px; height: 20px; border-radius: 5px; object-fit: cover; }
    .panel { width: 52%; min-width: 520px; max-width: 880px; margin: 0; }
    .panel[hidden] { display: none; }
    iframe { display: block; width: 100%; height: ${FALLBACK_PANEL_HEIGHT}px; border: 0; background: transparent; }
    @media (max-width: 900px) { .panel { width: 100%; min-width: 0; } }
    :host-context(html[data-bs-theme="dark"]) .tabs { border-bottom-color: rgba(255, 255, 255, .14); }
    :host-context(html[data-bs-theme="dark"]) .tab { color: #98a2b3; }
    :host-context(html[data-bs-theme="dark"]) .tab:hover { background: rgba(255, 255, 255, .06); color: #e4e7ec; }
    :host-context(html[data-bs-theme="dark"]) .tab[aria-selected="true"] { color: #f2f4f7; }
  `;

  const tabList = document.createElement("div");
  tabList.className = "tabs";
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "Transaction input view");
  const explorerTab = createTab(getExplorerSiteName(page.pageUrl), "explorer");
  const walletTab = createTab("WalletChan", "wallet");
  const logo = document.createElement("img");
  logo.className = "logo";
  logo.src = chrome.runtime.getURL("walletchan-icon.png");
  logo.alt = "";
  walletTab.prepend(logo);
  tabList.append(explorerTab, walletTab);

  const framePanel = document.createElement("div");
  framePanel.className = "panel";
  framePanel.setAttribute("role", "tabpanel");
  framePanel.hidden = true;
  shadow.append(style, tabList, framePanel);
  container.insertBefore(host, container.firstChild);

  let frame: HTMLIFrameElement | null = null;
  let token: string | null = null;
  let listening = false;
  const onMessage = (message: ExplorerFrameMessage) => {
    if (
      !token ||
      message?.type !== "EXPLORER_TRANSACTION_FRAME_EVENT" ||
      message.token !== token
    ) {
      return;
    }
    if (message.action === "dismiss") {
      dismissedUrl = sourceUrl;
      setNativeElementsVisible(nativeElements, true);
      if (listening) {
        chrome.runtime.onMessage.removeListener(onMessage);
        listening = false;
      }
      host.remove();
      return;
    }
    if (message.action !== "resize" || !frame) return;
    const height = Number(message.height);
    if (!Number.isFinite(height) || height < 1) return;
    frame.style.height = `${Math.min(Math.ceil(height), MAX_PANEL_HEIGHT)}px`;
  };

  const ensureFrame = () => {
    if (frame) return;
    token = randomToken();
    frame = document.createElement("iframe");
    const frameUrl = new URL(chrome.runtime.getURL("explorer.html"));
    frameUrl.searchParams.set("page", sourceUrl);
    frameUrl.searchParams.set("token", token);
    frame.src = frameUrl.toString();
    frame.title = "WalletChan decoded transaction";
    frame.style.colorScheme = "light dark";
    framePanel.appendChild(frame);
    chrome.runtime.onMessage.addListener(onMessage);
    listening = true;
  };

  let selectedTab: "explorer" | "wallet" = "explorer";
  const selectTab = (selected: "explorer" | "wallet") => {
    const walletSelected = selected === "wallet";
    if (walletSelected && selectedTab !== "wallet") {
      refreshNativeElementStates(nativeElements);
    }
    explorerTab.setAttribute("aria-selected", String(!walletSelected));
    explorerTab.tabIndex = walletSelected ? -1 : 0;
    walletTab.setAttribute("aria-selected", String(walletSelected));
    walletTab.tabIndex = walletSelected ? 0 : -1;
    setNativeElementsVisible(nativeElements, !walletSelected);
    framePanel.hidden = !walletSelected;
    if (walletSelected) ensureFrame();
    selectedTab = selected;
  };

  explorerTab.addEventListener("click", () => selectTab("explorer"));
  walletTab.addEventListener("click", () => selectTab("wallet"));
  for (const [current, other] of [
    [explorerTab, walletTab],
    [walletTab, explorerTab],
  ] as const) {
    current.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      other.click();
      other.focus();
    });
  }
  selectTab("wallet");

  removeMountedFrame = () => {
    setNativeElementsVisible(nativeElements, true);
    if (listening) chrome.runtime.onMessage.removeListener(onMessage);
    host.remove();
  };
}

async function mountExplorerTabs(): Promise<void> {
  if (!explorerEnhancementsEnabled) {
    removeExistingHost();
    return;
  }
  const pathname = window.location.pathname;
  if (
    typeof pathname !== "string" ||
    !extractExplorerTransactionHash(pathname)
  ) {
    removeExistingHost();
    return;
  }

  const sourceUrl = window.location.href;
  const existingHost = document.getElementById(HOST_ID);
  const container = findInputDataContainer();
  if (existingHost && existingHost.parentElement === container) return;
  if (existingHost) removeExistingHost();
  if (!container || dismissedUrl === sourceUrl || evaluatedUrl === sourceUrl) return;
  if (pendingUrl === sourceUrl) return;

  let page: ExplorerTransactionPage | null;
  try {
    page = await resolveCurrentPage(sourceUrl);
  } catch {
    return;
  }
  if (
    !explorerEnhancementsEnabled ||
    !page ||
    window.location.href !== sourceUrl
  ) {
    if (!page) evaluatedUrl = sourceUrl;
    return;
  }
  mountInputDataTabs(container, sourceUrl, page);
  evaluatedUrl = sourceUrl;
}

export function startExplorerTransactionInjection(): void {
  if (window.top !== window) return;
  if (
    typeof document.querySelector !== "function" ||
    typeof document.createElement !== "function" ||
    typeof document.getElementById !== "function"
  ) {
    return;
  }
  let lastUrl = window.location.href;

  const reconcile = () => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      evaluatedUrl = null;
      dismissedUrl = null;
      resolvedUrl = null;
      resolvedPage = null;
      pendingUrl = null;
      removeExistingHost();
    }
    void mountExplorerTabs();
  };

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    const change = changes[EXPLORER_ENHANCEMENTS_STORAGE_KEY];
    if (!change) return;
    explorerPreferenceRevision += 1;
    explorerEnhancementsEnabled = resolveExplorerEnhancementsEnabled(
      change.newValue,
    );
    evaluatedUrl = null;
    dismissedUrl = null;
    reconcile();
  });

  const initialPreferenceRevision = explorerPreferenceRevision;
  void getExplorerEnhancementsEnabled().then((enabled) => {
    if (explorerPreferenceRevision !== initialPreferenceRevision) return;
    explorerEnhancementsEnabled = enabled;
    reconcile();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reconcile, { once: true });
  } else {
    reconcile();
  }
  window.addEventListener("popstate", reconcile);
  window.addEventListener("hashchange", reconcile);
  window.setInterval(() => {
    if (
      lastUrl !== window.location.href ||
      extractExplorerTransactionHash(window.location.pathname)
    ) {
      reconcile();
    }
  }, NAVIGATION_POLL_MS);
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(reconcile).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}
