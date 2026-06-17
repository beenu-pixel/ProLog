# PRD — ProLog

**Wersja:** 3.2 (Etap 4 — audyt i uszczelnienie bezpieczeństwa)
**Data:** 2026-06-17
**Status:** Żywy dokument — Etap 1 (fundament) i Etap 2 (baza + logowanie) zrealizowane; Etap 3 (AI) zrealizowany, łącznie z zamknięciem funkcji AI za logowaniem i logiem zużycia; Etap 4 (uszczelnienie bezpieczeństwa: sanityzacja XSS, rate-limiting AI, hardening bazy) zrealizowany

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
- **AI:** dyktowanie głosem (transkrypcja), cyfrowy terapeuta „Freud”, sterowanie
  dziennikiem przez **REST API** i **serwer MCP** (Personal Access Token), strona `/docs`.
- **Bezpieczeństwo AI:** funkcje AI dostępne **tylko po zalogowaniu** (egzekwowane serwerowo),
  UI AI ukryte przed gościem, log zużycia (`ai_usage`) + panel rozliczalności dla właściciela.
- **Uszczelnienie (Etap 4):** sanityzacja HTML wpisów (ochrona przed XSS), **rate-limiting**
  funkcji AI z dziennym limitem widocznym w UI (ostrzeżenie + blokada), hardening bazy Supabase.

Szczegóły w sekcjach 7 (Etap 2), 8 (Etap 3), 9 (bezpieczeństwo i rozliczalność AI)
i 11 (uszczelnienie bezpieczeństwa).

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
- ~~Wyszukiwanie.~~ → ✅ dodane w Etapie 2.
- Wciąż poza zakresem: załączniki (zdjęcia), tagi.

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
  **mirrorowany** do Supabase.
- **Dwukierunkowa synchronizacja przy logowaniu:** najpierw `pullAll` → `mergeRemoteEntries`
  (wciągnięcie wpisów z chmury do `localStorage`), potem `pushAll` (wypchnięcie stanu
  lokalnego z powrotem), by oba źródła się zgadzały. Best-effort — błąd sieci nie wywraca
  logowania.

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
- **Desktop master-detail** — dwupanelowy układ listy i szczegółu na szerokich ekranach.
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

### 8.2 Cyfrowy terapeuta „Freud”
- Czat nad wpisami w stylu psychoanalitycznym przez **`/api/therapist`** (model **xAI Grok 4.3**,
  klucz `XAI_API_KEY` serwerowo).
- **Kontekst warstwowy** pod cache xAI: persona (system) → dziennik (system) → historia
  rozmowy → świeży kontekst UI dołączony do ostatniego pytania użytkownika.
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
  do terapeuty/agenta.
- **Klucze (zmienne środowiskowe, serwerowe):** `GROQ_API_KEY`, `XAI_API_KEY`,
  `SUPABASE_SECRET_KEY` (sekret `sb_secret_…`, wymagany przez REST/MCP — inaczej 503),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (klient),
  `PROLOG_ADMIN_EMAILS` (lista właścicieli widzących panel zużycia AI).
- **Personal Access Token:** prefiks `plog_`, w bazie tylko hash SHA-256 (`api_tokens`).
- **Log zużycia AI:** tabela `ai_usage`; funkcje AI egzekwowane serwerowo (`user-auth.ts`).
- **Rate-limiting AI:** tabela `rate_limit_hits` (RLS bez polityk — dostęp tylko kluczem
  sekretnym); serwis `src/lib/services/rate-limit.ts`; sanityzacja HTML w `src/lib/sanitize.ts`
  (zależność `isomorphic-dompurify`).

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
- **Do włączenia w panelu** (konfiguracja Auth, nie kod): ochrona przed wyciekłymi hasłami
  (HaveIBeenPwned) — domyka ostatnie ostrzeżenie audytu.

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

> Daty wg historii gita; etap orientacyjnie (część zmian dotyczy więcej niż jednego obszaru).
