import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Centauri", template: "%s · Centauri" },
  description: "Your personal ticket wallet and trip planner.",
  applicationName: "Centauri",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Centauri", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Matches the default (dark) background; ThemeColor syncs it with the in-app theme.
  themeColor: "#0a0b1c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        {/* Opaque, full-width, fixed bar at the very top edge. On iOS 26+ WebKit only suppresses the
            home-screen "scroll pocket" blur when it hit-tests a solid positioned element there
            (and only with the "default" status-bar style). Pages are padded below it (pt-safe). It must stay hit-testable, so no pointer-events-none. */}
        <div aria-hidden className="top-edge-bar fixed inset-x-0 top-0 z-40 bg-background" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
