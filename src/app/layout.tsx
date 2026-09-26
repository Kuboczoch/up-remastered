import type { Metadata } from "next";

import { createSiteMetadata } from "@/config/site-metadata";
import { getPublicOrigin } from "@/server/config/public-url";

import "./globals.css";

export function generateMetadata(): Metadata {
  return createSiteMetadata(getPublicOrigin());
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
