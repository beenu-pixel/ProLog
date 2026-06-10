"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  getEntriesSnapshot,
  getServerEntriesSnapshot,
  subscribeEntries,
} from "@/lib/storage";
import { useSession } from "@/lib/auth";
import { isSeedEntry } from "@/lib/seed";
import type { Entry } from "@/lib/types";

/**
 * Reaktywna lista wpisów z localStorage (najnowsze na górze).
 *
 * Gdy użytkownik jest zalogowany, ukrywamy wpisy-seedy (przykładowy wypełniacz
 * UI) — zalogowane konto ma widzieć tylko własne wpisy (na start: pusto).
 * Bez konta seedy pozostają widoczne jak dotąd.
 */
export function useEntries(): Entry[] {
  const all = useSyncExternalStore(
    subscribeEntries,
    getEntriesSnapshot,
    getServerEntriesSnapshot
  );
  const session = useSession();

  return useMemo(
    () => (session ? all.filter((entry) => !isSeedEntry(entry)) : all),
    [all, session]
  );
}
