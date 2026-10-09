import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { AmplifyProvider } from "@/components/providers/amplify-provider";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AQUILOOP — Flood Prevention, Drain Bounties & Stubble Recovery",
  description:
    "Pre-storm flood operations, verified drain cleanup bounties, and harvest straw collection across Delhi-NCR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} dark font-sans`}
    >
      <body
        className={`${fontSans.className} ${fontSans.variable} ${fontMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <AmplifyProvider>
          <AppShell>{children}</AppShell>
        </AmplifyProvider>
      </body>
    </html>
  );
}
