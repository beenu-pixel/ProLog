# Śledztwo: „node wciąga całą pamięć" podczas testów

**Data:** 2026-06-18
**Status:** Rozwiązane — przyczyna ustalona. **To nie jest błąd w kodzie aplikacji.**

## Objaw

Podczas testowania ostatnich zmian proces **Node.js JavaScript Runtime** (serwer
`next dev`) rósł w nieskończoność, dochodząc do ~**17 456 MB (99% RAM)** i wieszał
maszynę. Objaw pojawiał się przy wielokrotnym przeładowywaniu strony (np. przez
narzędzie podglądu w trakcie testów).

## Wniosek (TL;DR)

Wyciek to **zachowanie serwera deweloperskiego Next.js 16 (`next dev`)**, a nie
skutek ostatnich zmian (wyszukiwarka, embeddingi, hybrydowy RAG, scena three.js
itd.). Każde żądanie strony zostawia w pamięci **jeden zatrzymany strumień renderu
React Server Components** wraz z deweloperskimi „owner stack" `Error`-ami (React
zbiera ślady stosu **tylko w trybie dev**). Pamięć rośnie liniowo z liczbą żądań i
nie jest zwalniana.

**Produkcja jest czysta:** trasa `/` jest prerenderowana statycznie (`○ Static`),
a deweloperskie `Error`-y ze stosami nie istnieją w buildzie produkcyjnym.

## Reprodukcja i pomiary

Środowisko: `npm ci`, `npm run dev` (Next.js 16.2.7, Turbopack), pomiar `VmRSS`
procesu `next-server` z `/proc/<pid>/status`, obciążanie `curl`-em.

### 1. Wyciek na trasie `/` (landing)

| Liczba żądań do `/` | RSS procesu node |
| ------------------: | ---------------: |
| start (po rozgrzaniu) | 926 MB |
| 400 | 1 664 MB |
| 800 | 2 251 MB |
| 1200 | **2 732 MB** |

Wzrost ~1,5–2,7 MB na żądanie, bez plateau. Przy setkach przeładowań w trakcie
sesji testowej łatwo dobić do kilkunastu GB.

### 2. To nie zależy od kodu aplikacji

Podmiana zawartości strony na czyste elementy serwerowe (bez komponentów
klienckich i bez kodu projektu):

| Zawartość strony | Wyciek na żądanie |
| --- | --- |
| `<div>hi</div>` | ~0 (stabilnie, GC odzyskuje) |
| 400 × `<p>…</p>` (czysto serwerowe) | **~2,7 MB** |
| prawdziwy landing | ~1,5 MB |

Pusta strona nie cieknie; strona z samymi `<p>` cieknie **bardziej** niż landing.
Wyciek skaluje się wyłącznie z liczbą elementów React renderowanych po stronie
serwera — to dowód, że źródłem jest serwer dev Next.js, a nie konkretny komponent.

Serwowanie pliku statycznego (`/file.svg`) — pamięć płaska (~0,03 MB/żądanie),
brak wycieku.

### 3. Analiza zrzutu sterty (heap snapshot)

Po 200 żądaniach do `/` wykonano `HeapProfiler.collectGarbage` (wymuszony GC) i
zrzut sterty (343 MB **po** GC — czyli realnie zatrzymana pamięć). Najwięksi
„trzymacze" pamięci:

```
 49.7MB   931 017  system / CallSiteInfo      <- ślady stosu (stack traces)
  5.7MB    82 618  ReactPromise               <- chunki drzewa renderu RSC
  1.5MB    33 015  Error                      <- deweloperskie owner-stack Error-y
   ...        205  InternalReadableByteStream <- ~1 strumień renderu na żądanie
```

**205 strumieni `InternalReadableByteStream` przy ~201 żądaniach = dokładnie jeden
zatrzymany strumień renderu RSC na każde żądanie.**

Łańcuch retencji (od liścia do korzenia GC):

```
system / CallSiteInfo
 ← Error            (przez <symbol> stack)
 ← Object           (value)
 ← ReactPromise → _children → ReactPromise → _children → ReactPromise …
 ← InternalReadableByteStream   (reactions_or_result)
 ← Promise          (oczekujący)
 ← (Global handles) ← (GC roots)
```

Czyli: oczekujący `Promise` (korzeń GC) trzyma strumień bajtowy renderu RSC, ten
trzyma całe drzewo `ReactPromise`, a każdy węzeł drzewa niesie `Error` z pełnym
śladem stosu (`CallSiteInfo`). React tworzy te `Error`-y **tylko w dev** (owner
stacks do debugowania), stąd lawina `CallSiteInfo`.

### 4. Produkcja

`npm run build` przechodzi bez błędów. W tablicy tras:

```
Route (app)
┌ ○ /            ← Static (prerenderowane do statycznego HTML)
├ ○ /docs        ← Static
├ ○ /entries     ← Static
└ ○ /welcome     ← Static
ƒ /api/*         ← Dynamic (server-rendered on demand)
```

Trasa `/` jest **statyczna** — w produkcji serwowana jako gotowy plik, bez renderu
RSC per żądanie. Dodatkowo deweloperskie owner-stack `Error`-y w buildzie
produkcyjnym nie powstają. **Aplikacja na produkcji/Vercelu tego problemu nie ma.**

## Jak to obejść

- Do **testów wizualnych / podglądu** używać `npm run build && npm run start`
  (tryb produkcyjny) zamiast długo trzymanego `npm run dev`. Landing jest
  statyczny i nie cieknie.
- Przy długich sesjach na `next dev` — okresowo restartować serwer (problem jest
  dev-only i znika po restarcie).
- Rozważyć zgłoszenie issue do Next.js 16.2.7: retencja strumieni renderu RSC
  (`InternalReadableByteStream`) i owner-stack `Error`-ów w trybie deweloperskim,
  rosnąca liniowo z liczbą żądań.

## Czego sprawdzono i wykluczono

Przejrzano pod kątem wycieków cały kod ostatnich zmian; wszystkie wzorce były
poprawne (brak realnego źródła wycieku po stronie aplikacji):

- `hero-scene.tsx` (three.js) — pętla `requestAnimationFrame`, `ResizeObserver`,
  `MutationObserver`, listenery i zasoby GPU są poprawnie sprzątane w `cleanup`.
- `storage.ts`, `motion.ts`, `nav-menu-store.ts`, `therapist-chat-store.ts` —
  store'y `useSyncExternalStore` mają stabilne referencje snapshotów i poprawnie
  zarządzają zbiorem listenerów.
- Trasy API (`/api/search`, `/api/therapist`, `/api/v1/agent`, embeddingi) — brak
  nieskończonych pętli; `ReadableStream` w `/api/therapist` jest poprawnie
  domykany; klienci Supabase to singletony (bez tworzenia per żądanie).
- `entry-list.tsx` — debounce wyszukiwarki z poprawnym `clearTimeout`/`cancelled`.

Wyciek występuje także dla strony złożonej wyłącznie ze statycznych elementów
serwerowych, co ostatecznie wyklucza kod aplikacji jako przyczynę.
