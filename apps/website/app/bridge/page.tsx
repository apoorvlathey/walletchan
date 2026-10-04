import BridgeContent from "./BridgeContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bridge | WalletChan",
  description: "Bridge tokens between supported chains through Socket in WalletChan. Compare available routes, review transfer details, and connect a wallet to proceed.",
};

export default function BridgePage() {
  return <BridgeContent />;
}
