import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bankr Coins | WalletChan",
  description:
    "Explore real-time coin launches from the Bankr ecosystem on Base. Review token details and market activity, then connect your wallet to buy supported tokens.",
  openGraph: {
    title: "Bankr Coins | WalletChan",
    description:
      "Explore real-time coin launches from the Bankr ecosystem on Base. Review token details and market activity, then connect your wallet to buy supported tokens.",
    url: "https://coins.walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://coins.walletchan.com/og/coins-og.png",
        width: 1200,
        height: 630,
        alt: "Bankr Coins - WalletChan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "Bankr Coins | WalletChan",
    description:
      "Explore real-time coin launches from the Bankr ecosystem on Base. Review token details and market activity, then connect your wallet to buy supported tokens.",
    images: ["https://coins.walletchan.com/og/coins-og.png"],
  },
};

export default function CoinsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
