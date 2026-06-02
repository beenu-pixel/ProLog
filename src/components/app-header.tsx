import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between px-6 lg:px-8">
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
