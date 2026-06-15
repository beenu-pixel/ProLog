"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/auth";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Strona główna `/` to publiczny landing. Zalogowanego użytkownika
 * przekierowujemy od razu do dziennika — goście (nawet ci, którzy widzieli już
 * ekran powitalny) zostają na landingu. Komponent nic nie renderuje.
 */
export function SessionRedirect() {
  const router = useRouter();
  const ready = useHydrated();
  const session = useSession();

  useEffect(() => {
    if (ready && session) router.replace("/entries");
  }, [ready, session, router]);

  return null;
}
