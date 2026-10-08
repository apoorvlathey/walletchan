import type { Metadata } from "next";
import BunkerMode from "./BunkerMode";
export const metadata: Metadata = {
  metadataBase: new URL("https://walletchan.com"),
  title: "Bunker Mode | WalletChan",
  description:
    "Is your address bunker ready? Check signing activity across WalletChan mainnets and make your own share card. No wallet connection needed.",
  alternates: { canonical: "https://walletchan.com/bunker-mode" },
  openGraph: {
    title: "Is your address bunker ready?",
    description: "One address. 25 networks. Check your onchain signal.",
    url: "https://walletchan.com/bunker-mode",
    images: [{ url: "/bunker-mode/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Is your address bunker ready?",
    description: "Check your onchain signal with WalletChan.",
    images: ["/bunker-mode/opengraph-image"],
  },
};
export default function Page() {
  return <BunkerMode />;
}
