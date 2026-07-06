// Guard konfiguracji buildu — pilnuje, by produkcyjny build NIE wyszedł bez
// PUBLICZNYCH zmiennych, które Next wpala na sztywno w bundle (NEXT_PUBLIC_*).
// Ich brak nie wywala builda z automatu — apka po cichu ląduje w trybie „brak
// konfiguracji" (logowanie/synchronizacja wyłączone). Ten skrypt zamienia tę
// cichą awarię w twardy błąd builda.
//
// ŚWIADOMIE zero zależności i zero importów z aplikacji — ma być w pełni
// izolowany, żeby nie ciągnąć za sobą reszty kodu ani nie psuć innych rzeczy.
//
// Uruchamiany z `npm run build` (patrz package.json). Twardy błąd (exit 1) TYLKO
// na produkcyjnym deployu Vercela (VERCEL_ENV=production). Lokalnie i na preview
// tylko ostrzega, żeby nie blokować pracy nad innymi funkcjonalnościami.

import { readFileSync } from "node:fs";

// Publiczne zmienne wymagane, by logowanie/synchronizacja w ogóle zbudowały się
// poprawnie. To klasa awarii „cichej" — brak = zły bundle bez żadnego sygnału.
const REQUIRED_PUBLIC = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

// Vercel wstrzykuje wszystkie skonfigurowane zmienne (w tym NEXT_PUBLIC_*) do
// process.env procesu builda. Lokalnie ich tam nie ma (Next ładuje .env dopiero
// w swoim procesie), więc na potrzeby ostrzeżeń doczytujemy pliki sami — bez
// żadnej zależności (żaden `dotenv`), prostym parserem.
function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return; // brak pliku = nic nie robimy (na Vercelu zmienne są w process.env)
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue; // process.env ma pierwszeństwo
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Kolejność jak w Next: .env.local ma pierwszeństwo nad .env.
loadEnvFile(".env.local");
loadEnvFile(".env");

const missing = REQUIRED_PUBLIC.filter((key) => !process.env[key]?.trim());

if (missing.length === 0) {
  process.exit(0);
}

const list = missing.map((key) => `  - ${key}`).join("\n");
const isVercelProd = process.env.VERCEL_ENV === "production";

if (isVercelProd) {
  console.error(
    `\n[check-env] PRZERWANO build produkcyjny — brak wymaganych zmiennych PUBLICZNYCH:\n${list}\n\n` +
      "To zmienne NEXT_PUBLIC_*, wpalane w bundle w czasie builda. Bez nich apka wyjdzie\n" +
      "w trybie „brak konfiguracji” (logowanie niedostępne). Ustaw je w:\n" +
      "  Vercel → Settings → Environment Variables (środowisko Production)\n" +
      "i zdeployuj ponownie (rebuild jest konieczny dla NEXT_PUBLIC_*).\n"
  );
  process.exit(1);
}

console.warn(
  `\n[check-env] Uwaga: brak zmiennych PUBLICZNYCH (build nie-produkcyjny — kontynuuję):\n${list}\n`
);
process.exit(0);
