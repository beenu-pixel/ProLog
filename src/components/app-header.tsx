import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
        <Link
          href="/entries"
          className="text-lg font-semibold tracking-tight"
        >
          ProLog
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
