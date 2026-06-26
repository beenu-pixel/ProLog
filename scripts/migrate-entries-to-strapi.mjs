// Jednorazowa migracja: wpisy z Supabase (tabela `entries`) → Strapi (typ `Entry`).
// Idempotentna po `localId` (= id z Supabase). Treść staje się źródłem prawdy w Strapi;
// embeddingi siedzą już w `entry_index` (skopiowane osobnym SQL). Stara tabela `entries`
// pozostaje nietknięta jako backup.
//
// Uruchom:  node scripts/migrate-entries-to-strapi.mjs
// Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (lub SERVICE_ROLE),
//                      STRAPI_API_URL, STRAPI_API_TOKEN (full-access).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function readSupabaseEntries() {
  const cols = "id,title,content,mood,sleep,energy,productivity,stress,photos,created_at,user_id";
  const res = await fetch(`${SUPA_URL}/rest/v1/entries?select=${cols}&limit=10000`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase read HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function strapiFindByLocalId(localId) {
  const res = await fetch(
    `${STRAPI_URL}/api/entries?filters[localId][$eq]=${encodeURIComponent(localId)}&pagination[pageSize]=1`,
    { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } }
  );
  if (!res.ok) throw new Error(`Strapi find HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data?.[0] ?? null;
}

async function strapiCreate(row) {
  const data = {
    title: row.title,
    content: row.content,
    mood: row.mood ?? null,
    sleep: row.sleep ?? null,
    energy: row.energy ?? null,
    productivity: row.productivity ?? null,
    stress: row.stress ?? null,
    entryDate: row.created_at,
    userId: row.user_id,
    localId: row.id,
    photos: row.photos ?? [],
  };
  const res = await fetch(`${STRAPI_URL}/api/entries`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Strapi create HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const rows = await readSupabaseEntries();
  console.log(`Wczytano ${rows.length} wpisów z Supabase.`);
  let created = 0, skipped = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await strapiFindByLocalId(row.id);
      if (existing) { skipped++; }
      else { await strapiCreate(row); created++; }
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${rows.length}] BŁĄD localId=${row.id}:`, err.message);
    }
    if ((i + 1) % 25 === 0) console.log(`...${i + 1}/${rows.length} (utw=${created} pom=${skipped} bł=${failed})`);
  }
  console.log(`GOTOWE: utworzono=${created}, pominięto=${skipped}, błędy=${failed}, razem=${rows.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
