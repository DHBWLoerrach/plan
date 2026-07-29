import type { Metadata } from "next";

import { productDescription, productName, productionOrigin } from "@/lib/product";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(productionOrigin),
  applicationName: productName,
  title: {
    default: productName,
    template: `%s | ${productName}`,
  },
  description: productDescription,
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    siteName: productName,
    title: productName,
    description: productDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
