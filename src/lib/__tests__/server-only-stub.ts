// Pusty stub pakietu `server-only` na potrzeby testów (vitest).
// `server-only` to znacznik bundlera Next (rzuca tylko przy imporcie z klienta) —
// w środowisku node/vitest nie ma go w resolverze, więc aliasujemy go tutaj na no-op,
// dzięki czemu testy mogą importować moduły serwerowe (np. search.ts → entry-index.ts).
export {};
