import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "darkside — MMP Uncloaking",
  description:
    "Prove one riskware technique end-to-end across two machines: Yoda (static) and Darth Vader (dynamic), over PixelBridge.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
