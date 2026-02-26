import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stake BNKRW | WalletChan",
  description:
    "Stake your BNKRW tokens to earn yield. Powered by Wasabi on Base.",
  openGraph: {
    title: "Stake BNKRW | WalletChan",
    description:
      "Stake your BNKRW tokens to earn yield. Powered by Wasabi on Base.",
    url: "https://stake.walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://stake.walletchan.com/og/stake-og.png",
        width: 1200,
        height: 630,
        alt: "Stake BNKRW - WalletChan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "Stake BNKRW | WalletChan",
    description:
      "Stake your BNKRW tokens to earn yield. Powered by Wasabi on Base.",
    images: ["https://stake.walletchan.com/og/stake-og.png"],
  },
};

export default function StakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
