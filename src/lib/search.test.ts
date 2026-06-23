import { describe, expect, it } from "vitest";
import { searchEntries } from "@/lib/search";
import type { Entry, EntryPhoto } from "@/lib/types";

const photo: EntryPhoto = { id: "p1", path: "u/p1.jpg" };

function entry(overrides: Partial<Entry> & Pick<Entry, "id" | "createdAt">): Entry {
  return {
    title: "",
    content: "",
    ...overrides,
  };
}

// Daty: 2026-06-22 to poniedziałek, 2026-06-24 to środa.
const withPhotosNew = entry({
  id: "new",
  title: "Nowy dzień",
  createdAt: "2026-06-24T10:00:00.000Z", // środa
  photos: [photo],
});
const withPhotosOld = entry({
  id: "old",
  title: "Stary dzień",
  createdAt: "2026-06-20T10:00:00.000Z",
  photos: [photo],
});
const noPhotos = entry({
  id: "none",
  title: "Wpis o zdjęciu bez załącznika",
  createdAt: "2026-06-22T10:00:00.000Z", // poniedziałek
});

// Wejście zawsze od najnowszych (jak z getEntries()).
const entries = [withPhotosNew, noPhotos, withPhotosOld];

describe("searchEntries — filtr zdjęć", () => {
  it.each(["zdjęcie", "zdjęcia", "zdjęć", "fotka", "fotki", "fotkę", "fotografia", "photo", "photos", "picture", "pic", "pics"])(
    "slowo-klucz %s zwraca tylko wpisy ze zdjeciami",
    (query) => {
      const ids = searchEntries(entries, query).map((e) => e.id);
      expect(ids).toEqual(["new", "old"]);
    }
  );

  it("sortuje trafienia od najnowszych do najstarszych", () => {
    const ids = searchEntries(entries, "zdjęcie").map((e) => e.id);
    expect(ids).toEqual(["new", "old"]);
  });

  it("nie lapie wpisu ze slowem zdjecie w tytule, gdy brak zalacznikow", () => {
    const ids = searchEntries(entries, "zdjęcie").map((e) => e.id);
    expect(ids).not.toContain("none");
  });

  it("łączy słowo-klucz z innym tokenem jak AND (zdjęcie + dzień tygodnia)", () => {
    const ids = searchEntries(entries, "zdjęcie środa").map((e) => e.id);
    expect(ids).toEqual(["new"]); // tylko środa ma zdjęcia
  });

  it.each(["fotel", "picnic"])(
    "slowo %s nie wyzwala filtra zdjec",
    (query) => {
      // „fotel"/„picnic" nie pasują do żadnego wpisu (brak w treści, nie są kluczem).
      expect(searchEntries(entries, query)).toEqual([]);
    }
  );
});
