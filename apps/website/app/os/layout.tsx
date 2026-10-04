import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WalletChan OS — Web3 Operating System",
  description:
    "Explore WalletChan OS, a web3 desktop for browsing your favorite dapps. Open apps, swap, stake, and manage your workspace from one browser interface.",
  openGraph: {
    title: "WalletChan OS — Web3 Operating System",
    description:
      "Explore WalletChan OS, a web3 desktop for browsing your favorite dapps. Open apps, swap, stake, and manage your workspace from one browser interface.",
    url: "https://os.walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://os.walletchan.com/api/og/os",
        width: 1200,
        height: 630,
        alt: "WalletChan OS — Web3 Operating System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "WalletChan OS — Web3 Operating System",
    description:
      "Explore WalletChan OS, a web3 desktop for browsing your favorite dapps. Open apps, swap, stake, and manage your workspace from one browser interface.",
    images: ["https://os.walletchan.com/api/og/os"],
  },
};

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
