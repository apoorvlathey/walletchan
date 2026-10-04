import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Migrate to WCHAN | WalletChan",
  description: "Migrate BNKRW tokens to WCHAN with the WalletChan 1:1 wrap interface. Connect your wallet, review your balance, and check the migration details before approving.",
  openGraph: {
    title: "Migrate to WCHAN | WalletChan",
    description: "Migrate BNKRW tokens to WCHAN with the WalletChan 1:1 wrap interface. Connect your wallet, review your balance, and check the migration details before approving.",
    url: "https://migrate.walletchan.com",
    siteName: "WalletChan",
    type: "website",
    images: [
      {
        url: "https://migrate.walletchan.com/og/migrate-og.png",
        width: 1200,
        height: 630,
        alt: "Migrate to WCHAN - WalletChan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@walletchan_",
    title: "Migrate to WCHAN | WalletChan",
    description: "Migrate BNKRW tokens to WCHAN with the WalletChan 1:1 wrap interface. Connect your wallet, review your balance, and check the migration details before approving.",
    images: ["https://migrate.walletchan.com/og/migrate-og.png"],
  },
};

export default function MigrateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
