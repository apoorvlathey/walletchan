import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bankr Coins | WalletChan",
  description:
    "Real-time coin launches from the Bankr Ecosystem. Buy tokens instantly on Base.",
  openGraph: {
    title: "Bankr Coins | WalletChan",
    description:
      "Real-time coin launches from the Bankr Ecosystem. Buy tokens instantly on Base.",
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
    site: "@apoorveth",
    title: "Bankr Coins | WalletChan",
    description:
      "Real-time coin launches from the Bankr Ecosystem. Buy tokens instantly on Base.",
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
