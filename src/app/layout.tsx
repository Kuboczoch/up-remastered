import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "up - remastered",
  description: "Small self-hosted temporary file hosting service.",
};

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
