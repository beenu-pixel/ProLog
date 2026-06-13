"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { getAccessToken } from "@/lib/auth";

// Panel zużycia AI dla właściciela: kto (konto) ile wywołał i ile tokenów zużył,
// per endpoint, w ostatnich 30 dniach. Sam się chowa, gdy bieżące konto nie ma
// uprawnień (endpoint zwraca 403) — dlatego można go montować dla każdej sesji.

interface UsageSummary {
  userEmail: string;
  endpoint: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

const ENDPOINT_LABEL: Record<string, string> = {
  transcribe: "Transkrypcja",
  therapist: "Terapeuta",
  api_agent: "API / MCP",
};

type State =
  | { kind: "loading" }
  | { kind: "hidden" } // brak uprawnień (403) lub brak konfiguracji
  | { kind: "ready"; summary: UsageSummary[] }
  | { kind: "error" };

export function UsageDashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (active) setState({ kind: "hidden" });
        return;
      }
      try {
        const res = await fetch("/api/admin/usage", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!active) return;
        if (res.status === 403) {
          setState({ kind: "hidden" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        const data = (await res.json()) as { summary: UsageSummary[] };
        setState({ kind: "ready", summary: data.summary ?? [] });
      } catch {
        if (active) setState({ kind: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Niewidoczny dla nie-właścicieli — nie zdradzamy istnienia panelu.
  if (state.kind === "hidden") return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Zużycie AI (ostatnie 30 dni)
      </h2>

      <div className="rounded-xl border">
        {state.kind === "loading" ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Wczytywanie…
          </div>
        ) : state.kind === "error" ? (
          <p className="p-4 text-sm text-destructive">
            Nie udało się pobrać zużycia.
          </p>
        ) : state.summary.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Brak zarejestrowanego zużycia w tym okresie.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="p-3 font-medium">Konto</th>
                  <th className="p-3 font-medium">Funkcja</th>
                  <th className="p-3 text-right font-medium">Wywołania</th>
                  <th className="p-3 text-right font-medium">Tokeny we/wy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.summary.map((r) => (
                  <tr key={`${r.userEmail} ${r.endpoint}`}>
                    <td className="truncate p-3">{r.userEmail}</td>
                    <td className="p-3">{ENDPOINT_LABEL[r.endpoint] ?? r.endpoint}</td>
                    <td className="p-3 text-right tabular-nums">{r.calls}</td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {r.inputTokens.toLocaleString("pl")} /{" "}
                      {r.outputTokens.toLocaleString("pl")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
