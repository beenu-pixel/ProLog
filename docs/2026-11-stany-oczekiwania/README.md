# Telefon: reakcja na dotyk i uczciwe stany oczekiwania (2–3.11.2026)

Podsumowanie pracy nad ProLogiem z sesji przygotowań do Talent Days. Wszystko poniżej jest na
produkcji (`main`), chyba że napisano inaczej.

## W skrócie

- Na telefonie nie było wiadomo, czy stuknięcie dotarło i czy aplikacja pracuje. Teraz każde
  stuknięcie daje widoczną reakcję, a każde czekanie ma napis.
- W trakcie ładowania ProLog potrafił mówić nieprawdę („Brak wpisu”, „Plan Free” na koncie Pro),
  a w jednym miejscu gubił dane (zdjęcie przy zapisie). To naprawione.
- Sprawdzone testami i na produkcji w trybie gościa. **Niesprawdzone:** prawdziwy telefon,
  prawdziwe konto i przejście przez Stripe.

## Co weszło na produkcję

| PR | Co | Scalono |
|---|---|---|
| beenu-pixel/ProLog#24 | Przycisk CTA na pierwszym ekranie strony startowej, `/stats` i `/settings` nie poszerzają strony na telefonie | 2.11.2026 |
| beenu-pixel/ProLog#25 | Reakcja na dotyk i 11 stanów oczekiwania (niżej) | 3.11.2026 |

### Reakcja na dotyk (#25)

- Wciśnięty element przygasa i lekko się zmniejsza (`data-pressed` ustawiane na `pointerdown`,
  bo `:active` na iOS nie działa bez nasłuchu dotyku, a szybkie stuknięcia są niewidoczne).
  Bez zmniejszania przy ograniczonym ruchu.
- Krótka wibracja po stuknięciu, tylko Android (Safari na iOS nie ma takiego API). Wyłącznik
  w Ustawieniach → Wibracje, widoczny tylko tam, gdzie wibracja działa.
- Cienki pasek ładowania u góry przy przejściu na inną stronę (pojawia się po 150 ms, żeby
  szybkie przejścia nie migały).
- Trzy podskakujące kropki zamiast spinnera, zawsze **za tekstem**: „Logowanie”, „Zakładanie konta”,
  „Logowanie przez Google”, „Otwieram” (płatności), „Wylogowuję”.
- Logowanie dłuższe niż 6 s: „Serwer odpowiada dłużej niż zwykle. Jeszcze chwila…”.
- Po cofnięciu z Google lub Stripe przyciski wracają do normalnego stanu (bfcache, `pageshow`).
- Przycisk w trakcie ładowania nie przygasa (`aria-busy:opacity-100`), bo w ciemnym motywie
  kropki ginęły.

### 11 stanów oczekiwania (#25)

Kolejność według wagi problemu; zrzuty „jest / ma być” w `zrzuty/`.

| # | Gdzie | Było | Jest |
|---|---|---|---|
| 1 | Nowy wpis ze zdjęciem | „Zapisz” działało w trakcie wgrywania, wpis zapisywał się **bez zdjęcia**. Drugi wybór pliku kasował pierwszy | Przycisk „Wgrywam zdjęcie” z kropkami, zablokowany do końca. Oba zdjęcia trafiają do wpisu |
| 2 | Po zalogowaniu na nowym urządzeniu | „Brak wpisu na ten dzień”, „0 wpisów”, „Nie znaleziono wpisu”, choć wpisy się pobierały | „Wczytuję wpisy” / „Wczytuję wpis” na środku wolnego miejsca. Puste konto po pobraniu widzi uczciwy pusty stan |
| 3 | Plan w Ustawieniach | Konto Pro widziało „Plan Free” i „Przejdź na Pro” | „Wczytuję plan”, przy błędzie „Nie udało się wczytać planu” i „Spróbuj ponownie” |
| 4 | Powrót po zapłacie | Brak jakiegokolwiek potwierdzenia | Na górze Ustawień: „Płatność przyjęta. Aktywuję plan”, potem „Gotowe, masz plan Pro”; po 30 s bez webhooka „aktywacja trwa dłużej niż zwykle” |
| 5 | Raport AI | Małe kółko, tekst bez zmian | „Generuję raport” z kropkami, po 6 s „Czytam Twoje wpisy, to może chwilę potrwać” |
| 6 | Raport przed wczytaniem planu | Kłódki, a stuknięcie wysyłało płacącego do cennika | „Sprawdzam plan”, przyciski czekają. Gdy planu nie da się pobrać, o dostępie decyduje serwer |
| 7 | Dyktowanie w dolnym polu | Sam czerwony mikrofon, potem samo kółko | „Nagrywam…” (na czerwono) i „Przepisuję…” w polu, kropki na mikrofonie |
| 8 | Historia czatu | Wyglądała jak pusta rozmowa, potem wiadomości wskakiwały | „Wczytuję rozmowę” pod powitaniem (telefon i panel na komputerze) |
| 9 | Kolejne szukanie (komputer) | Stare wyniki bez sygnału | „Szukam” nad przygaszonymi wynikami |
| 10 | Błąd chmury | Cisza; „Brak wpisu” wyglądał na prawdę, nieudana wysyłka niewidoczna | Komunikat pod nagłówkiem i „Spróbuj ponownie” |
| 11 | Wylogowanie z menu Konto (komputer) | Menu znikało, nic się nie działo | Menu czeka z napisem „Wylogowuję” |

## Decyzje projektowe

- **Tekst + kropki, nie same kropki.** Napis mówi, co się dzieje, kropki tylko że trwa.
- **Stan ładowania na środku wolnego miejsca** między nagłówkiem a dolnym paskiem, tak jak
  w Dzienniku. X w komunikacie wyśrodkowany w pionie, nie przypięty do rogu.
- **Brak danych ≠ brak wpisów.** Pusty stan pokazujemy dopiero, gdy wiadomo, że pusto:
  sesja ustalona i pobieranie z chmury zakończone (`useEntriesSyncing` w `src/lib/auth.ts`).
- **Nieznany plan to nie „Free”.** Dopóki plan się wczytuje, nie ma kłódek ani „Przejdź na Pro”.
- **Błąd chmury nie blokuje pisania.** Zapis lokalny działa dalej, komunikat tylko informuje.

## Zmiany techniczne, na które warto uważać

- `src/lib/sync.ts`: `pullAll` zwraca `null` przy błędzie (było `[]`), `pushAll` zwraca obietnicę
  i zgłasza wynik do `src/lib/sync-status.ts`.
- `src/app/api/billing/checkout/route.ts`: `success_url` to `/settings?upgraded=pro|max` (było
  `upgraded=1`, nadal obsługiwane). Dzięki temu przejście z Pro na Max czeka na Max.
- `src/hooks/use-plan.ts`: stan błędu (`usePlanFailed`), ponowienie (`reloadPlan`) i aktywacja po
  płatności (`usePlanActivating`).
- Nowe pliki: `tap-feedback.tsx`, `ui/loading-dots.tsx` (`LoadingDots`, `LoadingText`),
  `entry-missing.tsx`, `sync-notice.tsx`, `lib/haptics.ts`, `lib/sync-status.ts`,
  `hooks/use-page-restored.ts`.

## Jak to sprawdzono

- `tsc`, `eslint`, 109 testów `vitest`, `next build`, CI na PR.
- Scenariusze Playwright na lokalnym buildzie z podstawionym Supabase i spowolnionymi
  odpowiedziami (testowa sesja, żadne prawdziwe konto): `testy/ba.js` robi zrzuty „jest” i „ma być”
  (`LABEL=jest` / `LABEL=ma-byc`, wybór scenariuszy przez `ONLY=photo,sync,...`).
- Produkcja po scaleniu, tylko tryb gościa: `testy/prolog-prod.js` (14 sprawdzeń, wszystkie OK).
- Uruchomienie lokalne: `.env.local` z `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`
  i dowolnym kluczem testowym, `npm run build`, `npm start -- -p 3102`, potem skrypt z `testy/`
  (wymaga Playwright; `lib.js` blokuje analitykę). Ścieżki w skryptach trzeba dopasować.

## Otwarte

- [ ] **Sprawdzić na swoim telefonie i koncie:** logowanie, pobranie wpisów, plan w Ustawieniach.
- [ ] Wibracja na prawdziwym Androidzie.
- [ ] Hamburger na telefonie zasłania „Wyloguj” w Ustawieniach, a pole notatki tekst pod kalendarzem
      na `/stats` (zajmuje się tym osobna sesja).
- [ ] Przejście `router.push` w kodzie (np. po zapisie wpisu) nie pokazuje paska ładowania.
- [ ] Wyjście z kreatora w trakcie wgrywania zostawia zdjęcie w Storage (sierota).
- [ ] Plan nie jest czyszczony po wylogowaniu: inne konto w tej samej karcie widzi przez chwilę stary plan.
- [ ] Spinnery `Loader2` zostały w: `api-token-manager`, `photo-field` (miniatura),
      `photo-gallery`, `rich-text-editor`, `usage-dashboard`.

## Dalej: redesign UI

Trzy kierunki nowego UI są w artefakcie [ProLog Redesign](https://claude.ai/artifact/ANCJPbLXTp7vYtC6RWNp2a):
A · Monolit (obecna czerń i biel, mniej szumu), B · Tabula (wosk i orzech, dziennik jak książka),
C · Mozaika (jasno, kolor = samopoczucie). Następny krok: wybrać kierunek i ekran, od którego
zaczynamy. Kontekst produktu: `PRODUCT.md`.
