// Dynamic declarativeNetRequest rules that intercept `*.eth` / `*.gwei`
// navigations and bounce them to the extension's interstitial page with the
// original URL preserved in the fragment. The interstitial then messages the
// SW to do the actual name resolution.
//
// Why DNR instead of webNavigation: DNR is silent on install (no permission
// warning); webNavigation triggers "Read your browsing history" on update,
// which would disable the extension for every existing user until they
// re-approve. DNR lets us ship default-ON with zero permission UX.

const ETH_REDIRECT_RULE_ID = 1001;
const ETH_GATEWAY_REDIRECT_RULE_ID = 1002;
const ETH_GATEWAY_BYPASS_RULE_ID = 1003;
const W3ETH_REDIRECT_RULE_ID = 1004;
const W3ETH_BYPASS_RULE_ID = 1005;
const W3LINK_REDIRECT_RULE_ID = 1006;
const GWEI_DOMAINS_REDIRECT_RULE_ID = 1009;
const GWEI_DOMAINS_BYPASS_RULE_ID = 1010;
const WEI_GATEWAY_REDIRECT_RULE_ID = 1011;
const WEI_GATEWAY_BYPASS_RULE_ID = 1012;
const WEI_GATEWAY_REGEX =
  "^https?://(?:[a-z0-9-]+\\.)+wei\\.(?:limo|domains)\\.?(?::\\d+)?(?:/.*)?$";

// Any host ending in `.eth` or `.gwei` (first-level or arbitrary subdomain).
// Excludes hosted gateways by construction: those hosts end in `.limo`,
// `.domains`, or `.io`, not `.eth` / `.gwei`.
const NAME_REGEX =
  "^https?://(?:[a-z0-9-]+\\.)+(?:eth|gwei|wei)\\.?(?::\\d+)?(?:/.*)?$";

// Match `<label>.eth.limo` / `<label>.eth.link` and capture the label + path.
// We rewrite to `http://<label>.eth<path>` so the base name rule catches
// the result on the next pass and routes through our interstitial. This gives
// the user our verified-RPC resolution + local gateway path instead of the
// public eth.limo / eth.link gateways.
const ETH_GATEWAY_REGEX =
  "^https?://([a-z0-9-]+(?:\\.[a-z0-9-]+)*)\\.eth\\.(?:limo|link)\\.?(?::\\d+)?(/.*)?$";

// Match `<label>.gwei.domains` and capture the label + path. We rewrite to
// `http://<label>.gwei<path>` so NAME_REGEX catches the result on the next pass.
const GWEI_DOMAINS_REGEX =
  "^https?://([a-z0-9-]+(?:\\.[a-z0-9-]+)*)\\.gwei\\.domains\\.?(?::\\d+)?(/.*)?$";

// Match `<label>.w3eth.io` (the ERC-4804 hosted gateway). w3eth.io strips the
// `.eth` suffix from the ENS name (`vitalik.eth` → `vitalik.w3eth.io`), so we
// rewrite back to `http://<label>.eth<path>` and let the base name rule route it
// through the interstitial. We only install this rule when the local Kubo
// pinning path is fully enabled — otherwise resolveAndRedirect would route
// the request right back to w3eth.io and bounce indefinitely.
const W3ETH_REGEX =
  "^https?://([a-z0-9-]+(?:\\.[a-z0-9-]+)*)\\.w3eth\\.io\\.?(?::\\d+)?(/.*)?$";

// Match w3link's ERC-4804 mainnet gateway shape:
// `<0x-address>.1.w3link.io`. The middle label is the chain id; this resolver
// currently reads ERC-4804 from Ethereum mainnet only, so we intentionally
// accept chain id 1 rather than every numeric chain label.
const W3LINK_MAINNET_REGEX =
  "^https?://(0x[a-f0-9]{40})\\.1\\.w3link\\.io\\.?(?::\\d+)?(/.*)?$";

// Keep each released rule ID and pattern stable while sharing rule construction.
async function installRedirect(
  id: number,
  regexFilter: string,
  regexSubstitution = `${chrome.runtime.getURL("interstitial.html")}#\\0`,
  priority = 1,
): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [id],
    addRules: [
      {
        id,
        priority,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: { regexSubstitution },
        },
        condition: {
          regexFilter,
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
        },
      },
    ],
  });
}

async function removeRedirect(id: number): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [id],
  });
}

// Priority 3 ALLOW applies only to the chosen gateway family and tab. It wins
// over the gateway redirect (1) and native-name redirect (2).
async function updateBypass(
  id: number,
  regexFilter: string,
  tabId: number,
  add: boolean,
): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const current = rules.find((rule) => rule.id === id)?.condition.tabIds ?? [];
  if (current.includes(tabId) === add) return;
  const tabIds = add
    ? [...current, tabId]
    : current.filter((value) => value !== tabId);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [id],
    addRules: tabIds.length
      ? [
          {
            id,
            priority: 3,
            action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
            condition: {
              regexFilter,
              tabIds,
              resourceTypes: [
                chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              ],
            },
          },
        ]
      : [],
  });
}

export async function hasEthRedirectRule(): Promise<boolean> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.some((rule) => rule.id === ETH_REDIRECT_RULE_ID);
}

export const installEthRedirectRule = (): Promise<void> =>
  installRedirect(ETH_REDIRECT_RULE_ID, NAME_REGEX, undefined, 2);
export const removeEthRedirectRule = (): Promise<void> =>
  removeRedirect(ETH_REDIRECT_RULE_ID);

export const installEthGatewayRedirectRule = (): Promise<void> =>
  installRedirect(
    ETH_GATEWAY_REDIRECT_RULE_ID,
    ETH_GATEWAY_REGEX,
    "http://\\1.eth\\2",
  );
export const removeEthGatewayRedirectRule = (): Promise<void> =>
  removeRedirect(ETH_GATEWAY_REDIRECT_RULE_ID);
export const addEthGatewayBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(ETH_GATEWAY_BYPASS_RULE_ID, ETH_GATEWAY_REGEX, tabId, true);
export const removeEthGatewayBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(ETH_GATEWAY_BYPASS_RULE_ID, ETH_GATEWAY_REGEX, tabId, false);

export const installGweiDomainsRedirectRule = (): Promise<void> =>
  installRedirect(
    GWEI_DOMAINS_REDIRECT_RULE_ID,
    GWEI_DOMAINS_REGEX,
    "http://\\1.gwei\\2",
  );
export const removeGweiDomainsRedirectRule = (): Promise<void> =>
  removeRedirect(GWEI_DOMAINS_REDIRECT_RULE_ID);
export const addGweiDomainsBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(GWEI_DOMAINS_BYPASS_RULE_ID, GWEI_DOMAINS_REGEX, tabId, true);
export const removeGweiDomainsBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(GWEI_DOMAINS_BYPASS_RULE_ID, GWEI_DOMAINS_REGEX, tabId, false);

export const installW3linkRedirectRule = (): Promise<void> =>
  installRedirect(W3LINK_REDIRECT_RULE_ID, W3LINK_MAINNET_REGEX);
export const removeW3linkRedirectRule = (): Promise<void> =>
  removeRedirect(W3LINK_REDIRECT_RULE_ID);

export const installW3ethRedirectRule = (): Promise<void> =>
  installRedirect(W3ETH_REDIRECT_RULE_ID, W3ETH_REGEX, "http://\\1.eth\\2");
export const removeW3ethRedirectRule = (): Promise<void> =>
  removeRedirect(W3ETH_REDIRECT_RULE_ID);
export const addW3ethBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(W3ETH_BYPASS_RULE_ID, W3ETH_REGEX, tabId, true);
export const removeW3ethBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(W3ETH_BYPASS_RULE_ID, W3ETH_REGEX, tabId, false);

export const installWeiGatewayRedirectRule = (): Promise<void> =>
  installRedirect(WEI_GATEWAY_REDIRECT_RULE_ID, WEI_GATEWAY_REGEX);
export const removeWeiGatewayRedirectRule = (): Promise<void> =>
  removeRedirect(WEI_GATEWAY_REDIRECT_RULE_ID);
export const addWeiGatewayBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(WEI_GATEWAY_BYPASS_RULE_ID, WEI_GATEWAY_REGEX, tabId, true);
export const removeWeiGatewayBypassForTab = (tabId: number): Promise<void> =>
  updateBypass(WEI_GATEWAY_BYPASS_RULE_ID, WEI_GATEWAY_REGEX, tabId, false);
