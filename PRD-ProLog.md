# PRD — ProLog

**Wersja:** 1.0 (Etap 1 — pierwsza skorupa)
**Data:** 2026-06-01
**Status:** Draft do realizacji

---

## 1. Kontekst

ProLog to osobista aplikacja typu dziennik (journaling), która ma pozwolić użytkownikowi
na codzienne zapisywanie wpisów i gromadzenie ich w jednym miejscu.

Aplikacja **aktualnie nie istnieje** — budujemy ją od zera. Pierwszy etap to świadomie
minimalna, działająca "skorupa": jej jedynym zadaniem jest umożliwić dodawanie wpisów
oraz ich przeglądanie. Nie budujemy jeszcze backendu, kont użytkowników ani warstwy AI.

Inspiracją wizualną i funkcjonalną są istniejące aplikacje do refleksji i prowadzenia
dziennika (Stoic, Liven, ABY Journal — patrz sekcja *Referencje*), które łączą prosty
formularz wpisu z przejrzystą listą wcześniejszych refleksji.

**Plan długoterminowy (poza zakresem Etapu 1):**
- Etap 2 — baza danych (trwały zapis wpisów, synchronizacja między urządzeniami).
- Etap 3 — warstwa AI analizująca zgromadzone wpisy i generująca podsumowania/wnioski.

Decyzje techniczne przyjęte dla Etapu 1:
- **Platforma:** aplikacja webowa (React / Next.js), uruchamiana w przeglądarce.
- **Biblioteka UI:** **shadcn/ui** — komponenty UI (przyciski, karty, dialogi, inputy,
  przełącznik motywu itd.) budujemy w oparciu o shadcn/ui, spójnie z minimalistycznym
  stylem Stoic.
- **Edytor tekstu:** **TipTap** (https://tiptap.dev/) — używany na ekranie dodawania/edycji
  wpisu jako edytor pola treści (rich text).
- **Przechowywanie danych:** lokalnie w przeglądarce (`localStorage`) — tymczasowo,
  do czasu zbudowania bazy danych w Etapie 2.

---

## 2. Cel

Zbudować pierwszą działającą wersję ProLog, która pozwala użytkownikowi:

1. **Dodać wpis na dzisiaj** — formularz z polami: tytuł, treść, nastrój oraz
   automatycznie ustawianą datą.
2. **Przeglądać listę wpisów** — chronologiczny widok wszystkich zapisanych wpisów
   w formie skróconej (podgląd).
3. **Otworzyć pojedynczy wcześniejszy wpis** — widok szczegółowy z pełną treścią
   wybranego wpisu.

### Zakres Etapu 1 (in scope)
- 3 ekrany: Dodawanie wpisu, Lista wpisów, Szczegół wpisu.
- Model pojedynczego wpisu: `tytuł`, `treść`, `nastrój`, `data`.
- Zapis i odczyt wpisów z `localStorage`.
- **Edycja** istniejącego wpisu.
- **Usuwanie** wpisu (z potwierdzeniem).
- Nawigacja między ekranami.
- **Tryb jasny i ciemny** z przełącznikiem widocznym na wszystkich ekranach.

### Poza zakresem (out of scope — kolejne etapy)
- Baza danych i backend.
- Logowanie / konta użytkowników.
- Analiza AI i podsumowania.
- Załączniki (zdjęcia), tagi, wyszukiwanie.

### Kryteria sukcesu (Etap 1)
- Użytkownik może dodać wpis i natychmiast zobaczyć go na liście.
- Użytkownik może edytować oraz usunąć istniejący wpis.
- Po odświeżeniu strony wpisy nadal są widoczne (trwałość w `localStorage`).
- Kliknięcie wpisu na liście otwiera jego pełny widok.
- Użytkownik może przełączyć tryb jasny/ciemny na każdym ekranie, a wybór jest
  zapamiętywany po odświeżeniu strony.

---

## 3. Model danych (Etap 1)

Pojedynczy wpis:

| Pole      | Typ      | Opis                                                        |
|-----------|----------|-------------------------------------------------------------|
| `id`      | string   | Unikalny identyfikator (np. UUID/timestamp).                |
| `tytuł`   | string   | Krótki tytuł wpisu (ułatwia przeglądanie listy).            |
| `treść`   | string   | Główna treść wpisu (dłuższy tekst), zapisywana jako **string** (wynik z edytora TipTap). |
| `nastrój` | enum/int | Prosty wskaźnik nastroju/oceny dnia (np. skala 1–5 lub ikona). |
| `data`    | datetime | Ustawiana automatycznie w momencie zapisu wpisu.            |

> **Uwaga o polu `treść`:** w Etapie 1 trzymamy je celowo prosto — jako **string**
> zapisywany **wyłącznie lokalnie** w `localStorage`. To wystarcza do działania skorupy.
> Bardziej rozbudowany format (np. ustrukturyzowane formatowanie z TipTap) można wprowadzić
> w kolejnych iteracjach — bez zmiany założeń Etapu 1.

---

## 4. Ekrany

### Ekran 1 — Dodawanie / edycja wpisu
- Formularz: pole tytułu, pole treści, wybór nastroju.
- **Pole treści korzysta z edytora TipTap** (rich text) — patrz decyzje techniczne.
- Pozostałe kontrolki (input tytułu, wybór nastroju, przyciski) oparte na **shadcn/ui**.
- Data ustawiana automatycznie (dzisiejsza) przy nowym wpisie.
- Przycisk "Zapisz" — dodaje wpis do listy i czyści formularz / przenosi na listę.
- Ten sam ekran działa w trybie edycji: wczytuje istniejący wpis i nadpisuje go po zapisie.

### Ekran 2 — Lista wpisów
- Chronologiczna lista wszystkich wpisów (najnowsze na górze).
- Każdy element pokazuje: datę, tytuł, nastrój i skrócony podgląd treści.
- Kliknięcie elementu → przejście do Ekranu 3 (szczegół).

### Ekran 3 — Szczegół wpisu
- Pełna treść wybranego wpisu: tytuł, data, nastrój, cała treść.
- Akcje: **Edytuj** (→ Ekran 1 w trybie edycji), **Usuń** (z potwierdzeniem).
- **Strzałka powrotu (←) w prawym górnym rogu** — wraca do listy.
- Dolny navbar pozostaje **widoczny** także na tym ekranie.

### Element wspólny — Przełącznik trybu jasny/ciemny
- **Jedyne** ustawienie w aplikacji w Etapie 1 (nie ma osobnego ekranu/zakładki Ustawień).
- Widoczny na **wszystkich** ekranach (ikona słońce/księżyc, np. w nagłówku).
- Przełącza motyw natychmiast; wybór zapamiętywany w `localStorage`.

---

## 4a. Styl UI

Kierunek wizualny oparty na aplikacji **Stoic**:
- Minimalistyczny, dużo przestrzeni (whitespace), wyraźna typografia.
- Paleta zredukowana — **ograniczamy żywe kolory**; bazujemy na czerni, bieli
  i odcieniach szarości, z najwyżej jednym subtelnym akcentem.
- Tryb jasny: jasne tło, ciemny tekst. Tryb ciemny: ciemne tło, jasny tekst —
  oba spójne z tą samą minimalistyczną estetyką.
- Karty z zaokrąglonymi rogami, czytelne przyciski, brak zbędnych ozdobników.
- Nastrój prezentowany dyskretnie (ikona / prosta skala), bez krzykliwych kolorów.

---

## 4b. Nawigacja (dolny navbar — wzorzec Stoic)

Nawigacja w aplikacji opiera się na **stałym dolnym pasku (bottom navbar)** wzorowanym
na aplikacji **Stoic**: zakładka listy po lewej oraz wyróżniony, okrągły przycisk **„+"**
na środku służący do dodawania nowego wpisu.

### Struktura dolnego paska
- **Lewa zakładka — „Wpisy"** → Ekran 2 (lista wpisów). Domyślny ekran startowy.
- **Środek — okrągły przycisk „+"** (wyróżniony, ciemne kółko jak w Stoic) → Ekran 1
  (dodawanie nowego wpisu na dzisiaj).

> Aplikacja w Etapie 1 ma **tylko trzy ekrany** i **nie ma osobnej zakładki Ustawień**.
> Jedyne ustawienie — przełącznik trybu jasny/ciemny — to ikona dostępna na wszystkich
> ekranach (patrz: *Element wspólny — Przełącznik trybu jasny/ciemny*), a nie pozycja
> w navbarze. Pasek jest celowo zredukowany względem Stoic (5 pozycji). Można go
> rozbudować w kolejnych etapach.

### Zachowanie
- Dolny navbar jest widoczny na ekranach **przeglądania**: lista wpisów oraz szczegół wpisu.
- Na ekranie **formularza** (nowy wpis `/new` oraz edycja `/entries/:id/edit`) navbar jest
  **celowo ukrywany**, aby nie zasłaniał treści i nie rozpraszał podczas pisania. Powrót
  z formularza realizują: **strzałka (←)** oraz przycisk **„Anuluj"** w samym formularzu.
- Aktywna zakładka jest wizualnie wyróżniona (pogrubienie / wypełniona ikona).
- **Ekran 3 (szczegół wpisu)** otwiera się po kliknięciu wpisu na liście; navbar pozostaje
  widoczny, a powrót do listy realizuje **strzałka (←) w prawym górnym rogu**.
- Przycisk **„+"** zawsze prowadzi do pustego formularza nowego wpisu. Edycja istniejącego
  wpisu odbywa się z poziomu Ekranu 3 (akcja „Edytuj"), nie przez navbar.

### Routing (URL)
- `/` lub `/entries` — lista wpisów (Ekran 2).
- `/new` — dodawanie nowego wpisu (Ekran 1).
- `/entries/:id` — szczegół wpisu (Ekran 3).
- `/entries/:id/edit` — edycja wpisu (Ekran 1 w trybie edycji).

---

## 5. Referencje

Aplikacje stanowiące inspirację wizualną i funkcjonalną (źródło: Mobbin):

- **Stoic** — ekran "good evening" z kartami akcji, kreator wpisu krok-po-kroku
  ("Write a short summary of your day"), ekran podsumowania ("Good job!").
  Czysty, minimalistyczny, czarno-biały język wizualny.
- **Liven** — ekran "Journal" z osią czasu wpisów pogrupowanych po datach,
  promptami ("What's on your mind?") i wyraźnym CTA "Write out your thoughts".
- **ABY Journal** — karty podsumowań dziennych z emoji nastroju i cytatami.

Wnioski dla ProLog (Etap 1):
- Prosty, jasny formularz dodawania wpisu (jak Stoic).
- Lista/oś czasu wpisów z datą i podglądem (jak Liven).
- Wskaźnik nastroju jako lekki, opcjonalny akcent (jak ABY Journal).

*(Zrzuty referencyjne dostarczone przez użytkownika; nie kopiujemy projektów 1:1 —
służą jedynie jako kierunek.)*

---

## 6. Następne kroki

1. **Setup projektu** — inicjalizacja aplikacji React/Next.js w katalogu `week-1`.
2. **Routing / nawigacja** — skonfigurowanie tras (`/entries`, `/new`, `/entries/:id`,
   `/entries/:id/edit`) oraz **dolnego navbara w stylu Stoic** (Wpisy / „+"), widocznego
   na wszystkich ekranach.
3. **Model i warstwa danych** — zdefiniowanie struktury wpisu oraz modułu zapisu/odczytu
   z `localStorage` (dodawanie, edycja, usuwanie).
4. **Motyw jasny/ciemny** — mechanizm theme + przełącznik widoczny na wszystkich ekranach,
   z zapamiętywaniem wyboru w `localStorage`.
5. **Ekran 1 (Dodawanie / edycja wpisu)** — formularz tytuł / treść / nastrój + zapis,
   obsługa trybu edycji.
6. **Ekran 2 (Lista wpisów)** — render listy z `localStorage`, sortowanie po dacie.
7. **Ekran 3 (Szczegół wpisu)** — widok pojedynczego wpisu + akcje Edytuj / Usuń.
8. **Styling** — minimalistyczny wygląd w stylu Stoic (ograniczone kolory), spójny w obu trybach.
9. **Test ręczny** — dodanie / edycja / usunięcie wpisów, weryfikacja trwałości i przełącznika
   motywu po odświeżeniu.

> Po zakończeniu Etapu 1 przechodzimy do Etapu 2 (baza danych) i Etapu 3 (analiza AI).
