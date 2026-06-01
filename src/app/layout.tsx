import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProLog — dziennik",
  description: "Osobisty dziennik — zapisuj i przeglądaj swoje wpisy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <div className="flex min-h-dvh flex-col">
            <AppHeader />
            {/* pb-28 zostawia miejsce na pływający dolny navbar. */}
            <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-6 pb-28">
              {children}
            </main>
            <BottomNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
