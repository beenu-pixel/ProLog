"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import { retrySync, useSession } from "@/lib/auth";
import { useSyncIssue } from "@/lib/sync-status";

/**
 * Komunikat pod nagłówkiem, gdy wymiana wpisów z chmurą się nie udała. Zapis
 * lokalny działa dalej, więc nie blokujemy pracy, tylko mówimy, co się stało.
 */
export function SyncNotice() {
  const session = useSession();
  const issue = useSyncIssue();
  const [retrying, setRetrying] = useState(false);

  if (!session || !issue) return null;

  const retry = async () => {
    setRetrying(true);
    await retrySync();
    setRetrying(false);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-4">
      <div
        role="status"
        className="flex items-center justify-between gap-3 rounded-xl border p-3"
      >
        <p className="text-sm">
          {issue === "pull"
            ? "Nie udało się pobrać wpisów z chmury. Lista może być niepełna."
            : "Wpis jest na tym urządzeniu, ale nie dotarł do chmury."}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void retry()}
          disabled={retrying}
          aria-busy={retrying}
        >
          {retrying ? "Ponawiam" : "Spróbuj ponownie"}
          {retrying && <LoadingDots />}
        </Button>
      </div>
    </div>
  );
}
