import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stake WCHAN | WalletChan",
  description:
    "Stake WCHAN in the Base vault through WalletChan. Review your balance, vault shares, and WCHAN or WETH rewards before depositing or withdrawing tokens.",
  openGraph: {
    title: "Stake WCHAN | WalletChan",
    description:
      "Stake WCHAN in the Base vault through WalletChan. Review your balance, vault shares, and WCHAN or WETH rewards before depositing or withdrawing tokens.",
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
      "Stake WCHAN in the Base vault through WalletChan. Review your balance, vault shares, and WCHAN or WETH rewards before depositing or withdrawing tokens.",
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
