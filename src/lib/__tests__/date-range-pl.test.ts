import { describe, expect, it } from "vitest";

import { addDays, daysOf, parsePolishDateRanges, rangeLength } from "@/lib/date-range-pl";

// „Dziś" = środa 2026-11-04 (dzień zgłoszenia błędu).
const TODAY = "2026-11-04";
const parse = (text: string) => parsePolishDateRanges(text, TODAY);

describe("parsePolishDateRanges — przypadki ze zgłoszenia", () => {
  it("„ile wpisów z lipca 2026 widzisz” → cały lipiec 2026", () => {
    expect(parse("ile wpisów z lipca 2026 widzisz")).toEqual([
      { from: "2026-07-01", to: "2026-07-31" },
    ]);
  });

  it("„27–31.07.2026” → pięć dni (półpauza)", () => {
    expect(parse("Co pisałem 27–31.07.2026?")).toEqual([{ from: "2026-07-27", to: "2026-07-31" }]);
  });

  it("„ostatni tydzień lipca” → 25–31 lipca", () => {
    expect(parse("jak spałem w ostatnim tygodniu lipca?")).toEqual([
      { from: "2026-07-25", to: "2026-07-31" },
    ]);
  });

  it("„24.07.2026” → jeden dzień", () => {
    expect(parse("co się stało 24.07.2026")).toEqual([{ from: "2026-07-24", to: "2026-07-24" }]);
  });
});

describe("parsePolishDateRanges — formy miesięcy i dni", () => {
  it.each([
    ["w lipcu", "2026-07-01", "2026-07-31"],
    ["lipiec był ciężki", "2026-07-01", "2026-07-31"],
    ["od sierpnia", "2026-08-01", "2026-08-31"],
    ["we wrześniu 2026", "2026-09-01", "2026-09-30"],
    ["we wrzesniu 2026 (bez ogonków)", "2026-09-01", "2026-09-30"],
    ["w lutym 2024", "2024-02-01", "2024-02-29"],
    ["w październiku", "2026-10-01", "2026-10-31"],
  ])("%s", (text, from, to) => {
    expect(parse(text)).toEqual([{ from, to }]);
  });

  it("miesiąc bez roku, który jeszcze nie nadszedł → zeszły rok", () => {
    expect(parse("co pisałem w grudniu")).toEqual([{ from: "2025-12-01", to: "2025-12-31" }]);
  });

  it("dzień słownie, z rokiem i bez", () => {
    expect(parse("24 lipca 2026")).toEqual([{ from: "2026-07-24", to: "2026-07-24" }]);
    expect(parse("a 3 października?")).toEqual([{ from: "2026-10-03", to: "2026-10-03" }]);
  });

  it("zakresy słownie, także między miesiącami", () => {
    expect(parse("od 27 do 31 lipca")).toEqual([{ from: "2026-07-27", to: "2026-07-31" }]);
    expect(parse("27-31 lipca 2026")).toEqual([{ from: "2026-07-27", to: "2026-07-31" }]);
    expect(parse("od 27 lipca do 2 sierpnia 2026")).toEqual([
      { from: "2026-07-27", to: "2026-08-02" },
    ]);
  });

  it("zakresy liczbowe i ISO", () => {
    expect(parse("27.07–02.08.2026")).toEqual([{ from: "2026-07-27", to: "2026-08-02" }]);
    expect(parse("od 27 do 31.07")).toEqual([{ from: "2026-07-27", to: "2026-07-31" }]);
    expect(parse("2026-07-27 – 2026-07-31")).toEqual([{ from: "2026-07-27", to: "2026-07-31" }]);
    expect(parse("wpis z 2026-07-24")).toEqual([{ from: "2026-07-24", to: "2026-07-24" }]);
    expect(parse("24/07/2026")).toEqual([{ from: "2026-07-24", to: "2026-07-24" }]);
  });

  it("tygodnie i części miesiąca", () => {
    expect(parse("pierwszy tydzień sierpnia")).toEqual([{ from: "2026-08-01", to: "2026-08-07" }]);
    expect(parse("drugi tydzień lipca 2026")).toEqual([{ from: "2026-07-08", to: "2026-07-14" }]);
    expect(parse("na początku lipca")).toEqual([{ from: "2026-07-01", to: "2026-07-10" }]);
    expect(parse("w połowie lipca")).toEqual([{ from: "2026-07-11", to: "2026-07-20" }]);
    expect(parse("pod koniec lipca")).toEqual([{ from: "2026-07-21", to: "2026-07-31" }]);
  });
});

describe("parsePolishDateRanges — określenia względne", () => {
  it.each([
    ["dziś", "2026-11-04", "2026-11-04"],
    ["dzisiaj rano", "2026-11-04", "2026-11-04"],
    ["wczoraj", "2026-11-03", "2026-11-03"],
    ["przedwczoraj", "2026-11-02", "2026-11-02"],
    ["w tym tygodniu", "2026-11-02", "2026-11-04"],
    ["w zeszłym tygodniu", "2026-10-26", "2026-11-01"],
    ["przez ostatni tydzień", "2026-10-29", "2026-11-04"],
    ["ostatnie 3 dni", "2026-11-02", "2026-11-04"],
    ["ostatnich dziesięć dni", "2026-10-26", "2026-11-04"],
    ["ostatnie 2 tygodnie", "2026-10-22", "2026-11-04"],
    ["w tym miesiącu", "2026-11-01", "2026-11-04"],
    ["w zeszłym miesiącu", "2026-10-01", "2026-10-31"],
    ["w ostatnim miesiącu", "2026-10-06", "2026-11-04"],
    ["w zeszłym roku", "2025-01-01", "2025-12-31"],
    ["w 2025 roku", "2025-01-01", "2025-12-31"],
    ["w poniedziałek", "2026-11-02", "2026-11-02"],
    ["w środę", "2026-11-04", "2026-11-04"],
    ["w zeszłą sobotę", "2026-10-31", "2026-10-31"],
  ])("%s", (text, from, to) => {
    expect(parse(text)).toEqual([{ from, to }]);
  });

  it("w styczniu „zeszły miesiąc” to grudzień poprzedniego roku", () => {
    expect(parsePolishDateRanges("zeszły miesiąc", "2027-01-15")).toEqual([
      { from: "2026-12-01", to: "2026-12-31" },
    ]);
  });
});

describe("parsePolishDateRanges — granice i fałszywe trafienia", () => {
  it("bez daty → pusta lista", () => {
    expect(parse("jak się dziś czuję?")).toEqual([{ from: TODAY, to: TODAY }]);
    expect(parse("co myślisz o moim śnie?")).toEqual([]);
    expect(parse("")).toEqual([]);
  });

  it("czasownik „mają” to nie maj", () => {
    expect(parse("ludzie mają różne nawyki")).toEqual([]);
    expect(parse("oni maja rację")).toEqual([]);
    expect(parse("z maja 2026")).toEqual([{ from: "2026-05-01", to: "2026-05-31" }]);
    expect(parse("od maja")).toEqual([{ from: "2026-05-01", to: "2026-05-31" }]);
  });

  it("godziny i liczby nie są datami", () => {
    expect(parse("wstałem o 8.10")).toEqual([]);
    expect(parse("spotkanie godz. 12.30")).toEqual([]);
    expect(parse("biegłem 1.5 godziny, 3 razy")).toEqual([]);
    expect(parse("ważę 72.50 kg")).toEqual([]);
  });

  it("nieistniejące daty są pomijane", () => {
    expect(parse("31.02.2026")).toEqual([]);
    expect(parse("30 lutego")).toEqual([]);
  });

  it("przyszłość: przycina do dziś, a całkiem przyszłe zakresy pomija", () => {
    expect(parse("w tym roku")).toEqual([{ from: "2026-01-01", to: TODAY }]);
    expect(parse("10.11.2026")).toEqual([]);
  });

  it("kilka określeń w jednym pytaniu — w kolejności, bez duplikatów, najwyżej 3", () => {
    expect(parse("porównaj lipiec 2026 i sierpień 2026")).toEqual([
      { from: "2026-07-01", to: "2026-07-31" },
      { from: "2026-08-01", to: "2026-08-31" },
    ]);
    expect(parse("lipiec, lipiec 2026")).toEqual([{ from: "2026-07-01", to: "2026-07-31" }]);
    expect(parse("styczeń 2026, luty 2026, marzec 2026, kwiecień 2026")).toHaveLength(3);
  });

  it("dłuższy wzorzec wygrywa (zakres nie daje dodatkowo pojedynczego dnia ani miesiąca)", () => {
    expect(parse("27–31 lipca 2026")).toEqual([{ from: "2026-07-27", to: "2026-07-31" }]);
  });
});

describe("arytmetyka dni", () => {
  it("addDays, rangeLength i daysOf przechodzą przez granice miesięcy i lat", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(rangeLength({ from: "2026-07-27", to: "2026-07-31" })).toBe(5);
    expect(daysOf({ from: "2026-02-27", to: "2026-03-01" })).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
  });
});
