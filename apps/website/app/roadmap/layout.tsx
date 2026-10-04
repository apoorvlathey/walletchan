import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://walletchan.com/roadmap" },
  title: "Roadmap | WalletChan",
  description:
    "Explore shipped features and upcoming work for WalletChan, the Ethereum and EVM browser wallet for clear signing, dapp connections, swaps, and bridges.",
  openGraph: {
    title: "Roadmap | WalletChan",
    description:
      "Explore shipped features and upcoming work for WalletChan, the Ethereum and EVM browser wallet for clear signing, dapp connections, swaps, and bridges.",
    url: "https://walletchan.com/roadmap",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://walletchan.com/api/og/roadmap",
        width: 1200,
        height: 630,
        alt: "WalletChan Roadmap",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "Roadmap | WalletChan",
    description:
      "Explore shipped features and upcoming work for WalletChan, the Ethereum and EVM browser wallet for clear signing, dapp connections, swaps, and bridges.",
    images: ["https://walletchan.com/api/og/roadmap"],
  },
};

export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
