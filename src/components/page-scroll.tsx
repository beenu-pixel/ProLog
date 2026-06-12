"use client";

import { CustomScroll } from "@/components/custom-scroll";
import { cn } from "@/lib/utils";

/**
 * Przewijanie całej strony własnym, animowanym paskiem — tym samym, co lista
 * wpisów (cienka pastylka pojawiająca się przy najechaniu/przewijaniu, zamiast
 * stałego natywnego scrolla). Używane na trasach o zablokowanej (do wysokości
 * ekranu) powłoce, np. /settings i /stats: treść przewija się wewnątrz tego
 * kontenera. Na mobile powłoka nie jest blokowana, więc scroll strony pozostaje
 * natywny.
 *
 * Thumb stoi tuż przy prawej krawędzi okna (thumbRight dodatni), a nie w rynnie
 * panelu jak przy liście wpisów.
 */
export function PageScroll({
  children,
  contentClassName,
}: {
  children: React.ReactNode;
  /** Dodatkowe klasy obszaru przewijania, np. dolny prześwit pod kompozytor
   *  (`lg:pb-28`), gdy pływający pasek nachodzi na treść. */
  contentClassName?: string;
}) {
  return (
    <CustomScroll
      className="min-h-0 flex-1"
      contentClassName={cn("h-full", contentClassName)}
      thumbRight={4}
    >
      {children}
    </CustomScroll>
  );
}
