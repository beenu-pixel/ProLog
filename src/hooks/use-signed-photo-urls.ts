"use client";

import { useEffect, useMemo, useState } from "react";

import { getSignedUrls } from "@/lib/photos";
import type { EntryPhoto } from "@/lib/types";

/**
 * Rozwiązuje listę zdjęć wpisu na podpisane URL-e (prywatny bucket). Regeneruje
 * je przy zmianie zestawu ścieżek; przy braku sesji/konfiguracji zwraca pustą
 * mapę. Zwraca `loading` na czas pierwszego rozwiązania danego zestawu.
 */
export function useSignedPhotoUrls(photos: EntryPhoto[] | undefined): {
  urls: Record<string, string>;
  loading: boolean;
} {
  // Stabilny klucz zestawu ścieżek — efekt odpala się tylko przy realnej zmianie.
  const paths = useMemo(() => (photos ?? []).map((p) => p.path), [photos]);
  const key = paths.join("|");

  const [urls, setUrls] = useState<Record<string, string>>({});
  // Klucz zestawu, dla którego mamy już rozwiązane URL-e. `loading` jest z tego
  // wyprowadzone, dzięki czemu efekt nie woła setState synchronicznie.
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // getSignedUrls([]) zwraca {} natychmiast — pusty zestaw też „rozwiązuje" klucz.
    void getSignedUrls(paths).then((map) => {
      if (cancelled) return;
      setUrls(map);
      setResolvedKey(key);
    });
    return () => {
      cancelled = true;
    };
    // `key` reprezentuje zestaw ścieżek; `paths` jest z niego wyprowadzone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = paths.length > 0 && resolvedKey !== key;

  return { urls, loading };
}
