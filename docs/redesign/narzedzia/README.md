# Narzędzia pomiarowe redesignu

Skrypty Playwright do zrzutów, audytu i GIF-ów. Działają na lokalnym buildzie z podstawionym
Supabase — żadne prawdziwe konto ani produkcja nie biorą udziału (sesja i wpisy są testowe,
analityka zablokowana). Używają przeglądarki zainstalowanej w systemie (`channel: "msedge"`).

## Przygotowanie

1. `.env.local` z `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` i dowolnym kluczem
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. `npm run build`, potem `npm start -- -p 3102` (wersja „ma być”). Dla porównania druga kopia
   `main` na porcie 3101 (wersja „jest”), np. w osobnym worktree.
3. Playwright i dwa małe pakiety do GIF-ów poza projektem:
   `npm i playwright gifenc pngjs` w dowolnym katalogu i `NODE_PATH=<ten katalog>/node_modules`.

## Skrypty

| Skrypt | Co robi | Przykład |
|---|---|---|
| `contrast.js` | kontrast WCAG par tokenów (OKLCH → sRGB) | `node contrast.js` |
| `audit.js` | 12 szerokości × 2 motywy: przepełnienie, poza ekranem, ucięty tekst, cele dotyku, liczba rozmiarów czcionki, kontrast każdego tekstu | `BASE=http://localhost:3102 node audit.js` |
| `shoot.js` | zrzuty scen (telefon 375 px, komputer 1440 px, oba motywy) | `BASE=… OUT=out/ma-byc node shoot.js` |
| `composites.js` | porównania „jest / ma być” z `out/jest` i `out/ma-byc` | `DEST=../zrzuty/01-system-i-dziennik node composites.js` |
| `gif.js` | GIF-y animacji w prawdziwym tempie (DevTools zwalnia animacje, klatki są przeliczane) | `BASE=… LABEL=ma-byc node gif.js` |
| `font-metrics.js` | metryki kroju do kroju zastępczego (size-adjust, ascent/descent) | `node font-metrics.js` |

Wyniki (`out/`) są w `.gitignore`.
