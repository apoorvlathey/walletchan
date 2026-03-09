import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim on Mainnet | WalletChan",
  description:
    "Prove and finalize your Base to Ethereum withdrawals. Claim your WCHAN tokens on Ethereum Mainnet.",
  openGraph: {
    title: "Claim on Mainnet | WalletChan",
    description:
      "Prove and finalize your Base to Ethereum withdrawals. Claim your WCHAN tokens on Ethereum Mainnet.",
    url: "https://mainnet.walletchan.com/claim",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://walletchan.com/og/home-og.png",
        width: 1200,
        height: 630,
        alt: "Claim on Mainnet - WalletChan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "Claim on Mainnet | WalletChan",
    description:
      "Prove and finalize your Base to Ethereum withdrawals. Claim your WCHAN tokens on Ethereum Mainnet.",
    images: ["https://walletchan.com/og/home-og.png"],
  },
};

export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
