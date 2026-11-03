"use client";

import { useEffect } from "react";

/**
 * Woła `onRestored`, gdy przeglądarka przywraca stronę z pamięci (bfcache), np.
 * po cofnięciu z Google albo Stripe. Stan sprzed przekierowania wraca wtedy razem
 * ze stroną, więc bez tego przycisk zostałby w „ładowaniu" na zawsze.
 * `onRestored` musi być stabilne (useCallback).
 */
export function usePageRestored(onRestored: () => void): void {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onRestored();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [onRestored]);
}
