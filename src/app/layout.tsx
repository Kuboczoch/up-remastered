import type { Metadata, Viewport } from "next";

import { createSiteMetadata } from "@/config/site-metadata";
import { getPublicOrigin } from "@/server/config/public-url";

import "./globals.css";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#202127",
};

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
