import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stake BNKRW | BankrWallet",
  description:
    "Stake your BNKRW tokens to earn yield. Powered by Wasabi on Base.",
  openGraph: {
    title: "Stake BNKRW | BankrWallet",
    description:
      "Stake your BNKRW tokens to earn yield. Powered by Wasabi on Base.",
    url: "https://stake.bankrwallet.app",
    siteName: "BankrWallet",
    type: "website",
    images: [
      {
        url: "https://stake.bankrwallet.app/og/stake-og.png",
        width: 1200,
        height: 630,
        alt: "Stake BNKRW - BankrWallet",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@apoorveth",
    title: "Stake BNKRW | BankrWallet",
    description:
      "Stake your BNKRW tokens to earn yield. Powered by Wasabi on Base.",
    images: ["https://stake.bankrwallet.app/og/stake-og.png"],
  },
};

export default function StakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
