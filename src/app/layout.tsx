import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { ComposerBar } from "@/components/composer-bar";

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
          disableTransitionOnChange
        >
          <div className="flex min-h-dvh flex-col">
            <AppHeader />
            {/* Szerokość/wyściółkę ustalają poszczególne sekcje (np. dwupanelowy
                układ /entries). Dół rezerwuje miejsce na dwa pływające paski:
                kompozytor (globalny) nad dolnym navbarem na mobile; na desktopie
                navbar znika, ale kompozytor zostaje, więc i tak trzymamy odstęp. */}
            <main className="flex w-full flex-1 flex-col pb-44 lg:pb-28">
              {children}
            </main>
            <BottomNav />
            <ComposerBar />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
