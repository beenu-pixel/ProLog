import type { ReactNode } from "react";

/**
 * Układ dokumentacji API. Strona przewija się razem z oknem (jak /settings),
 * dlatego NIE tworzymy tu własnego kontenera przewijania — własny `overflow`
 * przejąłby kontekst `sticky` lewej nawigacji, przez co przy braku realnego
 * scrolla wewnątrz odklejałaby się i znikała. Bez niego `sticky` przykleja się
 * do okna i nawigacja zostaje widoczna przez całe przewijanie.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="w-full">{children}</div>;
}
