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
  appleWebApp: { capable: true, title: "Centauri", statusBarStyle: "black-translucent" },
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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b1c" },
    { media: "(prefers-color-scheme: light)", color: "#f9fafd" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        {/* Solid status-bar backdrop. With a translucent status bar, iOS (notably iOS 26 standalone PWAs)
            otherwise blurs/fades whatever scrolls under the notch / Dynamic Island. */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[env(safe-area-inset-top)] bg-background" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
