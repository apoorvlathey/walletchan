import type { Metadata } from "next";
import { Providers } from "./providers";
import { Analytics } from "./components/Analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "WalletChan - The Wallet for AI Era",
  description:
    "Browser extension that brings your Bankr terminal wallet to any dapp. AI-powered transactions, multi-chain support, no seed phrases needed.",
  icons: {
    icon: "/images/walletchan-icon.png",
    apple: "/images/walletchan-icon.png",
  },
  openGraph: {
    title: "WalletChan",
    description: "The Wallet for AI Era",
    url: "https://walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://walletchan.com/og/home-og.png",
        width: 1200,
        height: 630,
        alt: "WalletChan - The Wallet for AI Era",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "WalletChan",
    description: "The Wallet for AI Era",
    images: ["https://walletchan.com/og/home-og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Analytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
