import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn — tokeny systemu", () => {
  it("nie gubi rozmiaru tekstu obok koloru", () => {
    expect(cn("text-caption", "text-subtle-foreground")).toBe(
      "text-caption text-subtle-foreground"
    );
    expect(cn("text-ui", "text-attention")).toBe("text-ui text-attention");
  });

  it("późniejszy rozmiar z tej samej skali wygrywa", () => {
    expect(cn("text-caption", "text-title")).toBe("text-title");
    expect(cn("text-body", "text-sm")).toBe("text-sm");
  });

  it("zna własne cienie", () => {
    expect(cn("shadow-raised", "shadow-overlay")).toBe("shadow-overlay");
  });
});
