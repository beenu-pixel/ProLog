import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Trzy podskakujące kropki: wskaźnik ładowania w przyciskach. Kolor dziedziczą
 * z tekstu, ruch i jego wyłączanie są w `globals.css`. Dekoracja: stan ładowania
 * ogłasza `aria-busy` i tekst przycisku.
 */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("loading-dots", className)}>
      <span />
      <span />
      <span />
    </span>
  );
}

/** Tekst stanu ładowania z kropkami, ogłaszany czytnikom ekranu. */
export function LoadingText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      {children}
      <LoadingDots />
    </p>
  );
}
