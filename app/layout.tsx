import type { Metadata } from "next";
import { headers } from "next/headers";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="de"
      className="h-full antialiased"
    >
      {/* ui-sdk adds its few rules of CSS as a style element, which the policy only lets in with the nonce. */}
      <head><meta property="csp-nonce" nonce={nonce} /></head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
