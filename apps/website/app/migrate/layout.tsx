import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Migrate to WCHAN | WalletChan",
  description: "Migrate your BNKRW tokens to WCHAN. 1:1 Wrap",
  openGraph: {
    title: "Migrate to WCHAN | WalletChan",
    description: "Migrate your BNKRW tokens to WCHAN. 1:1 Wrap",
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
    description: "Migrate your BNKRW tokens to WCHAN. 1:1 Wrap",
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
