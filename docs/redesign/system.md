# System „Monolit” (redesign ProLoga)

Jedno źródło prawdy: `src/app/globals.css` (sekcja „System Monolit — tokeny”). Ekrany korzystają
wyłącznie z tokenów — bez własnych kolorów, rozmiarów czcionki, promieni i czasów ruchu.

Kierunek wybrany 3.11.2026: **A · Monolit** z krojem **Atkinson Hyperlegible Next**, ocena dnia
**przyciskami 1–5** (nie suwakami). Uzasadnienie: `inspiracje.md` i `README.md` w tym folderze.

## Kolor

Czerń i biel z ledwie chłodną szarością (odcień 260, chroma ≤ 0,008). Ciemny motyw jest główny:
ciemnoszare tło zamiast czerni, złamana biel tekstu, wyższe powierzchnie są jaśniejsze, akcenty
jaśniejsze i mniej nasycone niż w jasnym motywie. Jedyny kolor poza szarością to semantyka.

| Token | Rola | Jasny | Ciemny |
|---|---|---|---|
| `background` | tło strony | `#f9fafb` | `#121314` |
| `card` | karta, pole pisania | `#ffffff` | `#18191b` |
| `popover` | warstwa nad treścią (menu) | `#ffffff` | `#1e1f22` |
| `muted` / `accent` / `secondary` | ciche wypełnienie, hover, zaznaczony wiersz | `#eff0f2` | `#212325` |
| `foreground` | treść | `#16171a` | `#e5e6e9` |
| `muted-foreground` | opis | `#505357` | `#a9abaf` |
| `subtle-foreground` | metadane | `#66696e` | `#909296` |
| `primary` / `primary-foreground` | akcja główna (odwrócona tinta) | `#16171a` / `#f9fafb` | `#e5e6e9` / `#121314` |
| `border` | linia dekoracyjna | `#e0e1e3` | `#2c2e30` |
| `input` | obwódka kontrolek | `#8b8c8f` | `#67696c` |
| `ring` | pierścień fokusu | `#52555b` | `#a1a5ab` |
| `attention` | ocena, która wymaga uwagi | `#b34917` | `#e99d67` |
| `destructive` | błąd, usuwanie | `#cc2827` | `#ed756e` |
| `meter-off` | puste segmenty miernika 1–5 | `#d6d7da` | `#36383b` |

Kontrast zmierzony skryptem (WCAG 2.x, w obu motywach), 0 błędów:

- tekst (`foreground`, `muted-foreground`, `subtle-foreground`) ≥ 4,5:1 na każdej powierzchni
  (`background`, `card`, `popover`, `muted`); najsłabszy: `subtle-foreground` na `muted` w jasnym
  motywie, 4,83:1;
- `attention` i `destructive` jako tekst ≥ 4,5:1 (najsłabszy 4,71:1);
- obwódka pól (`input`) ≥ 3:1 (WCAG 1.4.11), pierścień fokusu ≥ 6:1.

Kolor nigdy nie niesie znaczenia sam: obok koloru „uwagi” zawsze stoi słowo poziomu („Słabo”,
„Duży”), przy stresie strzałka w dół (mniej znaczy lepiej).

## Typografia

Atkinson Hyperlegible Next (Braille Institute, OFL) — projektowany pod czytelność dla
słabowidzących, więc dobry dla zmęczonych oczu wieczorem; wersja Mono do liczb w kolumnach.
Ładowany przez `next/font` z `latin-ext` (polskie znaki od razu). next/font nie zna jeszcze jego
metryk, więc krój zastępczy dobraliśmy pomiarem: Atkinson ma 98,97% szerokości Arial przy tym samym
tekście, wznoszenie 0,99 em, zejście 0,32 em. Po doczytaniu kroju tekst się nie przesuwa.

Pięć stopni i nic pomiędzy; na jednym ekranie najwyżej pięć rozmiarów (zmierzone):

| Klasa | Rozmiar / interlinia | Do czego |
|---|---|---|
| `text-caption` | 12 / 16 px | metadane, podpisy zakładek, nazwy ocen |
| `text-ui` | 14 / 20 px | interfejs, opisy, listy |
| `text-body` | 16 / 24 px | treść wpisu (interlinia 1,65), wszystkie pola tekstowe |
| `text-title` | 20 / 28 px | tytuł ekranu na telefonie, tytuł sekcji |
| `text-display` | 32 / 38 px | tytuł wpisu |

Pola tekstowe mają zawsze 16 px — mniejszy tekst sprawia, że iOS przybliża stronę przy pisaniu.
Akapit ma najwyżej 65 znaków. Nagłówki `text-wrap: balance`, akapity `pretty`.

## Odstępy, promienie, cienie

- **Odstępy:** siatka 4 px (`--spacing` Tailwinda), tylko pełne kroki: 4, 8, 12, 16, 24, 32, 40,
  48, 64. Wyjątki optyczne 2 px tylko wewnątrz komponentu (wyrównanie tekstu w polu z przyciskiem).
- **Promienie:** 6 px plakietki · 10 px kontrolki, wiersze, kafelki dni · 16 px powierzchnie (karty,
  pole pisania, menu) · pełne koło dla przycisków-pigułek i awatarów.
- **Cienie:** tylko dla warstw nad treścią (`shadow-raised`, `shadow-overlay`). W ciemnym motywie
  głębię daje jaśniejsza powierzchnia; jedna elewacja na element (cień albo obwódka, nie oba).

## Ruch

Ruch tylko wtedy, gdy coś wyjaśnia: do 300 ms, ease-out `cubic-bezier(0.23, 1, 0.32, 1)`,
wyłącznie `transform` i `opacity` (kolory zmieniają się krótko, bez ruchu). Nigdy `transition: all`.

| Token | Czas | Gdzie |
|---|---|---|
| `--duration-press` | 120 ms | wciśnięcie |
| `--duration-fast` | 160 ms | drobne zmiany, zmiana dnia, wyjście menu |
| `--duration-base` | 220 ms | wejście menu „Więcej” |
| `--duration-slow` | 300 ms | zmiana motywu (View Transitions) |

`prefers-reduced-motion` i przełącznik „Animacje interfejsu” w Ustawieniach (`html.no-anim`)
zerują ruch. Reakcja na dotyk z PR #25 (`data-pressed`) zostaje natychmiastowa.

## Elementy wspólne

- `Button` — pigułka, płaska; na telefonie każdy rozmiar ≥ 44 px wysokości, na komputerze 32–40 px.
- `Input`, `Textarea` — 44 px na telefonie, tekst 16 px, obwódka `input`, fokus pogrubia obwódkę.
- `Meter` — miernik 1–5 (segmenty poziome w pulsie dnia, pionowe kreski na liście).
- `DayPulse` — pięć ocen wpisu w zwartym bloku; układ zależy od miejsca (zapytanie o kontener):
  dwie kolumny w wąskiej kolumnie, pięć w rzędzie od 32 rem.
- `LoadingDots` / `LoadingText` — jedyny wskaźnik oczekiwania (bez spinnerów), zawsze z tekstem.
- `cn()` zna tokeny (`tailwind-merge` rozszerzony o `text-caption…display` i `shadow-raised…`),
  inaczej rozmiar znikałby obok koloru tekstu.

## Nawigacja

Jedna na ekran. Telefon: dolny pasek z PR #26 (Dziennik, Rozmowa, Nowy wpis na środku, Statystyki,
Więcej) — zmieniony wygląd, nie układ. Komputer: pasek boczny z tymi samymi nazwami w tej samej
kolejności; Ustawienia i Dokumentacja na dole, jak „Więcej”. Bez górnego paska: każdy ekran ma
własny tytuł, motyw ustawia się w Ustawieniach → Wygląd.

## Kontrola przed pokazaniem ekranu

Skrypty w `docs/redesign/narzedzia/` (Playwright, systemowy Edge): 12 szerokości (320, 360, 375,
393, 430, 768, 834, 1024, 1280, 1366, 1440, 1920) × jasny i ciemny motyw. Mierzą: poziome
przepełnienie strony, elementy poza ekranem, ucięty tekst, cele dotyku (< 44 px na telefonie),
liczbę rozmiarów czcionki w kadrze i kontrast każdego tekstu względem jego tła.
