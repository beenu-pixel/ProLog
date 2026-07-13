import sanitizeHtml from "sanitize-html";

// Sanityzacja HTML treści wpisów. Treść jest renderowana przez
// `dangerouslySetInnerHTML`, a do bazy może trafić przez REST/MCP `create_entry`
// (pole `content` przyjmuje dowolny HTML) — bez czyszczenia byłby to wektor
// stored XSS (np. `<img src=x onerror=...>`). Czyścimy whitelistą zgodną z
// wyjściem edytora TipTap StarterKit; wszystko spoza listy (skrypty, atrybuty
// `on*`, `style`, `iframe`) jest usuwane.
//
// Świadomie używamy `sanitize-html` (czysty parser JS, htmlparser2), a NIE
// `isomorphic-dompurify`: ten drugi na serwerze ciągnie `jsdom`, którego drzewo
// zależności (html-encoding-sniffer → @exodus/bytes, ESM) wywala się w runtime
// serverless Vercela (`ERR_REQUIRE_ESM`) → 500 na route'ach sanityzujących wpis
// po stronie serwera (/api/cms/entries, /api/v1/entries, MCP). `sanitize-html`
// nie ma jsdom i działa identycznie serwerowo i w przeglądarce (render).

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
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    // Brak dozwolonych atrybutów — StarterKit nie dodaje żadnych do tych tagów,
    // a pusta mapa odcina `href`, `src`, `style`, `on*` itp.
    allowedAttributes: {},
    // Tagi spoza whitelisty usuwamy razem z zawartością dla elementów, które
    // realnie niosą kod/treść wykonywalną (skrypty, style, osadzenia). Dla reszty
    // (domyślnie) tag znika, ale tekst zostaje — spójnie z DOMPurify.
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  });
}
