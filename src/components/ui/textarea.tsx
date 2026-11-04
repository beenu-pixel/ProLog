import * as React from "react";

import { cn } from "@/lib/utils";

// Jak `Input`: tekst zawsze 16 px, obwódka ≥ 3:1, fokus pogrubia obwódkę.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-body text-foreground transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
        "aria-invalid:border-destructive aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
