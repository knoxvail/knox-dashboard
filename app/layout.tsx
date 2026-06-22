import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KNOX // DASHBOARD",
};

// Render on every request (server-rendered, not statically prerendered/cached)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
