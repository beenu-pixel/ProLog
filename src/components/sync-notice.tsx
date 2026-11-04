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
    <div className="mx-auto w-full max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] lg:px-10 lg:pt-6">
      <div
        role="status"
        className="flex items-center justify-between gap-4 rounded-lg border bg-card py-2 pr-2 pl-4"
      >
        <p className="text-ui">
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
