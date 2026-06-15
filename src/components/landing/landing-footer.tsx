import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row lg:px-8">
        <span className="font-semibold tracking-tight text-foreground">ProLog</span>
        <nav className="flex items-center gap-6">
          <Link href="/welcome" className="transition-colors hover:text-foreground">
            Zaloguj się
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Dokumentacja
          </Link>
        </nav>
        <span className="text-xs">
          Popiersie Marka Aureliusza — Glyptotek, Monachium (public domain).
        </span>
      </div>
    </footer>
  );
}
