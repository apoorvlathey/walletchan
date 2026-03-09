import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bridge WCHAN to Mainnet | WalletChan",
  description:
    "Bridge your WCHAN tokens from Base to Ethereum Mainnet. Track withdrawals and claim on L1.",
  openGraph: {
    title: "Bridge WCHAN to Mainnet | WalletChan",
    description:
      "Bridge your WCHAN tokens from Base to Ethereum Mainnet. Track withdrawals and claim on L1.",
    url: "https://mainnet.walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://walletchan.com/og/home-og.png",
        width: 1200,
        height: 630,
        alt: "Bridge WCHAN to Mainnet - WalletChan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "Bridge WCHAN to Mainnet | WalletChan",
    description:
      "Bridge your WCHAN tokens from Base to Ethereum Mainnet. Track withdrawals and claim on L1.",
    images: ["https://walletchan.com/og/home-og.png"],
  },
};

export default function MainnetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
