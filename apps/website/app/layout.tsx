import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BankrWallet - Pull Your Bankr Bot Into Any Dapp",
  description:
    "Browser extension that brings your Bankr terminal wallet to any dapp. AI-powered transactions, multi-chain support, no seed phrases needed.",
  openGraph: {
    title: "BankrWallet",
    description: "Pull your Bankr wallet into any dapp, like MetaMask!",
    url: "https://bankrwallet.app",
    siteName: "BankrWallet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@apoorveth",
    title: "BankrWallet",
    description: "Pull your Bankr wallet into any dapp, like MetaMask!",
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
