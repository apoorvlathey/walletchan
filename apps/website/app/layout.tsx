import type { Metadata } from "next";
import { Providers } from "./providers";
import { Analytics } from "./components/Analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "BankrWallet - Your Bankr Wallet, Anywhere",
  description:
    "Browser extension that brings your Bankr terminal wallet to any dapp. AI-powered transactions, multi-chain support, no seed phrases needed.",
  icons: {
    icon: "/images/bankrwallet-icon.png",
    apple: "/images/bankrwallet-icon.png",
  },
  openGraph: {
    title: "BankrWallet",
    description: "Your Bankr wallet, anywhere!",
    url: "https://bankrwallet.app",
    siteName: "BankrWallet",
    type: "website",
    images: [
      {
        url: "https://bankrwallet.app/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "BankrWallet - Your Bankr Wallet, Anywhere",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@apoorveth",
    title: "BankrWallet",
    description: "Your Bankr wallet, anywhere!",
    images: ["https://bankrwallet.app/images/og-image.png"],
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
