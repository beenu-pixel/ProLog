"use client";

import { useEffect, useState } from "react";
import { ChevronDown, KeyRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiTokenManager } from "@/components/api-token-manager";
import { ApiDocs } from "@/components/docs/api-docs";
import { McpDocs } from "@/components/docs/mcp-docs";
import { useOrigin } from "@/components/docs/shared";

// Dokumentacja ProLog (styl docs.vercel.com): wspólny górny pasek z generatorem
// tokenu + przełącznik dwóch zakładek (API / MCP). Treść każdej zakładki ma
// własną przyklejoną nawigację (patrz api-docs.tsx / mcp-docs.tsx).

type Tab = "api" | "mcp";

function isTab(value: string | null): value is Tab {
  return value === "api" || value === "mcp";
}

export default function DocsPage() {
  const origin = useOrigin();
  const [tab, setTab] = useState<Tab>("api");
  const [tokenOpen, setTokenOpen] = useState(false);

  // Synchronizacja z ?tab= — odczyt raz po montażu (klient-only, bez rozjazdu
  // SSR: serwer renderuje domyślne "api", a tu jednorazowo dostrajamy do URL).
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorazowy odczyt query po hydracji
    if (isTab(param)) setTab(param);
  }, []);

  const selectTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.hash = "";
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
      {/* Wspólny pasek: tytuł + generator tokenu + zakładki */}
      <header className="space-y-6 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              Dokumentacja ProLog
            </h1>
            <p className="text-sm text-muted-foreground">
              Steruj dziennikiem z zewnątrz — przez REST API lub serwer MCP.
              Obie drogi używają tego samego Personal Access Tokenu.
            </p>
          </div>

          {/* Generator tokenu — wspólny dla obu zakładek (rozwijany) */}
          <button
            type="button"
            onClick={() => setTokenOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              tokenOpen
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-expanded={tokenOpen}
          >
            <KeyRound className="size-4" />
            Token API
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                tokenOpen && "rotate-180"
              )}
            />
          </button>
        </div>

        {tokenOpen && (
          <div className="rounded-xl border bg-secondary/20 p-4">
            <ApiTokenManager />
          </div>
        )}

        {/* Przełącznik zakładek */}
        <div className="flex gap-1">
          {(
            [
              { id: "api", label: "API" },
              { id: "mcp", label: "MCP" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="pt-8">
        {tab === "api" ? <ApiDocs origin={origin} /> : <McpDocs origin={origin} />}
      </div>
    </div>
  );
}
