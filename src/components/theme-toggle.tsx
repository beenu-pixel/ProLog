"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const isDark = hydrated && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Przełącz tryb jasny/ciemny"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border bg-secondary transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      )}
    >
      <span
        className={cn(
          "absolute flex size-5 items-center justify-center rounded-full bg-background text-foreground shadow-md transition-transform",
          isDark ? "translate-x-6" : "translate-x-1"
        )}
      >
        {isDark ? (
          <Moon className="size-3" />
        ) : (
          <Sun className="size-3" />
        )}
      </span>
    </button>
  );
}
