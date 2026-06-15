import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { SessionRedirect } from "@/components/landing/session-redirect";

export const metadata: Metadata = {
  title: "ProLog — stoicki dziennik z cyfrowym psychoterapeutą",
  description:
    "Zapisuj refleksje i rozmawiaj z AI, które zna kontekst Twoich wpisów. Dziennik nastroju w duchu stoicyzmu — zacznij za darmo.",
};

/**
 * Strona główna `/` — publiczny landing. Treść jest renderowana serwerowo
 * (SEO), a `SessionRedirect` po stronie klienta przenosi zalogowanego
 * użytkownika do dziennika.
 */
export default function Home() {
  return (
    <>
      <SessionRedirect />
      <LandingPage />
    </>
  );
}
