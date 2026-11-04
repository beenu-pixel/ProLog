import { describe, expect, it } from "vitest";

import { THERAPISTS } from "@/lib/therapists";

// Prompty person mówią, jak traktować wycinek dziennika: „nie ma wpisu" tylko
// w okresie pobranym w całości, i bez technicznego słownictwa wobec użytkownika.
describe("prompty person", () => {
  it.each(THERAPISTS.map((t) => [t.id, t.systemPrompt] as const))(
    "%s: reguła o brakujących dniach i bez słowa „kontekst”",
    (_id, prompt) => {
      expect(prompt).toContain("Że danego dnia nie ma wpisu, mówisz tylko wtedy");
      expect(prompt).toContain("widzisz tylko część dziennika");
      expect(prompt).toContain("„WPISY Z DZIENNIKA\"");
      expect(prompt).toContain("„We wpisach z lipca widzę…\"");
      expect(prompt.toLowerCase()).not.toMatch(/kontekst/);
    }
  );
});
