# ProLog — Monetyzacja (strona biznesowa)

> Strategia, model cenowy i uzasadnienie. Stronę **techniczną** (jak to działa w kodzie)
> opisuje `PRD-ProLog.md`, sekcja „Etap 6 — Monetyzacja".

## 1. Model w jednym zdaniu

Dziennik jest **darmowy na zawsze**; płaci się za **głębsze AI**, bramkowane **zużyciem**
(a nie za pojedyncze persony). Trzy plany: **Free / Pro / Max**, subskrypcja miesięczna lub roczna.

## 2. Research rynku (dlaczego tak)

Przegląd porównywalnych aplikacji AI-journaling:

| App | Free | Płatne | Po czym bramkują |
|-----|------|--------|------------------|
| **Rosebud** | basic AI, dzienny limit interakcji | ~$13/mc | pamięć długoterminowa (RAG), nielimitowany czat, głos, raporty |
| **Mindsera** | basic + kilka „Minds" | ~$10 / ~$40 mc | nielimitowany coaching, pełne modele myślowe, raporty, własne persony |
| **Stoic** | prompty, ćwiczenia | tani roczny + „Premium + AI" | biblioteka, AI-insighty, backup |

**Kluczowy wniosek:** żadna z nich **nie sprzedaje person à la carte** — persony są częścią planu,
a bramką jest **zużycie** i **funkcje premium** (pamięć, raporty, głos). Dlatego ProLog świadomie
**odrzuca** kursowy pomysł „kup pojedynczą personę / ikona mózgu / galeria-sklep": użytkownik i tak
wybiera jednego ulubionego przewodnika, więc płacenie za *liczbę* person jest słabym motywatorem.

## 3. Struktura planów

| | Free | Pro | Max |
|--|------|-----|-----|
| Persony | tylko Freud | wszystkie 5 | wszystkie 5 |
| Rozmowy AI / dzień (czat + API `ask_agent`) | **5** (wspólna pula) | ~50 | ~200 (de facto bez limitu) |
| Pamięć / głębia RAG | płytka (7 dni) | pełna | pełna |
| Raporty | — | tygodniowe | tygodniowe + miesięczne |
| Transkrypcja / inteligentne wyszukiwanie | niskie limity | wysokie | bardzo wysokie |
| API/MCP — dane (eksport własnych wpisów) | ✅ | ✅ | ✅ |
| **Cena (placeholder)** | 0 zł | ~39 zł/mc | ~79 zł/mc |

- **Dźwignie zakupowe Pro/Max:** (1) **raporty** nastroju i wątków, (2) **pełna pamięć/RAG** nad całym
  dziennikiem. To one dają poczucie „AI, które naprawdę mnie zna".
- **Dane są zawsze otwarte:** dostęp do własnych wpisów i eksport przez API/MCP działa na każdym
  planie (dobre pod RODO/portability; nie zamykamy człowiekowi jego danych za paywallem).
- **Ceny i progi to placeholdery** — do kalibracji (rynek: Pro ~$10, Premium ~$40; Rosebud ~$13/mc).
  Roczny abonament z rabatem „2 miesiące gratis".

## 4. Płatności i operacje

- **Provider: Stripe** (Payment Links + webhook). Niższa prowizja i pełna kontrola; integracja
  trzymana provider-agnostycznie (tabela `subscriptions` + webhook), więc zejście na Merchant of
  Record (Lemon Squeezy/Paddle) później byłoby tanie.
- **VAT:** przy Stripe odpowiedzialność za VAT-OSS od konsumentów w UE leży **po stronie właściciela**.
  Do ustalenia przed publiczną sprzedażą: włączyć **Stripe Tax** (płatny dodatek, automatyczne
  naliczanie) albo rozliczać deklaracje z księgowym.

## 5. Go-to-market / następne kroki

1. **Kalibracja cen i limitów** — ustawić docelowe kwoty (PLN) i progi quot na podstawie realnego
   kosztu modeli i konkurencji.
2. **Uruchomienie Live** — podmienić testowe Payment Linki na produkcyjne, `sk_test_`→`sk_live_`,
   zarejestrować **publiczny** endpoint webhooka w panelu Stripe (zamiast Stripe CLI), aktywować
   portal klienta w trybie Live.
3. **VAT** — wybrać i wdrożyć rozwiązanie (Stripe Tax lub księgowość) przed pierwszą realną sprzedażą.
4. **Mierzenie** — konwersja Free→Pro, wykorzystanie raportów i limitów (panel zużycia AI już zbiera dane).
5. **Plan roczny** — wyeksponować jako domyślny wybór (lepszy LTV), z rabatem rocznym.

## 6. Czego świadomie NIE robimy

- Sprzedaży person pojedynczo (à la carte) i „galerii person" w stylu e-commerce.
- Zamykania podstawowego dziennika (wpisy, zdjęcia, eksport) za paywallem.
