import "./globals.css"; // <-- CRITICAL: Make sure this import exists at the very top!
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transcend Inventory Console",
  description: "Enterprise Sourcing Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}