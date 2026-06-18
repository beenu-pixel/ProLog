import { describe, expect, it } from "vitest";

import { sanitizeEntryHtml } from "@/lib/sanitize";

describe("sanitizeEntryHtml", () => {
  it("zachowuje formatowanie produkowane przez edytor", () => {
    const html =
      "<p><strong>Tytuł</strong> i <em>kursywa</em></p><ul><li>punkt</li></ul>";
    expect(sanitizeEntryHtml(html)).toBe(html);
  });

  it("usuwa atak onerror na obrazku", () => {
    const out = sanitizeEntryHtml('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<img");
  });

  it("usuwa tag script", () => {
    const out = sanitizeEntryHtml("<p>cześć</p><script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("<p>cześć</p>");
  });

  it("strip-uje handlery zdarzeń, zostawiając tekst", () => {
    const out = sanitizeEntryHtml('<p onclick="steal()">tekst</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("tekst");
  });

  it("usuwa iframe i style", () => {
    const out = sanitizeEntryHtml(
      '<iframe src="evil"></iframe><p style="x">a</p>'
    );
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("style=");
  });

  it("zwraca pusty string dla wejścia pustego/niepoprawnego", () => {
    expect(sanitizeEntryHtml("")).toBe("");
    // @ts-expect-error — celowo zła wartość
    expect(sanitizeEntryHtml(null)).toBe("");
  });
});
