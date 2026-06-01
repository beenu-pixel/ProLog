"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Zwraca false podczas renderu serwerowego i pierwszego renderu klienta,
 * true po hydratacji — bez setState w efekcie. Pozwala odróżnić „jeszcze nie
 * wczytano" od „wczytano i pusto" przy danych z localStorage.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
