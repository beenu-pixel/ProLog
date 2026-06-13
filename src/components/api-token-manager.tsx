"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/auth";
import {
  listTokens,
  createToken,
  revokeToken,
  type ApiToken,
} from "@/lib/api-tokens";

/**
 * Wspólny panel zarządzania Personal Access Tokenami — używany w Ustawieniach
 * i na stronie /docs. Pełny token pokazujemy JEDEN raz, zaraz po utworzeniu.
 * Niezalogowany użytkownik widzi zachętę do logowania.
 */
export function ApiTokenManager() {
  const session = useSession();
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loggedIn = Boolean(session);

  useEffect(() => {
    if (!loggedIn) return;
    let active = true;
    void listTokens().then((list) => {
      if (active) setTokens(list);
    });
    return () => {
      active = false;
    };
  }, [loggedIn]);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const { token, created } = await createToken(name);
      setFreshToken(token);
      setCopied(false);
      setName("");
      setTokens((prev) => [created, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wygenerować tokenu.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Odwołać ten token? Aplikacje, które go używają, stracą dostęp.")
    ) {
      return;
    }
    setTokens((prev) => (prev ?? []).filter((t) => t.id !== id));
    await revokeToken(id);
  };

  const handleCopy = async () => {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // schowek niedostępny — użytkownik może zaznaczyć ręcznie
    }
  };

  if (!loggedIn) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4" /> Klucze API
        </div>
        <p className="text-sm text-muted-foreground">
          Zaloguj się, aby wygenerować Personal Access Token i sterować aplikacją
          przez API.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/welcome">Zaloguj się lub załóż konto</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generowanie */}
      <div className="space-y-3 rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">Wygeneruj nowy token</p>
          <p className="text-sm text-muted-foreground">
            Nadaj nazwę (np. „skrypt domowy”), by łatwo go rozpoznać. Token
            zobaczysz tylko raz.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa tokenu"
            maxLength={60}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating) void handleCreate();
            }}
          />
          <Button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : "Wygeneruj"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {freshToken && (
          <div className="space-y-2 rounded-lg border border-foreground/20 bg-secondary/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Skopiuj token teraz — nie pokażemy go ponownie:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-background px-2 py-1.5 font-mono text-xs">
                {freshToken}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Kopiuj token"
                onClick={() => void handleCopy()}
              >
                {copied ? (
                  <Check className="size-4 text-foreground" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-xl border">
        {tokens === null ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Wczytywanie…
          </div>
        ) : tokens.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nie masz jeszcze żadnych tokenów.
          </p>
        ) : (
          <ul className="divide-y">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t.name || "Token bez nazwy"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <code className="font-mono">{t.tokenPrefix ?? "plog_…"}</code>
                    {" · utworzono "}
                    {formatDate(t.createdAt)}
                    {t.lastUsedAt
                      ? ` · użyto ${formatDate(t.lastUsedAt)}`
                      : " · jeszcze nieużywany"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Odwołaj token"
                  className={cn("text-muted-foreground hover:text-destructive")}
                  onClick={() => void handleRevoke(t.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
