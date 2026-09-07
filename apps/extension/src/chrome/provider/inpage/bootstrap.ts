import { installDappRpcDiscovery } from "../../dapp/rpcForwarding";
import { installProviderAnnouncementListener } from "./announcement";
import { useSameOriginTopProvider } from "./sameOriginFrame";
import { installContentResultRouter } from "./resultRouter";

export function startInpageProvider(): void {
  installProviderAnnouncementListener();
  if (useSameOriginTopProvider()) return;
  installDappRpcDiscovery();
  installContentResultRouter();
}
