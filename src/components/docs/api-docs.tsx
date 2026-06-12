"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { CodeBlock } from "@/components/docs/code-block";
import {
  DocsSidebar,
  Endpoint,
  FieldTable,
  useScrollSpy,
  type NavGroup,
} from "@/components/docs/shared";

// Zakładka „API" — dokumentacja REST /api/v1 (styl docs.vercel.com).
// Generator tokenu jest we wspólnym pasku nad zakładkami (patrz docs/page.tsx),
// dlatego sekcja „Uwierzytelnianie" tylko do niego odsyła.

const NAV: NavGroup[] = [
  {
    title: "Wprowadzenie",
    items: [
      { id: "api-intro", label: "Przegląd" },
      { id: "api-auth", label: "Uwierzytelnianie" },
    ],
  },
  {
    title: "Endpointy",
    items: [
      { id: "api-create", label: "Create", method: "POST" },
      { id: "api-ask", label: "Ask", method: "POST" },
      { id: "api-read", label: "Read", method: "GET" },
    ],
  },
  {
    title: "Integracja",
    items: [{ id: "api-agent", label: "Dla agenta AI" }],
  },
];

const IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

export function ApiDocs({ origin }: { origin: string }) {
  const active = useScrollSpy(IDS, "api-intro");

  return (
    <div className="flex gap-10">
      <DocsSidebar nav={NAV} active={active} />

      <div className="min-w-0 max-w-3xl flex-1 space-y-10 pb-24">
        {/* Wprowadzenie */}
        <section id="api-intro" className="scroll-mt-20 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">REST API</h2>
            <p className="text-muted-foreground">
              REST API do sterowania dziennikiem ProLog z zewnątrz — dodawanie
              wpisów, pytania do cyfrowego terapeuty i odczyt wpisów na dany dzień.
              Każdy token działa w imieniu jednego użytkownika.
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Base URL</p>
            <CodeBlock code={origin} />
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Strefa czasowa.</span>{" "}
              „Dzień” (parametr <code className="font-mono">date</code>/
              <code className="font-mono">day</code> oraz domyślne „dziś”) jest
              liczony wg <strong>Europe/Warsaw</strong>.
            </p>
            <p>
              <span className="font-medium text-foreground">Format.</span> Ciało
              żądań i odpowiedzi to JSON (<code className="font-mono">
                Content-Type: application/json
              </code>
              ).
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Kody błędów</p>
            <FieldTable
              fields={[
                { name: "400", type: "Bad Request", required: false, desc: "Brak wymaganych pól lub zły format (np. data, zakres metryki)." },
                { name: "401", type: "Unauthorized", required: false, desc: "Brak lub nieprawidłowy token w nagłówku Authorization." },
                { name: "404", type: "Not Found", required: false, desc: "Nieznana ścieżka." },
                { name: "500", type: "Server Error", required: false, desc: "Błąd zapisu/odczytu w bazie." },
                { name: "503", type: "Unavailable", required: false, desc: "Serwer nieskonfigurowany (brak klucza service-role lub klucza modelu)." },
              ]}
            />
            <p className="text-sm text-muted-foreground">
              Błąd ma postać{" "}
              <code className="font-mono">{`{ "error": "opis" }`}</code>.
            </p>
          </div>
        </section>

        {/* Uwierzytelnianie */}
        <section id="api-auth" className="scroll-mt-20 space-y-4 border-t pt-10">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Uwierzytelnianie</h2>
            <p className="text-sm text-muted-foreground">
              Każde żądanie wymaga nagłówka z Personal Access Tokenem. Token
              wygenerujesz w pasku <strong>„Token API”</strong> na górze tej
              strony (lub w Ustawieniach) — pokazujemy go tylko raz.
            </p>
          </div>
          <CodeBlock code={`Authorization: Bearer plog_xxxxxxxxxxxxxxxx`} />
        </section>

        {/* Create */}
        <Endpoint id="api-create" title="Create — dodanie wpisu" method="POST" path="/api/v1/entries">
          <p className="text-sm text-muted-foreground">
            Tworzy nowy wpis. Domyślnie na dziś (Europe/Warsaw). Tytuł jest
            generowany automatycznie z treści.
          </p>
          <p className="text-sm font-medium">Body</p>
          <FieldTable
            fields={[
              { name: "content", type: "string", required: true, desc: "Treść wpisu (tekst lub HTML)." },
              { name: "date", type: "string (YYYY-MM-DD)", required: false, desc: "Dzień wpisu. Domyślnie dziś (PL)." },
              { name: "mood", type: "int 1–5", required: false, desc: "Nastrój / samopoczucie." },
              { name: "sleep", type: "int 1–5", required: false, desc: "Jakość snu." },
              { name: "energy", type: "int 1–5", required: false, desc: "Energia." },
              { name: "productivity", type: "int 1–5", required: false, desc: "Produktywność." },
              { name: "stress", type: "int 1–5", required: false, desc: "Poziom stresu." },
            ]}
          />
          <CodeBlock
            label="curl"
            code={`curl -X POST ${origin}/api/v1/entries \\
  -H "Authorization: Bearer $PROLOG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"Dziś był dobry dzień.","mood":4,"sleep":3}'`}
          />
          <CodeBlock
            label="201 Created"
            code={`{
  "entry": {
    "id": "8f3c…",
    "title": "Dziś był dobry dzień.",
    "content": "Dziś był dobry dzień.",
    "mood": 4,
    "sleep": 3,
    "createdAt": "2026-06-11T10:00:00.000Z"
  }
}`}
          />
        </Endpoint>

        {/* Ask */}
        <Endpoint id="api-ask" title="Ask — pytanie do agenta" method="POST" path="/api/v1/agent">
          <p className="text-sm text-muted-foreground">
            Zadaje pytanie cyfrowemu terapeucie (Freud) na podstawie całego
            dziennika. Możesz wskazać dzień, a gdy pytanie tego wymaga — także
            zakres dat. Historia rozmowy jest prowadzona osobno dla każdego dnia.
            Odpowiedź wraca jako JSON (bez streamingu).
          </p>
          <p className="text-sm font-medium">Body</p>
          <FieldTable
            fields={[
              { name: "question", type: "string", required: true, desc: "Pytanie do agenta." },
              { name: "day", type: "string (YYYY-MM-DD)", required: false, desc: "Dzień, na którym skupia się pytanie. Domyślnie dziś (PL). Wyznacza wątek historii." },
              { name: "from", type: "string (YYYY-MM-DD)", required: false, desc: "Początek okresu, gdy pytanie dotyczy dłuższego przedziału." },
              { name: "to", type: "string (YYYY-MM-DD)", required: false, desc: "Koniec okresu." },
            ]}
          />
          <CodeBlock
            label="curl"
            code={`curl -X POST ${origin}/api/v1/agent \\
  -H "Authorization: Bearer $PROLOG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"question":"Jak wyglądał mój tydzień?","day":"2026-06-11"}'`}
          />
          <CodeBlock
            label="200 OK"
            code={`{
  "answer": "Zajrzałem do twojego dziennika…",
  "day": "2026-06-11"
}`}
          />
        </Endpoint>

        {/* Read */}
        <Endpoint id="api-read" title="Read — wpis na dzień" method="GET" path="/api/v1/entries/{date}">
          <p className="text-sm text-muted-foreground">
            Zwraca wpis(y) z danego dnia (Europe/Warsaw). Dzień może mieć więcej
            niż jeden wpis — dlatego zwracamy listę.
          </p>
          <p className="text-sm font-medium">Parametr ścieżki</p>
          <FieldTable
            fields={[
              { name: "date", type: "string (YYYY-MM-DD)", required: true, desc: "Dzień, którego wpisy chcesz pobrać." },
            ]}
          />
          <CodeBlock
            label="curl"
            code={`curl ${origin}/api/v1/entries/2026-06-11 \\
  -H "Authorization: Bearer $PROLOG_TOKEN"`}
          />
          <CodeBlock
            label="200 OK"
            code={`{
  "date": "2026-06-11",
  "entries": [
    { "id": "8f3c…", "title": "…", "content": "…", "mood": 4, "createdAt": "2026-06-11T10:00:00.000Z" }
  ]
}`}
          />
        </Endpoint>

        {/* Dla agenta AI */}
        <section id="api-agent" className="scroll-mt-20 space-y-4 border-t pt-10">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Dla agenta AI</h2>
            <p className="text-sm text-muted-foreground">
              Gotowa instrukcja, którą możesz wkleić do swojego agenta, aby
              korzystał z ProLog API. Pełną specyfikację maszynową znajdziesz w
              pliku OpenAPI. Jeśli twój agent obsługuje MCP, rozważ zakładkę{" "}
              <strong>MCP</strong> — nie wymaga ręcznego sklejania zapytań HTTP.
            </p>
          </div>
          <CodeBlock
            label="Instrukcja dla agenta"
            code={`Masz dostęp do ProLog API (base URL: ${origin}).
Uwierzytelniaj każde żądanie nagłówkiem:
  Authorization: Bearer <TOKEN>

Dostępne akcje:
1) Dodaj wpis — POST /api/v1/entries
   body: { content (wymagane), date? "YYYY-MM-DD", mood?/sleep?/energy?/productivity?/stress? 1-5 }
2) Zapytaj agenta — POST /api/v1/agent
   body: { question (wymagane), day? "YYYY-MM-DD", from?, to? }
   zwraca: { answer, day }
3) Odczytaj dzień — GET /api/v1/entries/{date}
   zwraca: { date, entries[] }

Daty liczone są w strefie Europe/Warsaw. Domyślny dzień to dziś.`}
          />
          <Link
            href="/openapi.json"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Pobierz openapi.json <ArrowUpRight className="size-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
