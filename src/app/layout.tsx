import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/providers/query-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";

export const metadata: Metadata = {
  title: "AiravatL Enterprise",
  description: "Customer portal for AiravatL — track your trips in real time.",
  applicationName: "AiravatL Enterprise",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AiravatL Enterprise",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/airavat-logo.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#4C1D95",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
