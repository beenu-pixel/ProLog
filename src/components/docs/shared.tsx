"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

// Wspólne elementy dokumentacji (zakładki API i MCP): badge metody/narzędzia,
// tabela pól, sekcja endpointu/narzędzia, sticky nawigacja, scroll-spy i
// odczyt origin. Trzymane osobno, by obie zakładki wyglądały identycznie.

export type Method = "GET" | "POST" | "TOOL";

export interface NavItem {
  id: string;
  label: string;
  method?: Method;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

export function MethodBadge({ method }: { method: Method }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
        method === "GET" &&
          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        method === "POST" &&
          "bg-blue-500/15 text-blue-600 dark:text-blue-400",
        method === "TOOL" &&
          "bg-violet-500/15 text-violet-600 dark:text-violet-400"
      )}
    >
      {method}
    </span>
  );
}

export interface Field {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

export function FieldTable({ fields }: { fields: Field[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Pole</th>
            <th className="px-3 py-2 font-medium">Typ</th>
            <th className="px-3 py-2 font-medium">Wymagane</th>
            <th className="px-3 py-2 font-medium">Opis</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-b last:border-0 align-top">
              <td className="px-3 py-2">
                <code className="font-mono text-xs">{f.name}</code>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{f.type}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {f.required ? "tak" : "nie"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sekcja jednego endpointu/narzędzia z nagłówkiem i badge metody. */
export function Endpoint({
  id,
  title,
  method,
  path,
  children,
}: {
  id: string;
  title: string;
  method: Method;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 border-t pt-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          <MethodBadge method={method} />
          <code className="font-mono text-sm text-muted-foreground">{path}</code>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Przyklejona lewa nawigacja z podświetleniem aktywnej sekcji. */
export function DocsSidebar({
  nav,
  active,
}: {
  nav: NavGroup[];
  active: string;
}) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <nav className="sticky top-20 space-y-6">
        {nav.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active === item.id
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.method && <MethodBadge method={item.method} />}
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Scroll-spy: zwraca id sekcji najbliższej górze widoku. */
export function useScrollSpy(ids: string[], initial: string): string {
  const [active, setActive] = useState(initial);
  const key = ids.join("|");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // `key` odzwierciedla zmianę listy id (np. przy przełączeniu zakładki).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}

/** Base URL bieżącego hosta — przez external store, by uniknąć rozjazdu SSR. */
export function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://twoja-domena"
  );
}
