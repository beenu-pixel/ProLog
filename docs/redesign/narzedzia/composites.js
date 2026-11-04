// Składa porównania „jest / ma być” z out/jest i out/ma-byc do katalogu DEST.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const DEST = process.env.DEST;
if (!DEST) throw new Error("DEST wymagany");
const J = path.join(__dirname, "out", "jest");
const M = path.join(__dirname, "out", "ma-byc");
const sheet = (out, title, cols, width, items) =>
  execFileSync(process.execPath, [path.join(__dirname, "sheet.js"), out, title, String(cols), String(width), ...items.flat()], { stdio: "inherit" });

const PHONE = {
  "dziennik-dzis": "Dziennik — dziś bez wpisu",
  "dziennik-wpis": "Dziennik — dzień z wpisem",
  "dziennik-pisanie": "Dziennik — pisanie w polu na dole",
  wiecej: "Menu „Więcej”",
  wczytywanie: "Dziennik — wpisy pobierają się z chmury",
  zalogowany: "Dziennik — zalogowany",
  ustawienia: "Ustawienia (motyw w sekcji Wygląd)",
  rozmowa: "Rozmowa",
  statystyki: "Statystyki (tylko tokeny)",
  "nowy-wpis": "Nowy wpis (tylko tokeny)",
  logowanie: "Logowanie (tylko tokeny)",
};
const DESKTOP = {
  "dziennik-dzis": "Dziennik — dziś bez wpisu",
  "dziennik-wybrany": "Dziennik — wybrany wpis",
  wczytywanie: "Dziennik — wpisy pobierają się z chmury",
  zalogowany: "Dziennik — zalogowany (konto w pasku bocznym)",
  rozmowa: "Rozmowa — ekran z paska bocznego zamiast panelu",
  ustawienia: "Ustawienia",
  statystyki: "Statystyki (powłoka i tokeny)",
  "nowy-wpis": "Nowy wpis (powłoka i tokeny)",
};

fs.mkdirSync(DEST, { recursive: true });
for (const [scene, title] of Object.entries(PHONE)) {
  const f = (dir, theme) => path.join(dir, `${scene}__phone__${theme}.png`);
  sheet(path.join(DEST, `${scene}__telefon.png`), `${title} · telefon`, 4, 280, [
    [f(J, "dark"), "Jest · ciemny"], [f(M, "dark"), "Ma być · ciemny"],
    [f(J, "light"), "Jest · jasny"], [f(M, "light"), "Ma być · jasny"],
  ]);
}
for (const [scene, title] of Object.entries(DESKTOP)) {
  const f = (dir, theme) => path.join(dir, `${scene}__desktop__${theme}.png`);
  sheet(path.join(DEST, `${scene}__komputer.png`), `${title} · komputer`, 2, 620, [
    [f(J, "dark"), "Jest · ciemny"], [f(M, "dark"), "Ma być · ciemny"],
    [f(J, "light"), "Jest · jasny"], [f(M, "light"), "Ma być · jasny"],
  ]);
}
