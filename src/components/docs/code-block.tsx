"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Blok kodu z przyciskiem „Kopiuj" — używany w dokumentacji API (przykłady
 * `curl` i odpowiedzi JSON). Zwykły, mono, z poziomym przewijaniem.
 */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // schowek niedostępny — pomijamy
    }
  };

  return (
    <div className={cn("group relative", className)}>
      {label && (
        <div className="rounded-t-lg border border-b-0 bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </div>
      )}
      <div className="relative">
        <pre
          className={cn(
            "overflow-x-auto border bg-secondary/30 p-3 text-xs leading-relaxed",
            label ? "rounded-b-lg" : "rounded-lg"
          )}
        >
          <code className="font-mono">{code}</code>
        </pre>
        <button
          type="button"
          aria-label="Kopiuj"
          onClick={() => void handleCopy()}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
