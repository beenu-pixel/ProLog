// Jednorazowa migracja powrotna: wpisy ze Strapi (Railway) → Supabase `public.entries`.
// Strapi zostaje wycofany; źródłem prawdy wpisów znów jest Supabase.
//
// 1) Zapisuje pełny eksport JSON ze Strapi do ../prolog-cms/backup/ (backup przed zmianą).
// 2) Upsert do `public.entries` po `id` (= Strapi `localId`). Idempotentny.
// 3) Usuwa z `entries` wpisy, których nie ma w Strapi (usunięte po migracji do Strapi),
//    tylko dla użytkowników obecnych w Strapi — stan końcowy = Strapi.
//
// Uruchom:  node --use-system-ca scripts/migrate-entries-from-strapi.mjs [--dry-run]
// Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (lub SERVICE_ROLE),
//                      STRAPI_API_URL, STRAPI_API_TOKEN.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
  return env;
}

const env = loadEnv();
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPA_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const STRAPI_URL = env.STRAPI_API_URL?.replace(/\/$/, "");
const STRAPI_TOKEN = env.STRAPI_API_TOKEN;

if (!SUPA_URL || !SUPA_KEY || !STRAPI_URL || !STRAPI_TOKEN) {
  console.error("Brak wymaganych zmiennych w .env.local.");
  process.exit(1);
}

async function strapiAll() {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${STRAPI_URL}/api/entries?sort=entryDate:asc&pagination[page]=${page}&pagination[pageSize]=100`,
      { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } }
    );
    if (!res.ok) throw new Error(`Strapi HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json();
    out.push(...json.data);
    if (page >= (json.meta?.pagination?.pageCount ?? 1)) break;
  }
  return out;
}

async function supa(path, init = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} → HTTP ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const strapiEntries = await strapiAll();
console.log(`Strapi: ${strapiEntries.length} wpisów.`);

// 1) Backup JSON
const backupDir = join(__dirname, "..", "..", "prolog-cms", "backup");
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const backupFile = join(backupDir, `strapi-entries-${stamp}.json`);
writeFileSync(backupFile, JSON.stringify(strapiEntries, null, 2));
console.log(`Backup zapisany: ${backupFile}`);

// Walidacja
const bad = strapiEntries.filter((s) => !UUID_RE.test(s.localId ?? "") || !UUID_RE.test(s.userId ?? ""));
if (bad.length) {
  console.error("Wpisy z niepoprawnym localId/userId (nie-uuid) — przerywam:");
  for (const b of bad) console.error(`  documentId=${b.documentId} localId=${b.localId} userId=${b.userId}`);
  process.exit(1);
}

const rows = strapiEntries.map((s) => ({
  id: s.localId,
  user_id: s.userId,
  title: s.title,
  content: s.content ?? "",
  mood: s.mood ?? null,
  sleep: s.sleep ?? null,
  energy: s.energy ?? null,
  productivity: s.productivity ?? null,
  stress: s.stress ?? null,
  photos: s.photos ?? [],
  created_at: s.entryDate ?? s.createdAt,
  updated_at: s.updatedAt ?? null,
}));

// 2) Upsert
if (DRY_RUN) {
  console.log(`[dry-run] upsert ${rows.length} wierszy do public.entries`);
} else {
  for (let i = 0; i < rows.length; i += 100) {
    await supa("entries?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 100)),
    });
  }
  console.log(`Upsert: ${rows.length} wierszy.`);
}

// 3) Usuń wpisy, których nie ma w Strapi (per użytkownik ze Strapi)
const strapiIds = new Set(rows.map((r) => r.id));
const users = [...new Set(rows.map((r) => r.user_id))];
for (const userId of users) {
  const existing = await supa(`entries?select=id,title,created_at&user_id=eq.${userId}`);
  const stale = existing.filter((e) => !strapiIds.has(e.id));
  for (const e of stale) console.log(`  do usunięcia (brak w Strapi): ${e.id} ${e.created_at} „${e.title}”`);
  if (!DRY_RUN && stale.length) {
    await supa(`entries?id=in.(${stale.map((e) => e.id).join(",")})`, { method: "DELETE" });
  }
  const count = DRY_RUN ? existing.length : (await supa(`entries?select=id&user_id=eq.${userId}`)).length;
  const inStrapi = rows.filter((r) => r.user_id === userId).length;
  console.log(`user ${userId}: Strapi=${inStrapi}, Supabase=${count}${DRY_RUN ? " (przed zmianą)" : ""}, stale=${stale.length}`);
}

console.log(DRY_RUN ? "Dry-run zakończony." : "Migracja zakończona.");
