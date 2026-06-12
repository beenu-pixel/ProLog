"use client";

import { CodeBlock } from "@/components/docs/code-block";
import {
  DocsSidebar,
  Endpoint,
  FieldTable,
  useScrollSpy,
  type NavGroup,
} from "@/components/docs/shared";

// Zakładka „MCP" — Remote HTTP MCP server (Streamable HTTP) pod /api/mcp.
// Te same operacje co REST, wystawione jako narzędzia MCP; ta sama autoryzacja
// Personal Access Tokenem (pasek „Token API" na górze strony).

const NAV: NavGroup[] = [
  {
    title: "Wprowadzenie",
    items: [
      { id: "mcp-intro", label: "Przegląd" },
      { id: "mcp-connect", label: "Połączenie" },
      { id: "mcp-clients", label: "Konfiguracja klienta" },
    ],
  },
  {
    title: "Narzędzia",
    items: [
      { id: "mcp-create", label: "create_entry", method: "TOOL" },
      { id: "mcp-read", label: "read_entries", method: "TOOL" },
      { id: "mcp-ask", label: "ask_agent", method: "TOOL" },
    ],
  },
  {
    title: "Diagnostyka",
    items: [{ id: "mcp-raw", label: "Surowe JSON-RPC" }],
  },
];

const IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

export function McpDocs({ origin }: { origin: string }) {
  const active = useScrollSpy(IDS, "mcp-intro");
  const mcpUrl = `${origin}/api/mcp`;

  return (
    <div className="flex gap-10">
      <DocsSidebar nav={NAV} active={active} />

      <div className="min-w-0 max-w-3xl flex-1 space-y-10 pb-24">
        {/* Przegląd */}
        <section id="mcp-intro" className="scroll-mt-20 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">MCP Server</h2>
            <p className="text-muted-foreground">
              Zdalny serwer <strong>MCP</strong> (Model Context Protocol) daje
              agentom AI dostęp do dziennika ProLog jako zestaw narzędzi — bez
              ręcznego sklejania zapytań HTTP. Agent sam wykrywa narzędzia i je
              wywołuje. Pod spodem to ta sama logika co REST API.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Transport.</span>{" "}
              Remote <strong>Streamable HTTP</strong> — jeden endpoint{" "}
              <code className="font-mono">POST /api/mcp</code>. Bez instalacji,
              hostowany na Vercelu.
            </p>
            <p>
              <span className="font-medium text-foreground">Autoryzacja.</span>{" "}
              Ten sam Personal Access Token co w API, w nagłówku{" "}
              <code className="font-mono">Authorization: Bearer plog_…</code>.
              Token wygenerujesz w pasku <strong>„Token API”</strong> na górze
              strony. Każdy token działa w imieniu jednego użytkownika.
            </p>
            <p>
              <span className="font-medium text-foreground">Strefa czasowa.</span>{" "}
              „Dzień” liczony wg <strong>Europe/Warsaw</strong>; domyślnie dziś.
            </p>
          </div>
        </section>

        {/* Połączenie */}
        <section id="mcp-connect" className="scroll-mt-20 space-y-4 border-t pt-10">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Połączenie</h2>
            <p className="text-sm text-muted-foreground">
              Adres serwera, który podajesz w kliencie MCP:
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Server URL</p>
            <CodeBlock code={mcpUrl} />
          </div>
          <FieldTable
            fields={[
              { name: "Transport", type: "—", required: true, desc: "Streamable HTTP (remote)." },
              { name: "Metoda", type: "—", required: true, desc: "POST (JSON-RPC 2.0)." },
              { name: "Authorization", type: "header", required: true, desc: "Bearer <Personal Access Token>." },
            ]}
          />
        </section>

        {/* Konfiguracja klienta */}
        <section id="mcp-clients" className="scroll-mt-20 space-y-4 border-t pt-10">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Konfiguracja klienta
            </h2>
            <p className="text-sm text-muted-foreground">
              Większość klientów MCP (Claude Desktop, Cursor, Claude Code)
              czyta listę serwerów z pliku konfiguracyjnego. Wskaż URL i dołącz
              nagłówek z tokenem.
            </p>
          </div>
          <CodeBlock
            label="mcp.json (Cursor / Claude Code)"
            code={`{
  "mcpServers": {
    "prolog": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer plog_xxxxxxxxxxxxxxxx"
      }
    }
  }
}`}
          />
          <p className="text-sm text-muted-foreground">
            W <strong>claude.ai</strong> (Custom Connector) wklej ten sam Server
            URL i token jako nagłówek <code className="font-mono">Authorization</code>.
            Po połączeniu agent zobaczy trzy narzędzia opisane niżej.
          </p>
        </section>

        {/* create_entry */}
        <Endpoint id="mcp-create" title="create_entry" method="TOOL" path="Dodaj wpis">
          <p className="text-sm text-muted-foreground">
            Tworzy nowy wpis w dzienniku. Domyślnie na dziś (Europe/Warsaw);
            tytuł generowany automatycznie z treści.
          </p>
          <p className="text-sm font-medium">Argumenty</p>
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
          <p className="text-sm text-muted-foreground">
            Zwraca tekstowy JSON: <code className="font-mono">{`{ "entry": { … } }`}</code>.
          </p>
        </Endpoint>

        {/* read_entries */}
        <Endpoint id="mcp-read" title="read_entries" method="TOOL" path="Odczytaj wpisy z dnia">
          <p className="text-sm text-muted-foreground">
            Zwraca wpis(y) z danego dnia (Europe/Warsaw). Dzień może mieć więcej
            niż jeden wpis.
          </p>
          <p className="text-sm font-medium">Argumenty</p>
          <FieldTable
            fields={[
              { name: "date", type: "string (YYYY-MM-DD)", required: true, desc: "Dzień, którego wpisy chcesz pobrać." },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Zwraca tekstowy JSON: <code className="font-mono">{`{ "date": "…", "entries": [ … ] }`}</code>.
          </p>
        </Endpoint>

        {/* ask_agent */}
        <Endpoint id="mcp-ask" title="ask_agent" method="TOOL" path="Zapytaj cyfrowego terapeutę">
          <p className="text-sm text-muted-foreground">
            Zadaje pytanie cyfrowemu terapeucie (Freud) na podstawie całego
            dziennika. Historia rozmowy jest prowadzona osobno dla każdego dnia.
          </p>
          <p className="text-sm font-medium">Argumenty</p>
          <FieldTable
            fields={[
              { name: "question", type: "string", required: true, desc: "Pytanie do agenta." },
              { name: "day", type: "string (YYYY-MM-DD)", required: false, desc: "Dzień, na którym skupia się pytanie. Domyślnie dziś (PL)." },
              { name: "from", type: "string (YYYY-MM-DD)", required: false, desc: "Początek okresu, gdy pytanie dotyczy zakresu dat." },
              { name: "to", type: "string (YYYY-MM-DD)", required: false, desc: "Koniec okresu." },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Zwraca tekstowy JSON: <code className="font-mono">{`{ "answer": "…", "day": "…" }`}</code>.
          </p>
        </Endpoint>

        {/* Surowe JSON-RPC */}
        <section id="mcp-raw" className="scroll-mt-20 space-y-4 border-t pt-10">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Surowe JSON-RPC
            </h2>
            <p className="text-sm text-muted-foreground">
              Do testów bez klienta MCP. Każde żądanie to POST z nagłówkiem{" "}
              <code className="font-mono">Accept: application/json, text/event-stream</code>.
            </p>
          </div>
          <CodeBlock
            label="tools/list"
            code={`curl -X POST ${mcpUrl} \\
  -H "Authorization: Bearer $PROLOG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
          />
          <CodeBlock
            label="tools/call → create_entry"
            code={`curl -X POST ${mcpUrl} \\
  -H "Authorization: Bearer $PROLOG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tools/call",
    "params":{"name":"create_entry","arguments":{"content":"Wpis z MCP","mood":4}}
  }'`}
          />
        </section>
      </div>
    </div>
  );
}
