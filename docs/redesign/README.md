# Redesign ProLoga: „Monolit”

Cel: nowoczesny, dopracowany interfejs, w którym design jest niewidoczny — użytkownik myśli o swoim
dniu, nie o aplikacji. Kontekst produktu: `PRODUCT.md` w katalogu głównym.

## Decyzje (3.11.2026)

- **Kierunek A · Monolit** z krojem **Atkinson Hyperlegible Next** (spośród A Monolit, B Tabula,
  C Mozaika z artefaktu [ProLog Redesign](https://claude.ai/artifact/ANCJPbLXTp7vYtC6RWNp2a)).
- **Ocena dnia przyciskami 1–5**, nie suwakami: jedno stuknięcie = dokładna wartość, widać, czego
  jeszcze nie oceniono, nic nie przestawia się przypadkiem przy przewijaniu.
- Ciemny motyw jest główny. Dolny pasek z PR #26 zostaje w układzie (5 zakładek, „Nowy wpis” na
  środku, „Więcej” na końcu) — zmienia się wygląd.

## Dokumenty

| Plik | Co zawiera |
|---|---|
| [inspiracje.md](inspiracje.md) | wzorce z rynku, reguły „niewidocznego designu” ze źródłami |
| [system.md](system.md) | tokeny (kolor, typografia, odstępy, promienie, cienie, ruch) z pomiarami kontrastu |
| [01-system-i-dziennik.md](01-system-i-dziennik.md) | krok 1: system, powłoka i Dziennik — decyzje, pomiary, zrzuty i GIF-y „jest / ma być” |
| [narzedzia/](narzedzia/README.md) | skrypty pomiarowe: audyt 12 szerokości × 2 motywy, zrzuty, GIF-y, kontrast |

## Kolejność ekranów

| # | Ekran | Stan |
|---|---|---|
| 1 | System + powłoka + Dziennik (widok dnia) | ten PR |
| 2 | Nowy wpis (jeden ekran, oceny przyciskami 1–5) | dalej |
| 3 | Wpis (z kolumną „Freud o tym dniu”) | dalej |
| 4 | Rozmowa | dalej |
| 5 | Statystyki | dalej |
| 6 | Ustawienia | dalej |
| 7 | Logowanie | dalej |
| 8 | Strona główna | dalej |
| 9 | Cennik | dalej |
| 10 | Dokumentacja API | dalej |

## Kontrola każdego ekranu przed pokazaniem

Jedna główna akcja; interfejs znika, gdy piszesz; jedna nawigacja i nic pływającego nad treścią;
nic nie skacze przy ładowaniu; każde stuknięcie ma odpowiedź, ruch do 300 ms (ease-out, transform
i opacity, z „ogranicz ruch” i wyłącznikiem animacji); te same tokeny wszędzie; kontrast AA w obu
motywach, cele dotyku ≥ 44 px, pola ≥ 16 px, safe-area, brak poszerzania na 375 px; polskie znaki
i cudzysłowy „”; zero dekoracji konkurującej z treścią.
