"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { hasSeenWelcome } from "@/lib/welcome";

/**
 * Bramka wejścia. Logowanie jest nieobowiązkowe: zalogowany użytkownik lub ktoś,
 * kto już widział ekran powitalny (też po „Wejdź bez konta"), trafia od razu do
 * dziennika; pozostali na ekran powitalny. Decyzja po stronie klienta, bo zależy
 * od sesji i flagi w localStorage.
 */
export default function Home() {
  const router = useRouter();
  const ready = useHydrated();
  const session = useSession();

  useEffect(() => {
    if (!ready) return;
    if (session || hasSeenWelcome()) router.replace("/entries");
    else router.replace("/welcome");
  }, [ready, session, router]);

  return null;
}
