import type { Metadata } from "next";
import type { ReactNode } from "react";
import {EbayEnvironmentIndicator} from "@/app/ebay-environment-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "eBay UI App",
  description: "Local-only inventory manager UI for eBay workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <EbayEnvironmentIndicator />
        {children}
      </body>
    </html>
  );
}
