import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

/**
 * Inter variable font — covers display (300) and body (400/500/600) weights
 * in a single network request.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://allo.local"),
  title: {
    default: "Allo — Reserved Inventory",
    template: "%s · Allo",
  },
  description:
    "Reserve units across warehouses with race-free inventory holds.",
  applicationName: "Allo",
  authors: [{ name: "Abhash Chakraborty" }],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Allo — Reserved Inventory",
    description:
      "Reserve units across warehouses with race-free inventory holds.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfbf5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preload" href="/hero.mp4" as="video" type="video/mp4" />
      </head>
      <body className="min-h-screen flex flex-col bg-canvas-cream text-ink">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
