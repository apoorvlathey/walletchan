import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stake WCHAN | WalletChan",
  description:
    "Stake your WCHAN tokens to earn yield on Base. Earn WCHAN + WETH rewards.",
  openGraph: {
    title: "Stake WCHAN | WalletChan",
    description:
      "Stake your WCHAN tokens to earn yield on Base. Earn WCHAN + WETH rewards.",
    url: "https://stake.walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://stake.walletchan.com/og/stake-og.png",
        width: 1200,
        height: 630,
        alt: "Stake WCHAN - WalletChan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "Stake WCHAN | WalletChan",
    description:
      "Stake your WCHAN tokens to earn yield on Base. Earn WCHAN + WETH rewards.",
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
