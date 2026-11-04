import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
} from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { PostHogProvider } from "@/components/posthog-provider";
import { TapFeedback } from "@/components/tap-feedback";

// `latin-ext` niesie polskie znaki (ą, ć, ę, ł, ń, ó, ś, ź, ż) — ładowane od
// razu, a nie dociągane przy pierwszym wystąpieniu. Kroje zastępcze z
// dopasowanymi metrykami są w globals.css (next/font nie zna jeszcze Atkinsona).
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  adjustFontFallback: false,
  fallback: ["Atkinson Hyperlegible Next Fallback", "Arial", "sans-serif"],
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin", "latin-ext"],
  adjustFontFallback: false,
  fallback: ["Atkinson Hyperlegible Mono Fallback", "Courier New", "monospace"],
});

export const metadata: Metadata = {
  title: "ProLog — dziennik",
  description: "Osobisty dziennik — zapisuj i przeglądaj swoje wpisy.",
};

// `cover` odsłania obszar pod wcięciami (notch/home indicator), dzięki czemu
// `env(safe-area-inset-bottom)` w dolnym pasku zakładek ma realną wartość.
// Kolor paska przeglądarki = tło strony w danym motywie systemu.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#121314" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${atkinson.variable} ${atkinsonMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <PostHogProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TapFeedback />
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
