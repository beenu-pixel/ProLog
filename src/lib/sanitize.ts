import DOMPurify from "isomorphic-dompurify";

// Sanityzacja HTML treści wpisów. Treść jest renderowana przez
// `dangerouslySetInnerHTML`, a do bazy może trafić przez REST/MCP `create_entry`
// (pole `content` przyjmuje dowolny HTML) — bez czyszczenia byłby to wektor
// stored XSS (np. `<img src=x onerror=...>`). Czyścimy whitelistą zgodną z
// wyjściem edytora TipTap StarterKit; wszystko spoza listy (skrypty, atrybuty
// `on*`, `style`, `iframe`) jest usuwane. `isomorphic-dompurify` działa zarówno
// serwerowo (zapis w `createEntry`), jak i w przeglądarce (render).

// Tagi, które realnie produkuje StarterKit (formatowanie + listy + nagłówki).
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "u",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "hr",
];

/**
 * Czyści HTML treści wpisu do bezpiecznego podzbioru. Zachowuje formatowanie
 * edytora, usuwa wszelkie elementy/atrybuty zdolne wykonać kod. Zwraca pusty
 * string dla wartości pustej/niepoprawnej.
 */
export function sanitizeEntryHtml(html: string): string {
  if (typeof html !== "string" || html === "") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    // Brak potrzebnych atrybutów — StarterKit nie dodaje żadnych do tych tagów,
    // a pusta lista odcina `href`, `src`, `style`, `on*` itp.
    ALLOWED_ATTR: [],
  });
}
