"use client";

import { useSyncExternalStore } from "react";

import {
  getEntriesSnapshot,
  getServerEntriesSnapshot,
  subscribeEntries,
} from "@/lib/storage";
import type { Entry } from "@/lib/types";

/** Reaktywna lista wpisów z localStorage (najnowsze na górze). */
export function useEntries(): Entry[] {
  return useSyncExternalStore(
    subscribeEntries,
    getEntriesSnapshot,
    getServerEntriesSnapshot
  );
}
