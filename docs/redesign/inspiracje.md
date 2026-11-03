# Inspiracje do redesignu ProLoga (stan na 3.11.2026)

Na czym się wzorujemy i co z tego wynika dla ProLoga. Zebrane z dokumentów projektu, artefaktu
z trzema kierunkami i researchu w sieci. Źródła są na dole.

## Wniosek

- **Kompas już mamy.** `PRODUCT.md` (użytkownik, marka, zasady, anty-referencje) i referencje z PRD
  (Stoic, Liven, ABY Journal) wyznaczają kierunek. Research go potwierdza, nie zmienia.
- **Polecany kierunek: A · Monolit z krojem Atkinson Hyperlegible Next.** Jest najbliżej zasady
  „interfejs ma znikać, gdy piszesz”, ciemnego motywu jako głównego i wzorca Stoic.
  B · Tabula daje najmocniejszą tożsamość i historię do portfolio (polski krój Brygada 1918), ale
  jest bardziej „widocznym” designem. C · Mozaika jest jasna, a `PRODUCT.md` mówi, że główny jest
  tryb ciemny; łatwo też otrzeć się o anty-referencję „pastelowe wellness”. Decyzja należy do Jakuba.
- **„Niewidoczny design” to konkretne reguły**, nie hasło: Rams (dyskretność), Calm Technology
  (minimum uwagi), Rauno Freiberg (detale interakcji), wytyczne Vercela (checklista), Emil Kowalski
  (ruch). Rozpisane niżej jako reguły dla ProLoga.

## Co już jest w projekcie

- **PRD, sekcja 5 „Referencje”** (zrzuty z Mobbin): Stoic (rytuał dnia, kreator krok po kroku,
  czerń i biel), Liven (oś czasu wpisów, wyraźne CTA pisania), ABY Journal (lekki wskaźnik nastroju).
- **W kodzie:** lista, kreator i kropki „w stylu Stoic”, widok dnia „w stylu Imperfect”, przełącznik
  person jak selektor modelu w czatach AI.
- **`PRODUCT.md`:** pisanie pierwsze; jedna nawigacja bez hamburgera (dziś jest hamburger: do zmiany);
  dane mówią kierunkiem; pusty stan zaprasza; prywatność widoczna; WCAG 2.2 AA; ciemny motyw główny;
  kolor nigdy jedynym nośnikiem znaczenia.
- **Artefakt [ProLog Redesign](https://claude.ai/artifact/ANCJPbLXTp7vYtC6RWNp2a):** diagnoza obecnego UI
  i trzy kierunki na 10 ekranach:
  - A · Monolit: obecna czerń i biel, Geist + Geist Mono, mniej szumu, jasna hierarchia.
  - B · Tabula: wosk i orzech, Brygada 1918 + Hanken Grotesk, „dziennik jak książka czytana wieczorem”.
  - C · Mozaika: jasno, Bricolage Grotesque, kolor = samopoczucie, suwak z pięciu kolorów skali.
  - Kroje do wyboru: Geist (obecny), Atkinson Hyperlegible Next (polecany w artefakcie), Onest.
- **Zrzuty obecnego stanu:** `Desktop/SCREENSHOTY PROLOG` (DESKTOP, MOBILE) i
  `docs/2026-11-stany-oczekiwania/zrzuty/`.

## Wzorce z rynku: co wziąć, czego unikać

| Aplikacja | Co wziąć | Czego unikać | Gdzie w ProLogu |
|---|---|---|---|
| **Stoic** | Rytuał dnia: jasna karta „Morning”, ciemna „Evening”; prawie wyłącznie czerń i biel; wieczorne pytania nawiązują do porannego zamiaru | Rozrostu funkcji: część recenzji mówi o przytłoczeniu wyborem | Dziennik, Nowy wpis (A) |
| **Day One** | Patrzenie wstecz: „On This Day” (ten dzień w poprzednich latach), kalendarz, wyszukiwanie, mapa. Recenzje 2026 nadal nazywają go najlepiej zaprojektowanym dziennikiem | Zmian układu osi czasu bez możliwości powrotu: użytkownicy się skarżyli | Dziennik, Statystyki |
| **iA Writer** | Tryb skupienia: przygasza wszystko poza bieżącym akapitem i chowa nagłówek; prawie żadnych ustawień | Robienia z tego trybu domyślnego: sami autorzy polecają go tylko do pisania szkicu, części osób przeszkadza | Nowy wpis, edycja |
| **How We Feel** | Emocje ułożone w spójny system kolorów, trendy w czasie; projekt z naukowcami (Yale). Nagroda App Store 2022 | Koloru jako jedynego nośnika: obok koloru zawsze słowo lub liczba | Statystyki, skala nastroju (C) |
| **Apple Journal** (iOS 26) | Sugestie liczone na urządzeniu (prywatność), wiele dzienników, bogaty układ wpisu, mało ustawień w samej aplikacji | Wyskakujących okienek sugestii: skargi użytkowników | Prywatność, Ustawienia |
| **Linear** (odświeżenia 2024 i 2026) | Nie wszystko ma tę samą wagę: zadanie w centrum, nawigacja się cofa; mniej separatorów, łagodniejszy kontrast. Już przy przebudowie w 2024 r. pisali, że taką zmianę czuć po kilku minutach używania, a nie widać od razu | Gęstości informacji z narzędzia pracy | Cała aplikacja (A) |
| **grug** (Apple Design Award 2026, Delight and Fun) | Dowód, że mała aplikacja do codziennej refleksji (krótkie podpowiedzi) wygrywa nagrodę za design. Obejrzeć w App Store | — | Rytm i ton tekstów |
| **Rosebud** | Konkurent AI-first: rozmowa z AI na podstawie wpisów (por. `MONETYZACJA.md`). Omawiany głównie za AI, nie wygląd | Ciężkiego „czatbotowego” UI | Rozmowa |

Gdzie oglądać ekrany: Mobbin (Stoic, Day One, How We Feel), App Store (grug, Structured), artefakt.

## Niewidoczny design: zasady → reguły dla ProLoga

1. **Dieter Rams, zasada 5: dobry design jest dyskretny.** Nic nie przeszkadza w pisaniu, zero ozdobników
   konkurujących z treścią.
2. **Calm Technology (Amber Case, na bazie prac Weisera i Browna z Xerox PARC): technologia ma wymagać
   minimum uwagi i korzystać z peryferii.** AI, statystyki i komunikaty siedzą z boku i nie krzyczą;
   komunikat o błędzie chmury informuje, nie blokuje.
3. **Rauno Freiberg, „Invisible Details of Interaction Design”:**
   - gest odpowiada od razu, w trakcie ruchu palca, a nie po przekroczeniu progu;
   - animacje dają się przerwać, ruch pokazuje, skąd element przychodzi i dokąd wraca;
   - bez animacji przy częstych, oczywistych akcjach (menu, przełączanie zakładek);
   - gdy nie ma ruchu, potrzebne małe potwierdzenie (u nas: `data-pressed`);
   - ważne cele przy krawędziach, w zasięgu kciuka.
4. **Wytyczne interfejsu Vercela (checklista do każdego PR):**
   - cele dotyku co najmniej 44 px na telefonie;
   - pola tekstowe co najmniej 16 px na telefonie, inaczej iOS przybliża stronę przy wpisywaniu.
     **W ProLogu do poprawy:** pole w dolnym pasku (`composer-input.tsx`) ma `text-sm` (14 px);
   - stan w adresie URL (powrót, odświeżenie, link działają);
   - optymistyczne UI z cofnięciem, potwierdzenie albo „Cofnij” przy usuwaniu;
   - animujemy tylko `transform` i `opacity`, nigdy `transition: all`.
     **W ProLogu do poprawy:** `transition-all` w `ui/button.tsx` i `theme-toggle.tsx`;
   - `color-scheme` na `<html>` w ciemnym motywie, safe-area, brak zbędnych pasków przewijania;
   - zaprojektowane stany: pusty, rzadki, gęsty, błąd; każdy ekran ma następny krok;
   - daty i liczby w formacie polskim.
5. **Ruch według Emila Kowalskiego** (na podstawie streszczeń jego zasad; dokładne liczby sprawdzić
   na emilkowal.ski):
   - ruch w UI do 300 ms, domyślnie ease-out;
   - wciśnięcie 100–160 ms, podpowiedzi 125–200 ms, rozwijane listy 150–250 ms, szuflady i okna
     200–500 ms;
   - mocny ease-out, np. `cubic-bezier(0.23, 1, 0.32, 1)`.
6. **Ciemny motyw (wytyczne Material Design):**
   - ciemnoszare tło zamiast czystej czerni (Material podaje `#121212`), bo męczy oczy mniej;
   - złamana biel tekstu zamiast `#FFFFFF`, które „drga” na ciemnym tle;
   - akcenty jaśniejsze i mniej nasycone;
   - wyżej położone powierzchnie są jaśniejsze, zamiast cieni.
   Pasuje do sceny z `PRODUCT.md`: wieczór, przyciemnione światło, zmęczone oczy.

## Typografia: fakty do decyzji

- **Atkinson Hyperlegible Next**: Braille Institute, premiera 10.02.2025. 7 grubości z kursywami,
  ponad 150 języków, wersja zmienna i monospace, licencja OFL, Google Fonts. Projektowany z myślą
  o słabowidzących, więc dobry dla zmęczonych oczu wieczorem.
- **Brygada 1918** (kierunek B): polski krój odtworzony z przedwojennych matryc z Muzeum Książki
  Artystycznej w Łodzi, na 100-lecie niepodległości. Autorzy: Mateusz Machalski, Borys Kosmynka,
  Ania Wieluńska, Przemysław Hoffer. Rozszerzony z Google w 2020, licencja OFL. Dobra historia do
  case study: polski dziennik, polski krój.
- **Geist**: obecny krój ProLoga (kierunek A w artefakcie).

## Źródła

- Zasady i wzorce: [Vitsœ, dobry design (Rams)](https://vitsoe.com/us/about/good-design),
  [zasady Calm Technology](https://calmtech.institute/calm-tech-principles),
  [O'Reilly: zasady Calm Technology](https://oreilly.com/content/principles-calm-technology-we-are-not-bad-at-technology-technology-is-bad-at-us),
  [Rauno Freiberg: Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design),
  [Vercel: Web Interface Guidelines](https://vercel.com/design/guidelines),
  [Material Design: dark theme](https://m2.material.io/design/color/dark-theme),
  [streszczenie zasad animacji Emila Kowalskiego](https://agent-skills.md/skills/pproenca/dot-skills/emilkowal-animations).
- Aplikacje: [Stoic w App Store](https://apps.apple.com/us/app/stoic/id1312926037),
  [MobileSyrup: recenzja Stoic](https://mobilesyrup.com/2019/06/09/stoic-self-reflection-journaling-app-review/),
  [Day One: On This Day](https://dayoneapp.com/guides/tips-and-tutorials/on-this-day),
  [MakerStack: recenzja Day One 2026](https://makerstack.co/reviews/day-one-review/),
  [iA Writer: tryb skupienia](https://ia.net/writer/support/editor/focus-mode/focus-mode-windows),
  [Apple: How We Feel, App Store Awards 2022](https://apps.apple.com/us/story/id1647059928),
  [Yale: How We Feel](https://medicine.yale.edu/news-article/the-how-we-feel-app-helping-emotions-work-for-us-not-against-us/),
  [Wikipedia: Apple Journal](https://en.wikipedia.org/wiki/Journal_(Apple)),
  [MacRumors: sugestie w Journal](https://www.macrumors.com/how-to/disable-journaling-suggestions-iphone-journal-app/),
  [Linear: odświeżenie designu](https://linear.app/now/behind-the-latest-design-refresh),
  [Linear: jak przeprojektowaliśmy UI](https://linear.app/blog/how-we-redesigned-the-linear-ui),
  [Apple: zwycięzcy Apple Design Awards 2026](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/),
  [Rosebud: najlepsze aplikacje do dziennika](https://www.rosebud.app/blog/best-journaling-apps-for-adults).
- Typografia: [Atkinson Hyperlegible Next (Fontsource)](https://fontsource.org/fonts/atkinson-hyperlegible-next/about),
  [premiera Atkinson Hyperlegible Next](https://lbbonline.com/news/applied-design-launches-atkinson-hyperlegible-next-typeface),
  [Brygada 1918 (Typoteka)](https://typoteka.pl/en/typeface/brygada-1918),
  [Google Design: Brygada 1918](https://design.google/library/type-detectives-give-life-brygada-en).

Uwaga: część źródeł to recenzje i zestawienia pisane przez producentów aplikacji. Traktujemy je jako
wskazówki, a ekrany sprawdzamy na żywo.
