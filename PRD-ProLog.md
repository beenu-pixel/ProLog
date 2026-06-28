# PRD — ProLog

**Wersja:** 3.7 (Etap 8 — Strapi jako źródło prawdy wpisów + analityka PostHog)
**Data:** 2026-06-28
**Status:** Żywy dokument — Etapy 1–2 (fundament, baza + logowanie) oraz Etap 3 (AI: transkrypcja, terapeuta, API/MCP, gating + log zużycia) zrealizowane; Etap 3 rozszerzony o **wyszukiwanie semantyczne/hybrydowe (RAG)** i **5 person terapeuty**; Etap 4 (bezpieczeństwo: sanityzacja XSS, rate-limiting AI, hardening bazy), Etap 5 (**załączniki — zdjęcia wpisów**), Etap 6 (**monetyzacja — plany płatne + Stripe**, strona biznesowa w `MONETYZACJA.md`) Etap 7 (**uszczelnienie płatności — serwerowy Checkout, drugi audyt OWASP**) oraz Etap 8 (**Strapi (Railway) jako źródło prawdy wpisów, analityka PostHog, utwardzenie warstwy zapisu**) zrealizowane

> **Nota o tym dokumencie.** To **żywa specyfikacja**, nie zapis historyczny. Sekcje 1–6
> opisują **fundament** produktu (styl UI, nawigacja, motyw, model danych, zachowania
> ekranów) — te zasady **nadal obowiązują** i są punktem odniesienia przy każdej zmianie
> UI/UX; kolejne etapy je **rozbudowują**, a nie zastępują. Sekcje 7–10 dodają to, co
> doszło później (baza, konto, AI), a **Changelog** mówi *kiedy* dana zdolność powstała.
> Numeracja „Etap 1/2/3” oznacza warstwy produktu narastające w czasie, nie wersje do
> odrzucenia. Gdy zmieniamy coś w UI, aktualizujemy odpowiedni punkt tutaj, by PRD zawsze
> odzwierciedlał bieżący, zamierzony stan aplikacji.

---

## Stan obecny (skrót)

Co już działa w aplikacji:

- **Dziennik z CRUD** — dodawanie, edycja, usuwanie wpisów; tryb jasny/ciemny.
- **Desktop master-detail**, **wyszukiwarka**, **seed** danych, **ekran statystyk**,
  **dźwięki interakcji**, **mobilna nawigacja w hamburgerze**.
- **Trwały zapis w chmurze** po zalogowaniu (Supabase) + **logowanie Google / e-mail**,
  dwukierunkowa synchronizacja z `localStorage`.
- **AI:** dyktowanie głosem (transkrypcja), cyfrowy terapeuta w **5 personach** (m.in. „Freud”)
  z przełącznikiem w stylu Gemini, sterowanie dziennikiem przez **REST API** i **serwer MCP**
  (Personal Access Token), strona `/docs`.
- **Wyszukiwanie semantyczne (RAG):** embeddingi wpisów + **wyszukiwanie wektorowe** z oknem
  „ostatnie 7 dni”; przełącznik „inteligentne wyszukiwanie” w UI oraz ten sam kontekst dla
  terapeuty/agenta (`/api/search`). _(Od Etapu 8 wektor żyje w indeksie `entry_index` +
  `match_entries`, treść ze Strapi; część full-text/RRF wycofana — patrz 15.3.)_
- **Zdjęcia wpisów (Etap 5):** opcjonalne załączniki — prywatny bucket Storage, galeria +
  lightbox pod treścią, dodawanie tylko po zalogowaniu.
- **Publiczny landing (`/`):** czarno-biała strona startowa (popiersie Marka Aureliusza jako
  chmura punktów 3D) z karuzelą person; zalogowany jest przekierowywany do dziennika.
- **Bezpieczeństwo AI:** funkcje AI dostępne **tylko po zalogowaniu** (egzekwowane serwerowo),
  UI AI ukryte przed gościem, log zużycia (`ai_usage`) + panel rozliczalności dla właściciela.
- **Uszczelnienie (Etap 4):** sanityzacja HTML wpisów (ochrona przed XSS), **rate-limiting**
  funkcji AI z dziennym limitem widocznym w UI (ostrzeżenie + blokada), hardening bazy Supabase.
- **Bramkowanie per plan (Etap 6):** tabela `subscriptions` + `plans.ts` (limity AI, dostępne
  persony, głębia RAG zależne od planu), serwerowy **Stripe Checkout** (`/api/billing/checkout`)
  i webhook (`/api/billing/webhook`) jako jedyne źródło prawdy o planie, portal klienta,
  endpoint **raportów AI** tyg./mies. (`/api/reports`). Stronę biznesową opisuje `MONETYZACJA.md`.
- **Uszczelnienie płatności (Etap 7):** `userId` z zaufanego JWT (nie z URL-a), mapowanie planu
  po `price_id`, webhook weryfikuje istnienie konta; walidacja pliku audio (`/api/transcribe`),
  twarde granice `/api/search`, nagłówki bezpieczeństwa HTTP (HSTS, `X-Frame-Options: DENY`, …).
- **Strapi jako źródło prawdy wpisów (Etap 8):** wpisy dziennika żyją w **headless CMS Strapi**
  (Railway); aplikacja zapisuje/czyta je przez serwerowy proxy `/api/cms/entries` (token Strapi
  tylko na serwerze), zachowując UX offline-first (`localStorage`). Supabase pełni teraz rolę
  **indeksu wektorowego** (`entry_index` + RPC `match_entries`: embedding + link do wpisu) —
  RAG/wyszukiwanie działa dalej, treść dociągana ze Strapi. Zdjęcia nadal w Supabase Storage
  (w Strapi tylko linki). Stara tabela `entries` zostaje jako **backup**.
- **Analityka produktowa PostHog (Etap 8, region EU):** pageviews, autocapture/heatmapy,
  nagrania sesji **z maskowaniem treści** (prywatność dziennika), error tracking i identyfikacja
  zalogowanego użytkownika.

Szczegóły w sekcjach 7 (Etap 2), 8 (Etap 3 — w tym 8.6 wyszukiwanie semantyczne),
9 (bezpieczeństwo i rozliczalność AI), 11 (uszczelnienie bezpieczeństwa), 12 (Etap 5 — zdjęcia),
13 (Etap 6 — monetyzacja), 14 (Etap 7 — uszczelnienie płatności + drugi audyt OWASP)
i 15 (Etap 8 — Strapi jako źródło prawdy wpisów + PostHog).

---

## 1. Kontekst

ProLog to osobista aplikacja typu dziennik (journaling), która pozwala użytkownikowi
na codzienne zapisywanie wpisów i gromadzenie ich w jednym miejscu.

Fundamentem produktu (Etap 1) była świadomie minimalna, działająca „skorupa”: dodawanie
i przeglądanie wpisów. Ten fundament — opisany w sekcjach 1–6 — **nadal obowiązuje** jako
bazowa specyfikacja UI, nawigacji, motywu i modelu danych. Kolejne etapy dołożyły do niego
backend (Etap 2) i warstwę AI (Etap 3), opisane w sekcjach 7+.

> **Dla czytelnika z przyszłości:** poniższy opis Etapu 1 to nie „jak było kiedyś”, lecz
> obowiązujące zasady fundamentu. Zmieniając UI/UX, edytuj odpowiedni punkt zamiast traktować
> go jako nieaktualny.

Inspiracją wizualną i funkcjonalną są istniejące aplikacje do refleksji i prowadzenia
dziennika (Stoic, Liven, ABY Journal — patrz sekcja *Referencje*), które łączą prosty
formularz wpisu z przejrzystą listą wcześniejszych refleksji.

**Plan długoterminowy (poza zakresem Etapu 1):**
- Etap 2 — baza danych (trwały zapis wpisów, synchronizacja między urządzeniami). ✅ **Zrealizowany** (Supabase + logowanie) — patrz sekcja 7.
- Etap 3 — warstwa AI analizująca zgromadzone wpisy i generująca podsumowania/wnioski. ✅ **Zrealizowany** (transkrypcja, terapeuta, API/MCP oraz gating AI + log zużycia) — patrz sekcje 8–9.

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

### Poza zakresem Etapu 1 (zrealizowane w kolejnych etapach)
- ~~Baza danych i backend.~~ → ✅ Etap 2 (Supabase).
- ~~Logowanie / konta użytkowników.~~ → ✅ Etap 2 (Google OAuth / e-mail).
- ~~Analiza AI i podsumowania.~~ → ✅ Etap 3 (terapeuta, transkrypcja, API/MCP, gating AI).
- ~~Wyszukiwanie.~~ → ✅ dodane w Etapie 2 (później rozszerzone o wyszukiwanie semantyczne, sekcja 8.6).
- ~~Załączniki (zdjęcia).~~ → ✅ Etap 5 (zdjęcia wpisów, sekcja 12).
- Wciąż poza zakresem: tagi.

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

> W fundamencie (Etap 1) aplikacja miała **trzy ekrany** i **brak osobnej zakładki Ustawień**;
> jedynym ustawieniem był przełącznik jasny/ciemny dostępny na wszystkich ekranach.
> **Stan aktualny:** nawigacja została rozbudowana — doszły m.in. **Ustawienia** i
> **Statystyki**, a na mobile całość kryje się w hamburgerze (`NavMenu`). Zasada „dyskretny,
> zredukowany pasek w duchu Stoic” pozostaje w mocy. Szczegóły: sekcja 7.3.

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
- `/` — **publiczny landing** (Etap 5+); zalogowany użytkownik jest przekierowywany do dziennika.
- `/welcome` — ekran powitalny / wejście do aplikacji.
- `/entries` — lista wpisów (Ekran 2; domyślny ekran dziennika).
- `/new` — dodawanie nowego wpisu (Ekran 1).
- `/entries/:id` — szczegół wpisu (Ekran 3).
- `/entries/:id/edit` — edycja wpisu (Ekran 1 w trybie edycji).
- `/settings`, `/stats`, `/docs` — Ustawienia, Statystyki, dokumentacja API/MCP.

> **Zmiana względem fundamentu:** w Etapie 1 `/` było listą wpisów. Obecnie `/` to publiczny
> landing, a dziennik żyje pod `/entries` (przekierowanie zalogowanych realizuje `SessionRedirect`).

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

> Powyższe kroki Etapu 1 są zrealizowane i stanowią fundament; kolejne etapy (poniżej)
> rozbudowują go o bazę danych i warstwę AI.

---

# Część II — Rozbudowa fundamentu: Etap 2 i Etap 3

> Poniższe sekcje **rozbudowują** fundament z sekcji 1–6 (nie zastępują go). Opisują
> zdolności dołożone po Etapie 1 i odzwierciedlają obecny kod. Zasady stylu, nawigacji
> i motywu z Części I obowiązują również tutaj.

## 7. Etap 2 — Trwałość i konto (zrealizowane)

Cel etapu: wpisy przestają być zamknięte w jednej przeglądarce — są trwale zapisywane
w chmurze i synchronizowane po zalogowaniu, a aplikacja zyskuje konto użytkownika oraz
kilka udogodnień przeglądania.

### 7.1 Baza danych — Supabase
- Backend oparty na **Supabase** (Postgres + Auth). Tabela `entries` przechowuje wpisy
  użytkownika (z kolumną `user_id`).
- `localStorage` pozostaje źródłem działającym **offline**; po zalogowaniu jest
  **mirrorowany** do chmury. _(Od Etapu 8 źródłem prawdy wpisów jest **Strapi** — mirror idzie
  przez serwerowy proxy `/api/cms/entries`, a tabela `entries` w Supabase to **backup**. Patrz 15.1–15.2.)_
- **Dwukierunkowa synchronizacja przy logowaniu:** najpierw `pullAll` → `mergeRemoteEntries`
  (wciągnięcie wpisów z chmury do `localStorage`), potem `pushAll` (wypchnięcie stanu
  lokalnego z powrotem), by oba źródła się zgadzały. Best-effort — błąd sieci nie wywraca
  logowania.
- **Trwałe usuwanie (nagrobki):** usunięcie wpisu jest odporne na brak sesji/sieci.
  `deleteEntry` zdejmuje „nagrobek” (`prolog.pending_deletes`) dopiero **po potwierdzeniu**
  usunięcia w bazie, `mergeRemoteEntries` **pomija nagrobione id** (nie wskrzesza go z chmury),
  a logowanie najpierw domyka zaległe usunięcia (`flushPendingDeletes`) **przed** `pullAll`/merge.
  Rozwiązuje „skasowany wpis wraca z chmury” — wcześniej lokalna kopia była wypychana z powrotem
  przez `pushAll` przy każdym logowaniu.

### 7.2 Logowanie / konto
- **Google OAuth** oraz **e-mail + hasło** (rejestracja z opcjonalnym potwierdzeniem maila).
  Sesję trzyma supabase-js w `localStorage`, z auto-odświeżaniem tokenu i przejęciem
  sesji z URL po powrocie z OAuth.
- Projekt działa w **trybie testowym** (lista testerów).
- Reaktywna sesja przez `useSession()` — pojedyncza subskrypcja `onAuthStateChange`
  dla całej aplikacji.

### 7.3 Nowe ekrany i udogodnienia
- **Ekran Ustawień** (`/settings`) — konto (login/wylogowanie), dźwięki, **animacje
  interfejsu**, a w Etapie 3 także preferencje AI i klucze API. (Aplikacja wyszła poza
  pierwotne „3 ekrany bez Ustawień”.)
- **Ekran Statystyk** — przegląd nastroju/aktywności w czasie (nawigacja po miesiącach).
- **Wyszukiwarka** wpisów + **seed** przykładowych danych + **formatowanie dat** (testy Vitest).
  Tryb lokalny ma ranking trafności — patrz 7.6; tryb „inteligentny” (semantyczny) — patrz 8.6.
- **Desktop master-detail** — dwupanelowy układ listy i szczegółu na szerokich ekranach,
  z **regulowaną szerokością panelu bocznego** (przeciąganie krawędzi, zapamiętywane w `localStorage` przez `sidebar-width`).
- **Publiczny landing (`/`)** — czarno-biała strona startowa w duchu stoickim (popiersie
  Marka Aureliusza jako obracająca się chmura punktów 3D, three.js, z posterem-fallbackiem)
  oraz **karuzela person** terapeuty; CTA prowadzi do wejścia w aplikację.
- **Dźwięki interakcji** (markery + helper `playSound`).
- **Mobilna nawigacja w hamburgerze** (`NavMenu`) — cała nawigacja schowana w menu na mobile.

### 7.4 Zmiany w modelu danych
- Wpis zyskał ustrukturyzowane **metryki** (skala nastroju/dnia) ponad proste pole 1–5.
- W bazie każdy wiersz ma `user_id`; treść (`treść`) zapisywana jako HTML z edytora TipTap.

### 7.5 Dopracowanie UX i animacje (interfejs)
Warstwa szlifu spójna z zasadami stylu z Części I (Stoic: subtelność, brak krzykliwości):

- **Animacje przełączania wpisów — czysty fade.** Treść wpisu (panel szczegółu na desktopie
  oraz widok dnia na mobile po zmianie dnia na pasku) pojawia się łagodnym przenikaniem,
  bez ruchu/„skoku” w pionie (`key` + `animate-in fade-in`).
- **Menu nawigacji — animacja w stylu macOS (Scale).** Panel `NavMenu` wyrasta z narożnika
  przycisku i zwija się do niego (skala z lekkim odbiciem, `transform-origin` po stronie
  przycisku) zamiast wjazdu od dołu.
- **Pływający przycisk menu po prawej** na stronach „tylko nawigacja” (`/settings`, `/docs`)
  — w naturalnym zasięgu kciuka przy obsłudze jedną ręką.
- **Pasek dni (mobile) — zawsze do 7 dni naraz.** Okno przewijania ograniczone do dokładnie
  7 kafelków i wyśrodkowane; na szerszym tablecie nie rozciąga się (spójna koncepcja „tygodnia”),
  na węższym telefonie mieści mniej, a starsze dni odsłania przewijanie (historia 30 dni wstecz).
- **Wykluczanie paneli (mobile): menu ↔ rozmowa z Freudem.** Otwarte jest tylko jedno z nich
  (nie zasłaniają się nawzajem ani wpisywanego tekstu). Po zamknięciu menu rozmowa wraca
  automatycznie, jeśli była otwarta (koordynacja w `nav-menu-store`).
- **Globalny przełącznik „Animacje interfejsu”** (Ustawienia, `motion.ts`) — wyłącza animacje
  i przejścia CSS oraz crossfade motywu (klasa `no-anim` na `<html>`); niezależnie od tego
  aplikacja respektuje systemowe `prefers-reduced-motion`.

### 7.6 Wyszukiwanie lokalne — ranking trafności (`search.ts`)
Tryb zwykły (bez AI) filtruje `localStorage` i **porządkuje wyniki wg trafności** zamiast
samej daty. Dla zapytań liczbowych intencją jest data:

- Token czysto liczbowy znaczy **dzień miesiąca lub rok** (dokładne dopasowanie), a nie dowolny
  podciąg cyfr — dzięki temu `06` nie łapie całego czerwca (miesiąc), a `02` całego 2026 (rok).
- Liczba występująca **w treści** (np. „1500”, „2000”) wciąż się znajdzie, ale **niżej** —
  dopasowania po dacie mają wyższy priorytet niż dopasowania z treści.
- Tokeny tekstowe (tytuł, treść, dzień tygodnia, miesiąc słownie) i pełne daty z separatorem
  (`2026-05-29`, `28.05`) działają jak dotąd; wiele tokenów łączy logiczne AND. Testy: `search.test.ts`.
- **Filtr „pokaż wpisy ze zdjęciami”:** słowa-klucze `zdjęcie`/`fotka`/`fotografia`/`photo`/
  `picture`/`pic` i ich formy zwracają wyłącznie wpisy z załącznikami (filtr `hasPhotos`, **nie**
  dopasowanie tekstu — wpis ze słowem „zdjęcie” w treści, ale bez załącznika, się nie pokaże).
  Prefiksy `fot`/`pic` celowo pominięto, by nie łapać „fotel”/„picnic”. Łączy się z innymi
  tokenami jak AND (np. „zdjęcie środa”).

---

## 8. Etap 3 — Warstwa AI (zrealizowane do tej pory)

Cel etapu: wykorzystać zgromadzone wpisy — wprowadzanie głosem oraz rozmowa/analiza AI nad
dziennikiem, a także udostępnienie dziennika programistycznie (API + MCP).

### 8.1 Transkrypcja głosu (Groq Whisper)
- Przycisk **mikrofonu** w dolnym pasku (`ComposerBar` / `composer-input.tsx`) nagrywa głos
  i wysyła do **`/api/transcribe`**, gdzie serwer woła **Groq Whisper** (`whisper-large-v3-turbo`,
  język polski). Klucz `GROQ_API_KEY` jest **serwerowy** — nigdy w przeglądarce.
- Pierwsza wersja używała Web Speech API; obecnie standardem jest Groq (lepsza jakość polskiego
  i interpunkcja). Hook `useTranscription` zarządza `MediaRecorder` i stanami
  `supported` / `listening` / `transcribing`.

### 8.2 Cyfrowy terapeuta — 5 person
- Czat nad wpisami przez **`/api/therapist`** (model **xAI Grok 4.3**, klucz `XAI_API_KEY`
  serwerowo). Dostępnych jest **5 person** (m.in. psychoanalityczny „Freud”), z różnymi stylami
  rozmowy, przełączanych **przełącznikiem w stylu Gemini**; te same persony prezentuje
  **karuzela na landingu**. Limit zużycia AI jest **wspólny dla wszystkich person** (zmiana
  persony nie resetuje licznika — patrz 11.2).
- **Kontekst warstwowy** pod cache xAI: persona (system) → dziennik (system) → historia
  rozmowy → świeży kontekst UI dołączony do ostatniego pytania użytkownika. Sam dziennik jest
  budowany przez wyszukiwanie hybrydowe (RAG) — patrz 8.6.
- **Zgoda i prywatność:** przed pierwszym użyciem użytkownik akceptuje wysyłanie treści wpisów
  do modelu; zgodę można cofnąć, a historię wyczyścić (Ustawienia).
- Historia rozmów: `localStorage` jako źródło + mirror do Supabase
  (`therapist_conversations` / `therapist_messages`). „Efekt pisania” odtwarzany po stronie
  serwera (chunkowanie słów) — odporny na buforowanie SSE przez proxy/antywirusy.
- Pole w dolnym pasku jest **dwufunkcyjne**: szybka notatka („Zapisz jako wpis” → `/new`)
  oraz rozmowa z Freudem.

### 8.3 REST API `/api/v1`
- Programistyczny dostęp do dziennika: **Create** (dodaj wpis), **Ask** (zapytaj agenta/Freuda
  nad dziennikiem), **Read** (odczyt wpisów dnia).
- Uwierzytelnianie **Personal Access Tokenem (PAT)**: nagłówek `Authorization: Bearer plog_…`.
  W bazie (`api_tokens`) trzymany jest wyłącznie **hash SHA-256** tokenu + prefiks do
  wyświetlania + `last_used_at`. Serwer używa klucza sekretnego Supabase (`SUPABASE_SECRET_KEY`)
  i ręcznie filtruje po `user_id`.
- Logika współdzielona w `src/lib/services/*` (zero duplikacji między REST a MCP).

### 8.4 Serwer MCP (Remote HTTP)
- **`/api/mcp`** (mcp-handler, Streamable HTTP) udostępnia narzędzia
  **`create_entry`**, **`read_entries`**, **`ask_agent`** na tych samych serwisach co REST.
- Ten sam **PAT** do autoryzacji (`withMcpAuth` → `verifyApiToken`).

### 8.5 Dokumentacja `/docs`
- Strona w stylu docs.vercel.com z **zakładkami API / MCP**, opisem endpointów,
  przykładami request/response oraz **generatorem tokenu** (Personal Access Token).

### 8.6 Wyszukiwanie semantyczne i hybrydowe (RAG)
> **Od Etapu 8:** wektory żyją w indeksie `entry_index` (+ RPC `match_entries`), wyszukiwanie jest
> **wektorowe**, a treść dociągana ze Strapi. Opis poniżej (`entries.embedding`, `hybrid_search`,
> full-text/RRF) dotyczy stanu **sprzed migracji** — tabela `entries` jest teraz backupem. Patrz 15.3.

- **Embeddingi wpisów:** każdy wpis ma wektor `entries.embedding` (OpenAI
  `text-embedding-3-small`, 1536 wymiarów; indeks **pgvector + HNSW**). Liczone automatycznie
  przy tworzeniu wpisu (`createEntry`); backfill wykonany dla istniejących wpisów. Klucz
  `OPENAI_API_KEY` jest serwerowy.
- **Wyszukiwanie hybrydowe (`public.hybrid_search`):** łączy podobieństwo wektorowe z
  full-textem przez **RRF** (Reciprocal Rank Fusion) i dokłada **okno „ostatnie 7 dni”** —
  każdy trafiony wpis ma źródło `search` / `recent` / `both`. Serwis `hybridSearch` +
  endpoint **`/api/search`** (zalogowani, z rate-limitem). W UI to przełącznik **„inteligentne
  wyszukiwanie”** (ikona Sparkles) obok zwykłej wyszukiwarki.
- **RAG dla terapeuty/agenta:** kontekst dziennika (8.2 oraz `Ask` w REST/MCP) jest budowany
  z wyników `hybridSearch` (`buildJournalContextFromHits`) — najtrafniejsze wpisy + ostatnie
  7 dni, zamiast całego dziennika. Przy braku `OPENAI_API_KEY` degraduje się do pełnego dziennika.

---

## 9. Etap 3 — Bezpieczeństwo i rozliczalność AI (zrealizowane)

Problem, który rozwiązano: endpointy AI (`/api/transcribe`, `/api/therapist`) działały na
serwerowych kluczach właściciela bez autoryzacji — każdy odwiedzający mógł „przepalać” kredyty
xAI/Groq, bez śladu kto. Wprowadzono zamknięcie funkcji AI za logowaniem oraz rozliczalność
zużycia.

### 9.1 Funkcje AI tylko po zalogowaniu (egzekwowane na serwerze)
- Dostęp do: **transkrypcji**, **terapeuty Freud** i **generowania kluczy API/MCP** wymaga
  zalogowania — weryfikacja tokena sesji Supabase po stronie serwera (nie tylko ukrycie UI).
  Logika rozróżniania sesji JWT od PAT: `src/lib/user-auth.ts`.
- Reszta aplikacji (dziennik, dodawanie/edycja wpisów, statystyki, motyw jasny/ciemny) działa
  **bez zmian** dla wszystkich, również niezalogowanych.

### 9.2 Ukrycie UI AI przed niezalogowanym
- Niezalogowany użytkownik **nie widzi**, że funkcje AI istnieją: ukryte mikrofon i czat
  z Freudem w dolnym pasku oraz sekcje AI/klucze w Ustawieniach. Pozostaje pole notatki
  („Zapisz jako wpis”).
- Strona `/docs` pozostaje widoczna, ale **generator klucza** działa tylko po zalogowaniu.

### 9.3 Log zużycia i panel rozliczalności
- Tabela **`ai_usage`** (konto/e-mail, endpoint, model, liczby tokenów, znacznik czasu) —
  każde wywołanie AI jest przypisane do konta. Zapis przez `src/lib/services/ai-usage.ts`.
- **Panel zużycia per konto** w Ustawieniach (`usage-dashboard.tsx` → `/api/admin/usage`),
  widoczny **tylko dla właściciela** (lista adminów w zmiennej `PROLOG_ADMIN_EMAILS`), by
  widzieć, kto zużywa kredyty xAI/Groq.

---

## 10. Architektura i klucze (skrót techniczny)

- **Frontend/Backend:** Next.js (zmodyfikowana wersja — patrz `AGENTS.md`), React,
  shadcn/ui, TipTap.
- **Baza/Auth:** Supabase (ref `aqdtcggmownyvsnxnjao`).
- **Modele AI:** Groq Whisper (`whisper-large-v3-turbo`) do transkrypcji; xAI Grok 4.3
  do terapeuty/agenta; OpenAI `text-embedding-3-small` do embeddingów (wyszukiwanie semantyczne).
- **Klucze (zmienne środowiskowe, serwerowe):** `GROQ_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`
  (embeddingi; bez niego RAG degraduje się do pełnego dziennika),
  `SUPABASE_SECRET_KEY` (sekret `sb_secret_…`, wymagany przez REST/MCP — inaczej 503),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (klient),
  `PROLOG_ADMIN_EMAILS` (lista właścicieli widzących panel zużycia AI).
- **Personal Access Token:** prefiks `plog_`, w bazie tylko hash SHA-256 (`api_tokens`).
- **Log zużycia AI:** tabela `ai_usage`; funkcje AI egzekwowane serwerowo (`user-auth.ts`).
- **Rate-limiting AI:** tabela `rate_limit_hits` (RLS z jawną polityką deny-all dla
  `anon`/`authenticated` — dostęp tylko kluczem sekretnym, który omija RLS); serwis
  `src/lib/services/rate-limit.ts`; sanityzacja HTML w `src/lib/sanitize.ts`
  (zależność `isomorphic-dompurify`).
- **Headless CMS (Etap 8):** Strapi v5 na Railway (projekt `prolog-cms`, dedykowany Postgres +
  wolumen na uploady), domena `strapi-production-4a7c.up.railway.app`. **Źródło prawdy wpisów** —
  typ `Entry` (`localId`/`userId`, treść, metryki, linki do zdjęć). Dostęp wyłącznie serwerowo
  przez proxy `/api/cms/entries`; surowe API Strapi zablokowane (rola public → `403`).
- **Indeks wektorowy (Etap 8):** `public.entry_index` (embedding + `strapi_doc_id` + `user_id`)
  + RPC `public.match_entries` — wyszukiwanie wektorowe RAG po migracji wpisów do Strapi.
- **Analityka:** PostHog (region EU, `eu.i.posthog.com`) — nagrania sesji + autocapture
  z maskowaniem treści; klucze `NEXT_PUBLIC_POSTHOG_KEY` (publiczny), `NEXT_PUBLIC_POSTHOG_HOST`.
- **Klucze Strapi (serwerowe):** `STRAPI_API_URL`, `STRAPI_API_TOKEN` (full-access — wyłącznie serwer/proxy).

---

## 11. Etap 4 — Audyt i uszczelnienie bezpieczeństwa (zrealizowane)

Cel etapu: po przeglądzie pod kątem najpopularniejszych ataków webowych (OWASP) domknąć
luki aplikacyjne. Audyt potwierdził, że **rdzeń jest solidny**: RLS (`auth.uid() = user_id`)
na wszystkich tabelach, prywatny bucket `entry-photos` z izolacją per-folder
(`(storage.foldername(name))[1] = auth.uid()`), brak IDOR (serwisy serwerowe filtrują po
`user_id` z tokenu/sesji), brak SQL injection (parametryzowane zapytania + RPC), sekrety
wyłącznie po stronie serwera. Uzupełniono trzy obszary.

### 11.1 Sanityzacja treści wpisów (ochrona przed XSS)
- Treść wpisu (HTML z edytora TipTap) jest renderowana przez `dangerouslySetInnerHTML`
  i może trafić do bazy przez REST/MCP `create_entry` (pole `content` przyjmuje dowolny
  markup) — bez czyszczenia byłby to wektor **stored XSS** (np. `<img src=x onerror=…>`).
- **`src/lib/sanitize.ts`** (`sanitizeEntryHtml`, `isomorphic-dompurify`) czyści HTML
  whitelistą tagów zgodną z wyjściem TipTap; usuwa skrypty, atrybuty `on*`, `style`, `iframe`.
- Wpięta **dwuwarstwowo**: przy renderze (szczegół wpisu, mobilny widok dnia — pokrywa
  każde źródło odczytu) oraz na zapisie w `createEntry` (defense in depth). Testy: `sanitize.test.ts`.

### 11.2 Rate-limiting funkcji AI (sufit kosztowy + limit dzienny w UI)
- Problem: zalogowany użytkownik mógł w pętli wywoływać funkcje AI i przepalać kredyty
  xAI/OpenAI/Groq. Wprowadzono limit **per użytkownik** oparty o bazę (`rate_limit_hits`,
  model „jeden wiersz = jedno żądanie”, sprzątanie starych wpisów).
- **Dwa okna:** cichy limit **na minutę** (bezpiecznik anty-pętla) oraz limit **dzienny**
  (dzień kalendarzowy Europe/Warsaw, **reset o północy**) — to on jest pokazywany w UI.
- **Limity** (zawór bezpieczeństwa, nie quota produktowa — kilkukrotnie powyżej realnego
  użycia): persony (terapeuta + agent API) **60/dzień**, transkrypcja **200/dzień**,
  wyszukiwanie **300/dzień**.
- Wpięte w `/api/transcribe`, `/api/therapist`, `/api/search`, `/api/v1/agent` — z nagłówkami
  `X-RateLimit-*` i odpowiedzią `429` (`scope` + `resetAt`). Status dla UI: **`GET /api/limits`**.
- **UI ostrzega i blokuje** (`src/hooks/use-ai-limits.ts`): przy zużyciu **80%** pojawia się
  dyskretne „zostało X”, a po wyczerpaniu elementy wywołujące AI (mikrofon, wysyłka do
  terapeuty, przełącznik inteligentnego wyszukiwania) stają się **nieaktywne** z komunikatem
  „odnowi się o północy”. Limit jest **wspólny dla wszystkich person** (zmiana persony nie
  resetuje licznika).

### 11.3 Hardening bazy Supabase
- Funkcje SQL `hybrid_search` i `immutable_unaccent` dostały **stały `search_path`**
  (`ALTER FUNCTION … SET search_path`) — usuwa ostrzeżenie audytu `function_search_path_mutable`,
  nie ruszając ciała funkcji ani generowanej kolumny `entries.fts`.
- **Polityka deny-all dla `rate_limit_hits`** (migracja `…_rate_limit_hits_deny_policies`):
  tabela miała RLS włączone celowo BEZ polityk (dostęp tylko kluczem sekretnym), co advisor
  Supabase zgłaszał jako `rls_enabled_no_policy`. Dodano jawną politykę `restrictive`
  odmawiającą dostępu `anon`/`authenticated` — zachowanie bez zmian (`service_role`/klucz
  sekretny i tak omija RLS), ostrzeżenie advisora zniknęło, a intencja jest udokumentowana.
- **Wzmocniona polityka haseł** (konfiguracja Auth w panelu): minimalna długość hasła
  podniesiona do **8 znaków** oraz wymóg złożoności (małe + wielkie litery + cyfry).
- **Niedostępne na planie FREE:** ochrona przed wyciekłymi hasłami (HaveIBeenPwned) wymaga
  planu **Pro** — advisor utrzymuje ostrzeżenie `auth_leaked_password_protection`, ale przy
  aktywnych wymaganiach złożoności jest to akceptowalne; do włączenia po ewentualnym upgrade.

---

## 12. Etap 5 — Załączniki: zdjęcia wpisów (zrealizowane)

Cel etapu: dziennik przestaje być wyłącznie tekstowy — wpis może nieść zdjęcia (sam tekst,
same zdjęcia albo oba). Zamyka to pozycję „załączniki” z pierwotnego *poza zakresem*.

### 12.1 Model i przechowywanie
- Wpis przechowuje listę zdjęć jako `EntryPhoto { id, path }` (`src/lib/types.ts`),
  mirrorowaną w `localStorage`. _(Od Etapu 8 linki żyją w polu `photos` (JSON) typu `Entry`
  w **Strapi** — źródle prawdy; kolumna `entries.photos` w Supabase to backup. Pliki bez zmian
  w Storage. Patrz 15.4.)_
- Pliki trafiają do **prywatnego bucketa Storage `entry-photos`**, ścieżka `${userId}/${uuid}.${ext}`.
  RLS izoluje per użytkownik (`(storage.foldername(name))[1] = auth.uid()`).
- **Kompresja przy uploadzie:** obraz jest skalowany (dłuższy bok ≤ 1600 px) i zapisywany jako
  **WebP** (jakość 0.8) po stronie klienta (canvas), z poprawką orientacji EXIF i bezpiecznym
  fallbackiem do oryginału (GIF — zachowanie animacji, brak DOM, błąd dekodowania lub gdy WebP
  wyszedłby większy). Nowe zdjęcia ważą dziesiątki KB zamiast megabajtów — istotne na planie
  **free** (brak transformacji obrazów po stronie CDN).
- Podgląd wyłącznie przez **podpisane URL-e** (`createSignedUrls`, TTL 1 h) — widzi je tylko
  właściciel. **Cache URL-i** (`sessionStorage` per ścieżka, z TTL) sprawia, że ponowne wejście
  we wpis używa tego samego adresu i obraz idzie z **cache przeglądarki** zamiast pobierać się od
  nowa (wcześniej świeży token przy każdym wejściu wymuszał ponowne pobranie). Serwis
  `src/lib/photos.ts` (upload/compress/delete/signed URLs) + hook `use-signed-photo-urls`.
- `deleteEntry` sprząta zdjęcia z bucketa **tylko dla plików nieużywanych przez inny wpis**
  (`unreferencedPhotoPaths`) — zdjęcie **współdzielone** (np. album i pojedynczy dzień wskazujące
  ten sam plik) nie zostaje skasowane; edycja zapisuje wpis przed sprzątaniem. Best-effort.

### 12.2 UI dodawania i wyświetlania
- **Dodawanie tylko po zalogowaniu** (jak funkcje AI — prywatny bucket): przycisk „Zdjęcie”
  w pasku narzędzi edytora + `photo-field` (siatka miniatur, podgląd przed zapisem) w kreatorze
  i edycji.
- **Wyświetlanie:** `photo-gallery` (siatka, max 4 kafelki + „+N”) i `photo-lightbox`
  (pełny ekran, ← →, Esc) renderowane **pod treścią** (szczegół wpisu i mobilny widok dnia);
  na liście wpis ze zdjęciem ma dyskretną ikonę.

### 12.3 Reguła zapisu (spójność z AI/wyszukiwaniem)
- `src/lib/entry-validation.ts` (`canSaveEntry`): wpis musi nieść **tekst** (tytuł lub treść)
  **albo** mieć **zdjęcie + ≥1 metrykę nastroju**. „Samo zdjęcie bez niczego” i pusty wpis są
  blokowane — bo AI i wyszukiwanie karmią się tekstem. Walidacja w UI tworzenia/edycji (nie w API/MCP).
  Testy: `entry-validation.test.ts`.

> **Uwaga:** wygenerowane pliki źródłowe (`/images-gen`) są pomijane przez `.gitignore` —
> zdjęcia żyją lokalnie i w Supabase Storage, nie w repozytorium.

---

## 13. Etap 6 — Monetyzacja: plany płatne (zrealizowane)

Cel etapu: warstwa komercyjna. Wprowadzić **plany Free / Pro / Max**, zamienić dotychczasowy
„zawór bezpieczeństwa" rate-limitów w **realne quoty produktowe per plan** i podłączyć
**płatności Stripe**. Strona biznesowa (model, research rynku, ceny, go-to-market) opisana
osobno w **`MONETYZACJA.md`** — tu opisujemy stronę techniczno-produktową.

### 13.1 Model planu (`subscriptions` + `plans.ts`)
- Tabela **`public.subscriptions`** (jeden wiersz = użytkownik): `tier` (free/pro/max),
  `status`, `current_period_end`, `cancel_at_period_end`, pola providera
  (`provider`, `provider_customer_id`, `provider_subscription_id`). RLS: użytkownik czyta
  tylko swój wiersz; zapis wyłącznie kluczem sekretnym (webhook). Brak wiersza / `status != active` ⇒ **free**.
- **`src/lib/plans.ts`** — jedno źródło prawdy: `PLAN_LIMITS` (limity per plan i kubełek),
  dozwolone persony (`free → ["freud"]`), głębia RAG (`ragDepth`), dostęp do raportów,
  `getUserPlan` / `getUserSubscription`. Funkcje czyste pokryte testami (`plans.test.ts`).

### 13.2 Bramkowanie funkcji AI (po zużyciu, nie po personie)
- **Limity per plan:** `rate-limit.ts` pobiera limity z `plans.ts` wg planu użytkownika.
  Na **Free** czat z personą i `ask_agent` (REST/MCP) dzielą **wspólną** dzienną pulę „rozmów AI"
  (5/dzień) — liczone razem (`dailyCountBuckets`), by nie obejść limitu przez API.
- **Persony:** `/api/therapist` zwraca **403** dla persony spoza planu (Free = tylko Freud).
- **Głębia RAG:** `hybridSearch` dostaje węższe okno/mniej trafień na Free, pełne na Pro/Max.
- **API/MCP rozdzielone wg kosztu:** narzędzia danych (`create_entry`/`read_entries`, eksport)
  są **otwarte dla każdego zalogowanego** (lekki limit anty-abuse `api_data`, RODO/portability);
  tylko `ask_agent` (woła model) liczy się do puli AI planu.

### 13.3 Płatności — Stripe (serwerowy Checkout + webhook)
> **Uwaga:** pierwotnie checkout szedł przez statyczne **Payment Links** z doklejanym w
> przeglądarce `?client_reference_id=<userId>`. Drugi audyt (Etap 7) wykazał, że userId
> pochodził wtedy z danych kontrolowanych przez klienta — patrz sekcja 14.1. Poniżej opis
> stanu po uszczelnieniu.

- **Serwerowy endpoint `/api/billing/checkout`** tworzy **Stripe Checkout Session**
  (`mode: subscription`) dla zalogowanego użytkownika. `client_reference_id`, `metadata.user_id`
  i `metadata.tier` ustawiane są **z sesji JWT po stronie serwera** (nie z URL-a). Przycisk na
  `/pricing` (`pricing-cta.tsx`) wywołuje endpoint z tokenem sesji i przekierowuje na zwrócony URL.
- **Mapowanie planu po `price_id`** (`src/lib/stripe-prices.ts`): tier↔Price ID z 4 zmiennych env
  (`STRIPE_PRICE_{PRO,MAX}_{MONTHLY,YEARLY}`) — odporne na kupony zmieniające kwotę.
- **Webhook `/api/billing/webhook`** (surowe body + weryfikacja podpisu): `checkout.session.completed`
  → **weryfikacja, że konto istnieje** (`auth.admin.getUserById`) → ustalenie planu wg malejącej
  pewności (`metadata.tier` → `tierForPriceId` → legacy `tierForAmount`) → upsert `subscriptions`.
  `customer.subscription.updated/deleted` → status, `current_period_end`, `cancel_at_period_end`.
  **Jedyne źródło prawdy o planie** — UI nigdy nie ustawia planu sama.
- **Portal `/api/billing/portal`** — hostowane zarządzanie subskrypcją (zmiana karty, anulowanie).
- Klucze/identyfikatory serwerowe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_{PRO,MAX}_{MONTHLY,YEARLY}`.

### 13.4 Raporty AI (funkcja Pro/Max)
- **`/api/reports`** + serwis `reports.ts`: zbiera wpisy z okna (tydzień/miesiąc), buduje kontekst
  (`buildJournalContext`) i prosi xAI o podsumowanie nastroju, korelacji i wątków. Tygodniowy od **Pro**,
  miesięczny tylko **Max** (`isReportPeriodAllowed`); kubełek limitu `reports`, log w `ai_usage`.

### 13.5 UI i dostępność cennika
- **`/pricing`** (3 plany) oraz **sekcja „Plany" na landingu** (`#plany`) — wspólne dane z `pricing-plans.ts`.
- **Onboarding:** po **rejestracji** użytkownik trafia raz na `/pricing` (flaga w `welcome.ts`), potem
  może kontynuować za darmo.
- **Panel „Plan i płatności"** w `/settings`: bieżący plan, status, data odnowienia / „Anulowana —
  dostęp do …", przejście do cennika i portalu Stripe.
- **Kłódki** na personach (przełącznik) i raportach poza planem → prowadzą do cennika.
- **Landing** wymuszony na tryb ciemny; karuzela person z dopracowanym hover (portrety zawsze
  w skali szarości, podpis-nakładka unosi się, delikatna poświata).

---

## 14. Etap 7 — Uszczelnienie płatności i drugi audyt OWASP (zrealizowane)

**Cel etapu:** drugi, celowany przegląd bezpieczeństwa po wejściu warstwy płatnej (Etap 6).
Punkt ciężkości — **pieniądze i dostęp do kupionych funkcji**: skoro od planu zależy teraz, kto
płaci i co dostaje, ścieżka „klient → Stripe → aktywacja planu" stała się najbardziej wrażliwym
obszarem aplikacji. Zakres: ponowne przejście przez listę OWASP Top 10 pod kątem nowych tras
billingowych oraz dotychczasowych endpointów AI przyjmujących dane od klienta.

**Wynik audytu — rdzeń solidny.** Potwierdzono fundamenty z Etapu 4: RLS na wszystkich tabelach,
brak IDOR (serwisy danych filtrują po `user_id` z sesji), PAT jako SHA-256 z 256-bitowej entropii,
brak wektora CSRF (autoryzacja nagłówkiem `Bearer`, nie ciasteczkiem), doradcy bezpieczeństwa
Supabase bez ostrzeżeń. **Domknięto jedną podatność `MEDIUM`** (płatności) i **trzy braki
hardeningu** (audio, wyszukiwanie, nagłówki HTTP). Wszystko pod testami: **108 testów Vitest
zielonych** (3 nowe pliki: `stripe-prices`, `audio-validation`, `search-limits`), typecheck i lint czyste.

### 14.1 Płatności — userId z zaufanej sesji, nie z URL-a (podatność `MEDIUM`)

> **Podatność.** Pierwotny checkout (Etap 6) opierał się na statycznych **Payment Links** ze
> sklejanym w przeglądarce `?client_reference_id=<userId>`. Identyfikator konta pochodził więc z
> **danych w pełni kontrolowanych przez klienta** — atakujący mógł podstawić cudze (lub całkiem
> zmyślone) UUID i po opłaceniu transakcji ufundować plan **obcemu albo nieistniejącemu** kontu.
> Kategoria OWASP: **A01 Broken Access Control / A04 Insecure Design**.

Naprawa jest **dwuwarstwowa** — obrona w głębi, żaden pojedynczy błąd nie wystarcza do nadużycia:

1. **Serwerowy `/api/billing/checkout`** (`runtime = "nodejs"`) tworzy sesję Stripe Checkout
   (`mode: subscription`) dopiero po autoryzacji żądania (`authenticateUser`). `client_reference_id`
   oraz `metadata.user_id` / `metadata.tier` (na sesji **i** na subskrypcji) ustawiane są z
   **userId odczytanego z zweryfikowanego JWT** — wejście klienta ogranicza się do `{ plan, period }`,
   walidowanych do `pro|max` × `monthly|yearly`. Klient nie ma już żadnego wpływu na to, czyje
   konto zostanie aktywowane.
2. **Mapowanie planu po `price_id`, nie po kwocie** (`src/lib/stripe-prices.ts`): `priceIdFor`
   (tier+okres → Price ID) i `tierForPriceId` (Price ID → tier) czytają 4 zmienne **serwerowe**
   `STRIPE_PRICE_{PRO,MAX}_{MONTHLY,YEARLY}`. Brak skonfigurowanej ceny ⇒ `null` ⇒ endpoint zwraca
   **503** (bezpieczna degradacja — nigdy nie zgadujemy planu). `price_id` jest odporny na kupony
   i promocje zmieniające kwotę końcową, których stary `tierForAmount` nie odróżniał.
3. **Webhook `/api/billing/webhook`** (jedyne źródło prawdy o planie) na `checkout.session.completed`
   weryfikuje **istnienie konta** (`auth.admin.getUserById`) przed jakimkolwiek zapisem, a tier
   ustala **wg malejącej pewności**: `metadata.tier` (z naszego serwerowego Checkout) →
   `tierForPriceId(price_id)` → legacy `tierForAmount(amount_total)`. Gdy żadne źródło nie daje
   planu — pomija zdarzenie zamiast zgadywać.

**Zweryfikowane end-to-end** w trybie testowym Stripe: zakup kartą `4242…` zapisał `tier=pro` na
właściwe konto; próba z podstawionym/nieistniejącym UUID nie aktywuje żadnego planu.

### 14.2 Walidacja pliku audio (`/api/transcribe`)

Endpoint transkrypcji przyjmował dowolny plik i słał go prosto do Groq Whisper — zalogowany
użytkownik mógł palić kredyty właściciela wielkimi lub nie-audio plikami. Czysta funkcja
`validateAudioFile` (`src/lib/audio-validation.ts`, testowalna bez `Request`/`Response`) zamyka to
**przed** wysyłką do Groq:
- **rozmiar** > 25 MB (`MAX_AUDIO_BYTES`, zgodny z limitem Whisper) → **413**;
- **typ MIME** ustawiony, ale spoza `audio/*` → **400**. **Pusty `type` jest świadomie
  przepuszczany** — `MediaRecorder` w części przeglądarek nie ustawia MIME przy nagraniu, więc
  twarde odrzucenie psułoby legalną dyktację głosu.

### 14.3 Twarde granice wyszukiwania (`/api/search`)

`limit` i `recentDays` z ciała żądania trafiały wprost do parametru RPC `hybrid_search` oraz do
okna dat — bez sufitu klient mógł poprosić o ogromny `match_count` albo absurdalnie szerokie okno,
obciążając bazę i pgvector. `normalizeSearchLimits` (`services/search.ts`, eksport pod testy)
zaciska je przez `clampInt`: `limit ∈ [1, 100]` (domyślnie 30), `recentDays ∈ [1, 90]` (domyślnie 7).
Wartości spoza zbioru skończonych liczb (`NaN`, `Infinity`, `undefined`) wpadają na bezpieczny
domyślny, ułamki są obcinane (`Math.trunc`). Bezpiecznik **A04: Resource Exhaustion**.

### 14.4 Nagłówki bezpieczeństwa HTTP (`next.config.ts`)

Domknięcie **A05 Security Misconfiguration**: dla **wszystkich tras** (`source: "/:path*"`)
ustawiamy pięć nagłówków:
- **`Strict-Transport-Security`** (`max-age` 2 lata, `includeSubDomains; preload`) — wymuszenie
  HTTPS; ignorowane na `http://localhost`, więc bezpieczne lokalnie;
- **`X-Frame-Options: DENY`** — zakaz osadzania w obcych ramkach, koniec z clickjackingiem;
- **`X-Content-Type-Options: nosniff`** — bez zgadywania typu treści (anty MIME-sniffing);
- **`Referrer-Policy: strict-origin-when-cross-origin`** — pełny URL nie wycieka do obcych domen;
- **`Permissions-Policy: camera=(), microphone=(self), geolocation=()`** — mikrofon tylko dla
  własnej domeny (wymaga go transkrypcja głosu), kamera i geolokalizacja wyłączone (zdjęcia idą
  zwykłym `input[type=file]`).

**CSP świadomie odłożona** — wymaga osobnego, ostrożnego dostrojenia pod inline-skrypty Next,
three.js na landingu i inline-skrypt motywu w `<head>`; zbyt ciasna polityka wywróciłaby aplikację.
`X-Frame-Options: DENY` i tak daje pełną ochronę przed osadzaniem.

### 14.5 Pozycje świadomie zaakceptowane (bez zmian)

Ryzyka rozpoznane i ocenione jako akceptowalne — udokumentowane, by nie wracać do nich jako do „luk":
- **HaveIBeenPwned** (`auth_leaked_password_protection`) — ochrona haseł z wycieków wymaga planu
  Supabase **Pro**; projekt jest na **FREE**, a przy wymuszonej złożoności haseł (Etap 4) ryzyko jest niskie.
- **Prompt injection w RAG** — treść wpisów trafia jako kontekst do modelu; inherentne dla RAG i
  **nie jest wyciekiem danych** (kontekst = własne wpisy zalogowanego użytkownika).
- **PAT hashowany SHA-256 bez saltu** — bezpieczne dla tokenów o 256-bitowej entropii losowej
  (świadomy wybór: salt/KDF chroni hasła o niskiej entropii, nie losowe tokeny).

---

## 15. Etap 8 — Strapi jako źródło prawdy wpisów + PostHog (zrealizowane)

Cel etapu: skonsolidować wpisy dziennika w **jednym źródle prawdy** (headless CMS Strapi),
zachowując dotychczasowy UX (offline-first), wyszukiwanie wektorowe (RAG) i prywatność treści;
dodatkowo wpiąć analitykę produktową.

### 15.1 Strapi (Railway) jako źródło prawdy
- Wpisy przeniesione do **Strapi v5** (Railway, `prolog-cms`, Postgres + wolumen na uploady).
  Typ `Entry`: `title`, `content`, metryki 1–5, `entryDate`, `userId` (właściciel = id z Supabase
  Auth), `localId` (UUID z `localStorage`, unikalny), `photos` (JSON z linkami do Supabase Storage).
- **Migracja** 211 wpisów skryptem `scripts/migrate-entries-to-strapi.mjs` (idempotentnie po
  `localId`). Stara tabela `public.entries` **pozostaje jako backup**.

### 15.2 Warstwa dostępu (proxy + sync)
- Klient nie trzyma tokena Strapi — CRUD przez serwerowe **`/api/cms/entries`** (auth sesją
  Supabase → `userId`; serwis `src/lib/services/cms-entries.ts`).
- `src/lib/sync.ts` woła te route'y zamiast pisać wprost do bazy; `src/lib/storage.ts`
  (localStorage, merge, nagrobki) **bez zmian** — offline-first i dwukierunkowość (apka↔panel
  Strapi) zachowane.

### 15.3 Indeks wektorowy w Supabase (RAG zachowany)
- **Strapi = treść, Supabase = indeks.** `public.entry_index` trzyma per wpis tylko
  **embedding + link** (`strapi_doc_id`, `user_id`, `entry_date`) + RPC `public.match_entries`.
  `search.ts` szuka wektorowo, a treść do kontekstu **dociąga ze Strapi** po `localId`.
  `agent.ts`, REST `/api/v1`, MCP i `reports.ts` czytają wpisy ze Strapi. Część leksykalna
  (full-text) hybrydy wycofana — zostaje wyszukiwanie wektorowe.

### 15.4 Zdjęcia
- Bez zmian: pliki w prywatnym buckecie **Supabase Storage** `entry-photos` (RLS per-folder,
  signed URLs); w Strapi tylko **linki** (`photos` JSON). Omija pułapkę efemerycznego dysku
  Railwaya (`photos.ts` bez zmian).

### 15.5 Analityka PostHog (region EU)
- `posthog-js` w `src/components/posthog-provider.tsx` (host `eu.i.posthog.com`): ręczne
  pageviews (App Router), autocapture/**heatmapy**, **nagrania sesji**, error tracking,
  `identify` po userze Supabase, `person_profiles: 'identified_only'`.
- **Prywatność:** nagrania maskują cały tekst i pola (`maskAllInputs`, `maskTextSelector:"*"`),
  autocapture nie zapisuje treści ani atrybutów (`mask_all_text`, `mask_all_element_attributes`)
  — wrażliwe treści dziennika nie trafiają do analityki.

### 15.6 Utwardzenie i przegląd OWASP
- Proxy `/api/cms/entries`: `enforceRateLimit('api_data')`, sanityzacja treści na zapisie
  (`sanitizeEntryHtml`), limit `MAX_BULK=500` wpisów na żądanie.
- Przegląd potwierdził: surowe API Strapi zablokowane (public → `403`), bucket zdjęć prywatny
  z izolacją per-użytkownik, dostęp do wpisów scope'owany po `userId` (brak IDOR), brak CSRF
  (auth Bearer-tokenem), brak SSRF/SQLi, sekrety server-only. Uwaga infry: leaked-password
  protection w Supabase dostępne dopiero na planie Pro (kontrole zastępcze: wymóg starego hasła,
  świeża sesja, krótkie OTP).

---

## Changelog

| Data        | Zmiana                                                                                  | Etap |
|-------------|-----------------------------------------------------------------------------------------|------|
| 2026-06-01  | Skorupa: dziennik z CRUD, motyw jasny/ciemny, pływający navbar (localStorage).          | 1    |
| 2026-06-02  | Warstwa danych: wyszukiwarka, seed, formatowanie dat + testy Vitest.                    | 2    |
| 2026-06-02  | Desktop master-detail; ukryty navbar w formularzach + strzałka powrotu.                 | 2    |
| 2026-06-02  | Suwak nastroju (dopracowanie); motyw bez migotania (crossfade).                         | 1/2  |
| 2026-06-02  | Edytor: przycisk „Dyktuj” (Web Speech API).                                             | 3    |
| 2026-06-03  | Dźwięki interakcji; animowany pasek przewijania; animacja przełącznika motywu.          | 2    |
| 2026-06-10  | Transkrypcja głosu przez Groq Whisper (`/api/transcribe`).                              | 3    |
| 2026-06-11  | Cyfrowy terapeuta „Freud”: czat nad wpisami (xAI) + dwukierunkowa synchronizacja.       | 3    |
| 2026-06-12  | Serwer MCP (Remote HTTP) + REST API `/api/v1` + dokumentacja `/docs` (zakładki API/MCP).| 3    |
| 2026-06-12  | Mobilna nawigacja w hamburgerze + poprawka strzałki miesiąca w Statystykach.            | 2    |
| 2026-06-13  | Dokumentacja MCP: przykłady request/response dla każdego narzędzia.                     | 3    |
| 2026-06-13  | Gating funkcji AI za logowaniem + ukrycie UI AI + log/panel zużycia (`ai_usage`).       | 3    |
| 2026-06-14  | UX/animacje: fade przełączania wpisów, menu w stylu macOS, przycisk menu po prawej.     | 1/2  |
| 2026-06-14  | Pasek dni (mobile) ograniczony do 7 kafelków; wykluczanie paneli menu↔Freud + auto-powrót.| 2/3 |
| 2026-06-14  | Ustawienia: przełącznik „Animacje interfejsu” (`no-anim`) + respekt `prefers-reduced-motion`.| 1/2 |
| 2026-06-17  | Sanityzacja HTML wpisów (DOMPurify) przy renderze i na zapisie — ochrona przed stored XSS. | 4 |
| 2026-06-17  | Rate-limiting funkcji AI (`rate_limit_hits`): limit dzienny (reset o północy) + UI ostrzega 80% i blokuje po wyczerpaniu; `/api/limits`. | 4 |
| 2026-06-17  | Hardening bazy: stały `search_path` w funkcjach `hybrid_search`/`immutable_unaccent` (audyt Supabase). | 4 |
| 2026-06-15  | Terapeuta w 5 personach + przełącznik w stylu Gemini + karuzela person na landingu.     | 3    |
| 2026-06-16  | Embeddingi wpisów (OpenAI, pgvector+HNSW) + wyszukiwanie hybrydowe (RRF + okno 7 dni), `/api/search`. | 3 |
| 2026-06-16  | RAG: kontekst terapeuty/agenta budowany z `hybridSearch` (najtrafniejsze wpisy + 7 dni). | 3    |
| 2026-06-17  | Zdjęcia wpisów: prywatny bucket Storage `entry-photos` (signed URLs) + galeria i lightbox; reguła zapisu. | 5 |
| 2026-06-17  | Wyszukiwarka lokalna: ranking trafności (liczba = dzień/rok; treść niżej) + regulowana szerokość panelu. | 2 |
| 2026-06-18  | Audyt: polityka deny-all dla `rate_limit_hits` (migracja) + wzmocnienie haseł (min. 8 znaków, złożoność); `architektura.md`. | 4 |
| 2026-06-22  | Plany Free/Pro/Max: tabela `subscriptions`, `plans.ts` (limity/persony/RAG per plan), rate-limiting per plan + bramka person + głębia RAG. | 6 |
| 2026-06-22  | Płatności Stripe: Payment Links + `client_reference_id` + webhook `/api/billing/webhook` → `subscriptions`; portal `/api/billing/portal`. | 6 |
| 2026-06-22  | Raporty AI tyg./mies. (Pro/Max): `/api/reports` + `reports.ts`. | 6 |
| 2026-06-22  | Cennik `/pricing` + sekcja „Plany" na landingu (ciemny, nowy hover person); onboarding po rejestracji → cennik; panel „Plan i płatności" w `/settings`. | 6 |
| 2026-06-23  | Panel planu: rozróżnienie subskrypcji odnawianej od anulowanej na koniec okresu (`cancel_at_period_end`). | 6 |
| 2026-06-23  | Trwałe usuwanie wpisów: nagrobki `prolog.pending_deletes` + `flushPendingDeletes` przy logowaniu, merge pomija nagrobione — koniec ze wskrzeszaniem skasowanych wpisów z chmury. | 2 |
| 2026-06-23  | Zdjęcia: kompresja uploadu do WebP (≤1600 px, q0.8), cache podpisanych URL-i (`sessionStorage`), kasowanie ze Storage tylko plików nieużywanych przez inny wpis (`unreferencedPhotoPaths`). | 5 |
| 2026-06-23  | Wyszukiwarka: filtr „pokaż wpisy ze zdjęciami” po słowach „zdjęcie”/„fotka”/„fotografia”/„photo”/„picture”/„pic” i ich formach (`hasPhotos`, nie tekst). | 2 |
| 2026-06-24  | Płatności: serwerowy `/api/billing/checkout` (userId z JWT, nie z URL-a) + mapowanie po `price_id` + webhook weryfikuje istnienie konta — domknięcie podatności MEDIUM (zweryfikowane E2E w Stripe test). | 7 |
| 2026-06-24  | Walidacja audio w `/api/transcribe` (≤25 MB, `audio/*`) + twarde granice `/api/search` (`normalizeSearchLimits`: limit≤100, dni≤90). | 7 |
| 2026-06-24  | Nagłówki bezpieczeństwa HTTP w `next.config.ts` (HSTS, X-Frame-Options: DENY, nosniff, Referrer-Policy, Permissions-Policy). | 7 |
| 2026-06-26  | Strapi (Railway) jako **źródło prawdy wpisów** (typ `Entry`); serwerowy proxy `/api/cms/entries` + `sync.ts` przez Strapi (localStorage-first bez zmian); migracja 211 wpisów. | 8 |
| 2026-06-26  | Supabase = **indeks wektorowy** (`entry_index` + RPC `match_entries`: embedding+link); `search.ts`/`agent.ts`/`reports.ts`/REST+MCP czytają treść ze Strapi; stara `entries` = backup; `/blog` usunięty. | 8 |
| 2026-06-26  | **PostHog** (region EU): pageviews, autocapture/heatmapy, nagrania sesji z maskowaniem treści, error tracking, `identify` po userze Supabase. | 8 |
| 2026-06-28  | Utwardzenie proxy `/api/cms/entries`: `enforceRateLimit` + sanityzacja na zapisie + cap `MAX_BULK=500`; przegląd OWASP (Strapi `403` dla public, bucket RLS per-user). | 8 |

> Daty wg historii gita; etap orientacyjnie (część zmian dotyczy więcej niż jednego obszaru).
