import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";

import { verifyApiToken } from "@/lib/api-auth";
import { isApiError } from "@/lib/api-error";
import { createEntry, getEntriesForDay } from "@/lib/services/entries";
import { askAgent } from "@/lib/services/agent";

// Remote HTTP MCP server (Streamable HTTP). Dzięki dynamicznemu segmentowi
// [transport] i basePath "/api" publiczny endpoint to POST /api/mcp.
// Wystawia te same operacje co REST /api/v1 jako narzędzia MCP, z tą samą
// autoryzacją Personal Access Tokenem (Authorization: Bearer plog_…).
// Logikę współdzielimy z REST przez `@/lib/services/*` — zero duplikacji.

// node:crypto w warstwie auth wymaga runtime Node (nie Edge).
export const runtime = "nodejs";

const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format dnia to YYYY-MM-DD.");
const SCALE = z.number().int().min(1).max(5);

/** Tekstowa odpowiedź narzędzia z dowolnego JSON-a. */
function ok(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

/** Mapuje `ApiError` na błąd narzędzia (isError); inne wyjątki propagujemy. */
function fail(err: unknown) {
  if (isApiError(err)) {
    return {
      content: [{ type: "text" as const, text: err.message }],
      isError: true,
    };
  }
  throw err;
}

/** userId uwierzytelnionego klienta (gwarantowany przez withMcpAuth required). */
function userIdOf(extra: { authInfo?: AuthInfo }): string {
  const id = extra.authInfo?.clientId;
  if (!id) throw new Error("Brak kontekstu uwierzytelnienia.");
  return id;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "create_entry",
      {
        title: "Dodaj wpis",
        description:
          "Tworzy nowy wpis w dzienniku ProLog. Domyślnie na dziś (Europe/Warsaw). Tytuł generowany automatycznie z treści.",
        inputSchema: {
          content: z.string().min(1).describe("Treść wpisu (tekst lub HTML)."),
          date: DAY.optional().describe(
            "Dzień wpisu YYYY-MM-DD. Domyślnie dziś (Europe/Warsaw)."
          ),
          mood: SCALE.optional().describe("Nastrój / samopoczucie (1–5)."),
          sleep: SCALE.optional().describe("Jakość snu (1–5)."),
          energy: SCALE.optional().describe("Energia (1–5)."),
          productivity: SCALE.optional().describe("Produktywność (1–5)."),
          stress: SCALE.optional().describe("Poziom stresu (1–5)."),
        },
      },
      async (args, extra) => {
        try {
          const entry = await createEntry(userIdOf(extra), args);
          return ok({ entry });
        } catch (err) {
          return fail(err);
        }
      }
    );

    server.registerTool(
      "read_entries",
      {
        title: "Odczytaj wpisy z dnia",
        description:
          "Zwraca wpis(y) z danego dnia (Europe/Warsaw). Dzień może mieć więcej niż jeden wpis.",
        inputSchema: {
          date: DAY.describe("Dzień YYYY-MM-DD, którego wpisy chcesz pobrać."),
        },
      },
      async (args, extra) => {
        try {
          const result = await getEntriesForDay(userIdOf(extra), args.date);
          return ok(result);
        } catch (err) {
          return fail(err);
        }
      }
    );

    server.registerTool(
      "ask_agent",
      {
        title: "Zapytaj cyfrowego terapeutę",
        description:
          "Zadaje pytanie cyfrowemu terapeucie (Freud) na podstawie całego dziennika. Historia rozmowy jest prowadzona osobno dla każdego dnia.",
        inputSchema: {
          question: z.string().min(1).describe("Pytanie do agenta."),
          day: DAY.optional().describe(
            "Dzień, na którym skupia się pytanie. Domyślnie dziś (PL)."
          ),
          from: DAY.optional().describe("Początek okresu (gdy pytanie dotyczy zakresu dat)."),
          to: DAY.optional().describe("Koniec okresu."),
        },
      },
      async (args, extra) => {
        try {
          const result = await askAgent(userIdOf(extra), args);
          return ok(result);
        } catch (err) {
          return fail(err);
        }
      }
    );
  },
  { serverInfo: { name: "ProLog", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: true }
);

// PAT → AuthInfo. Token (bez prefiksu „Bearer ") trafia tu z nagłówka
// Authorization; clientId niesie userId do narzędzi (extra.authInfo.clientId).
const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const result = await verifyApiToken(bearerToken);
  if (!result) return undefined;
  return {
    token: bearerToken,
    clientId: result.userId,
    scopes: [],
    extra: { userId: result.userId },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST };
