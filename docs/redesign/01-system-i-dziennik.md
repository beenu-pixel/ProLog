# 1. System „Monolit” i Dziennik (4.11.2026)

Pierwszy krok redesignu: zapis kierunku jako tokenów, nowa powłoka (jedna nawigacja) i najważniejszy
ekran — Dziennik z widokiem dnia. Pozostałe ekrany dostały na razie tylko nowe tokeny (krój, kolory,
przyciski); ich przebudowa idzie kolejnymi PR-ami.

## W skrócie

- **Design ma znikać.** Ciemnoszare tło zamiast czerni, złamana biel tekstu, jeden krój o pięciu
  rozmiarach, żadnego paska u góry. Na ekranie dnia zostaje dzień: tytuł, oceny, tekst.
- **Jedna nawigacja.** Telefon: dolny pasek z PR #26 (nowy wygląd, ten sam układ). Komputer: pasek
  boczny zamiast górnego paska, linków i pływającego pola.
- **Pusty dzień zaprasza.** Zamiast „Brak wpisu na ten dzień.” — „Jak minął dzień?” i jedna akcja.
- **Sprawdzone pomiarem**, nie „na oko”: 12 szerokości × 2 motywy, 0 problemów na ekranie Dziennika.

## Problem (z diagnozy w artefakcie)

| Waga | Co przeszkadzało | Co zrobiliśmy |
|---|---|---|
| P1 | Pływające pole notatki zasłania listę na komputerze | Pole jest tylko tam, gdzie się pisze: na dole telefonu i w rozmowie; na komputerze nic nie pływa nad treścią |
| P1 | Nawigacja w trzech miejscach | Jedna na ekran: dolny pasek albo pasek boczny, te same nazwy i kolejność |
| P1 | Metryki jako ramka z pięcioma wierszami kropek, bez kierunku | „Puls dnia”: krótka nazwa, miernik, słowo; stres ze strzałką w dół, kolor uwagi przy słabym dniu |
| P1 | Pusty dzień to pusty ekran | Zaproszenie „Jak minął dzień?” z przyciskiem „Napisz wpis” |
| P2 | Zatłoczony nagłówek (motyw, dokumentacja, konto) | Motyw → Ustawienia → Wygląd; dokumentacja i konto na dole paska bocznego |
| P2 | Lista powtarza miesiąc przy każdym wpisie | Grupy miesięcy, tytuł wpisu, miernik nastroju w wierszu |
| P3 | Brak charakteru, czysto szara paleta | Atkinson Hyperlegible Next, ledwie chłodna szarość, odwrócona tinta jako akcja |

## Decyzje projektowe

1. **Kierunek A · Monolit z Atkinson Hyperlegible Next**, ocena dnia przyciskami 1–5 (decyzja
   Jakuba 3.11.2026). Monolit jest najbliżej zasady „interfejs znika, gdy piszesz”; Atkinson
   powstał dla słabowidzących, więc wieczorem męczy mniej.
2. **Ciemny motyw jako główny.** Tło `#121314` zamiast `#0a0a0a` (Material: czysta czerń męczy),
   tekst `#e5e6e9` zamiast bieli (biel „drga” na ciemnym), wyższe powierzchnie jaśniejsze,
   kolor uwagi jaśniejszy i mniej nasycony niż w jasnym motywie.
3. **Pięć rozmiarów czcionki**: 12, 14, 16, 20, 32. Pola tekstowe zawsze 16 px — pole w dolnym
   pasku miało 14 px i iPhone przybliżał stronę przy pisaniu.
4. **Bez górnego paska.** Każdy ekran ma własny tytuł. Na telefonie zyskaliśmy 56 px na treść;
   na komputerze pasek boczny trzyma akcję („Nowy wpis”), sekcje i konto.
5. **Rozmowa na komputerze to ekran**, a nie pływający panel nad polem (jak w makiecie A). Panel
   „Freud o tym dniu” przy wpisie wróci w PR „Wpis” jako kolumna obok treści, nie nakładka.
6. **Tytuł przed datą.** Data pod tytułem wpisu, nie nad nim jako „etykieta” — tytuł mówi sam,
   a dzień i tak widać w pasku dni.
7. **Stan ładowania stoi tam, gdzie pojawi się treść** — u góry, w miejscu wpisu (w PR #25 był na
   środku wolnego miejsca). Brak danych ≠ brak wpisów: zaproszenie pojawia się dopiero, gdy wiadomo,
   że pusto (scenariusze #25 to potwierdzają).
8. **Pasek dni pokazuje tydzień**: wybrany dzień odwrócony (widać go bez czytania), dzisiejszy
   podpisany słowem „dziś”, kafelek ma 1/7 szerokości i nie mniej niż 44 px.
9. **Ruch tylko, gdy wyjaśnia**: menu „Więcej” wyrasta z przycisku (0,97 → 1, 220 ms, bez
   odbicia), zmiana dnia to 160 ms pojawienia się, zmiana motywu 300 ms. Usunięta animacja
   szerokości listy (właściwość układu). Reakcja na dotyk z #25 bez zmian.
10. **Krój zastępczy dobrany pomiarem.** next/font nie zna metryk Atkinsona; zmierzyliśmy je
    (98,97% szerokości Arial), więc przy wolnym łączu tekst nie przeskakuje po doczytaniu kroju.

## Przy okazji domknięte

- Pole w dolnym pasku: 14 → 16 px (iOS nie przybliża strony).
- `transition-all` w `ui/button.tsx` i `theme-toggle.tsx` → wyłącznie kolor albo transform/opacity.
- Pasek ładowania przy `router.push` (np. notatka z pola → nowy wpis, zapis wpisu, logowanie):
  zmierzone — na `main` brak, teraz widoczny.
- `Loader2` w `api-token-manager`, `photo-field`, `photo-gallery`, `rich-text-editor`,
  `usage-dashboard` → kropki z tekstem („Generuję”, „Wczytuję tokeny”, „Przepisuję”…).
- Przełączniki w Ustawieniach: cel dotyku 44 px i widoczna obwódka w stanie wyłączonym (≥ 3:1).
- `tailwind-merge` znał tylko domyślne rozmiary: `text-caption` obok koloru tekstu znikał.

## Pomiary

Narzędzia: `narzedzia/` (Playwright, systemowy Edge, podstawiony Supabase).

| Sprawdzenie | Wynik |
|---|---|
| Kontrast tokenów (oba motywy, wszystkie powierzchnie) | 0 błędów; najsłabszy tekst 4,83:1, obwódki ≥ 3,18:1 |
| Audyt Dziennika: dziś, dzień z wpisem, zalogowany, menu „Więcej” × 12 szerokości (320–1920) × 2 motywy | 0 problemów: bez przepełnień, uciętego tekstu, za małych celów, błędów kontrastu |
| Rozmiary czcionki w kadrze (Dziennik) | telefon 12/14/16/20/32, komputer 12/14/16/20 |
| Scenariusze PR #25 (`docs/2026-11-stany-oczekiwania/testy/ba.js`) | wszystkie zachowania bez zmian: zdjęcia, pobieranie, plan, raporty, dyktowanie, historia rozmowy, szukanie, błędy chmury, wylogowanie, płatności |
| Błędy w konsoli przy zrzutach | `main`: błąd hydratacji React #418 na kilku ekranach; nowa wersja: brak |
| `lint`, `typecheck`, `vitest` (120 testów), `next build` | zielone |

**Niesprawdzone:** prawdziwy telefon (iPhone i Android), prawdziwe konto.

## Jest / ma być

Telefon (375 px) i komputer (1440 px), ciemny i jasny motyw.

### Dziennik

![Dziś bez wpisu — telefon](zrzuty/01-system-i-dziennik/dziennik-dzis__telefon.png)
![Dzień z wpisem — telefon](zrzuty/01-system-i-dziennik/dziennik-wpis__telefon.png)
![Pisanie w polu na dole — telefon](zrzuty/01-system-i-dziennik/dziennik-pisanie__telefon.png)
![Wpisy pobierają się z chmury — telefon](zrzuty/01-system-i-dziennik/wczytywanie__telefon.png)
![Zalogowany — telefon](zrzuty/01-system-i-dziennik/zalogowany__telefon.png)
![Menu „Więcej” — telefon](zrzuty/01-system-i-dziennik/wiecej__telefon.png)
![Dziś bez wpisu — komputer](zrzuty/01-system-i-dziennik/dziennik-dzis__komputer.png)
![Wybrany wpis — komputer](zrzuty/01-system-i-dziennik/dziennik-wybrany__komputer.png)
![Wpisy pobierają się z chmury — komputer](zrzuty/01-system-i-dziennik/wczytywanie__komputer.png)
![Zalogowany — komputer](zrzuty/01-system-i-dziennik/zalogowany__komputer.png)

### Powłoka na pozostałych ekranach (tylko tokeny)

![Rozmowa — komputer](zrzuty/01-system-i-dziennik/rozmowa__komputer.png)
![Rozmowa — telefon](zrzuty/01-system-i-dziennik/rozmowa__telefon.png)
![Ustawienia — telefon](zrzuty/01-system-i-dziennik/ustawienia__telefon.png)
![Ustawienia — komputer](zrzuty/01-system-i-dziennik/ustawienia__komputer.png)
![Statystyki — telefon](zrzuty/01-system-i-dziennik/statystyki__telefon.png)
![Statystyki — komputer](zrzuty/01-system-i-dziennik/statystyki__komputer.png)
![Nowy wpis — telefon](zrzuty/01-system-i-dziennik/nowy-wpis__telefon.png)
![Nowy wpis — komputer](zrzuty/01-system-i-dziennik/nowy-wpis__komputer.png)
![Logowanie — telefon](zrzuty/01-system-i-dziennik/logowanie__telefon.png)

### Ruch (GIF, ciemny motyw, prawdziwe tempo)

| | Jest | Ma być |
|---|---|---|
| Menu „Więcej” | ![](gif/menu-wiecej__jest__dark.gif) | ![](gif/menu-wiecej__ma-byc__dark.gif) |
| Zmiana dnia | ![](gif/zmiana-dnia__jest__dark.gif) | ![](gif/zmiana-dnia__ma-byc__dark.gif) |
| Notatka → nowy wpis (odpowiedź serwera spowolniona) | ![](gif/pasek-ladowania__jest__dark.gif) | ![](gif/pasek-ladowania__ma-byc__dark.gif) |

## Dalej

Kolejne PR-y według ważności: Nowy wpis (jeden ekran zamiast sześciu kroków, oceny przyciskami
1–5), Wpis (z kolumną „Freud o tym dniu”), Rozmowa, Statystyki, Ustawienia, Logowanie, Strona
główna, Cennik, Dokumentacja API.
