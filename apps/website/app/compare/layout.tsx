import { Metadata } from "next";

const title = "Wallet Tokens Leaderboard | WalletChan";
const description =
  "Compare wallet token market caps. See where WCHAN ranks against other wallet tokens like TWT, WCT, and more.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "https://compare.walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://compare.walletchan.com/og/compare-og.png",
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["https://compare.walletchan.com/og/compare-og.png"],
  },
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
