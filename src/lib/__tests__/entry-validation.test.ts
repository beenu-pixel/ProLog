import { describe, expect, it } from "vitest";

import {
  canSaveEntry,
  htmlHasText,
  resolveTitle,
} from "@/lib/entry-validation";

describe("htmlHasText", () => {
  it("wykrywa realny tekst, ignorując puste znaczniki i whitespace", () => {
    expect(htmlHasText("<p>Cześć</p>")).toBe(true);
    expect(htmlHasText("")).toBe(false);
    expect(htmlHasText("<p></p>")).toBe(false);
    expect(htmlHasText("<p>   </p>")).toBe(false);
    expect(htmlHasText("<p>&nbsp;</p>")).toBe(false);
    expect(htmlHasText(undefined)).toBe(false);
  });
});

describe("canSaveEntry", () => {
  const base = { title: "", content: "", photoCount: 0, metricCount: 0 };

  it("przechodzi, gdy jest tytuł", () => {
    expect(canSaveEntry({ ...base, title: "Dzień" }).ok).toBe(true);
  });

  it("przechodzi, gdy jest treść", () => {
    expect(canSaveEntry({ ...base, content: "<p>coś</p>" }).ok).toBe(true);
  });

  it("przechodzi dla zdjęcia z nastrojem (bez tekstu)", () => {
    expect(canSaveEntry({ ...base, photoCount: 1, metricCount: 1 }).ok).toBe(
      true
    );
  });

  it("blokuje zdjęcie bez nastroju i bez tekstu", () => {
    const r = canSaveEntry({ ...base, photoCount: 2, metricCount: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("photos-need-mood");
  });

  it("blokuje całkiem pusty wpis", () => {
    const r = canSaveEntry(base);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("empty");
  });

  it("tekst ma pierwszeństwo — nastrój/zdjęcia nie są wtedy wymagane", () => {
    expect(
      canSaveEntry({ title: "  x  ", content: "", photoCount: 0, metricCount: 0 })
        .ok
    ).toBe(true);
  });
});

describe("resolveTitle", () => {
  it("zwraca wpisany tytuł (po trim)", () => {
    expect(resolveTitle({ title: "  Mój dzień  ", content: "", photoCount: 0 })).toBe(
      "Mój dzień"
    );
  });

  it("wnioskuje tytuł z treści, gdy brak tytułu", () => {
    expect(
      resolveTitle({ title: "", content: "<p>Spacer po lesie</p>", photoCount: 0 })
    ).toBe("Spacer po lesie");
  });

  it("używa zastępnika dla zdjęcia bez tekstu", () => {
    expect(resolveTitle({ title: "", content: "", photoCount: 1 })).toBe(
      "Wpis ze zdjęciami"
    );
  });
});
