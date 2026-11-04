import * as React from "react";

import { cn } from "@/lib/utils";

// Pole „Monolitu”: 44 px wysokości na telefonie (cel dotyku), tekst zawsze 16 px
// (mniejszy sprawia, że iOS przybliża stronę przy wpisywaniu), obwódka ≥ 3:1.
// Fokus pogrubia obwódkę do 2 px w kolorze pierścienia — spokojnie, ale wyraźnie.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-body text-foreground transition-colors outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-ui file:font-medium file:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 lg:h-10",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
        "aria-invalid:border-destructive aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
