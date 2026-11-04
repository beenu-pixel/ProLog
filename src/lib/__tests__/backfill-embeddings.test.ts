import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Atrapa klienta Supabase: tylko to, czego używa backfill (select/eq/not/order/
// range/upsert). Dane w pamięci — bez kluczy i bez sieci.
type Row = Record<string, unknown>;
const db: { entries: Row[]; entry_index: Row[] } = { entries: [], entry_index: [] };
const upserts: Row[][] = [];
const rangeCalls: { table: string; from: number; to: number }[] = [];

function query(table: "entries" | "entry_index") {
  const filters: ((r: Row) => boolean)[] = [];
  let range: [number, number] | null = null;
  const builder = {
    select: () => builder,
    order: () => builder,
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    not: (col: string, op: string, val: unknown) => {
      if (op === "is" && val === null) filters.push((r) => r[col] != null);
      return builder;
    },
    range: (from: number, to: number) => {
      range = [from, to];
      rangeCalls.push({ table, from, to });
      return builder;
    },
    upsert: async (rows: Row[]) => {
      upserts.push(rows);
      for (const row of rows) {
        const i = db.entry_index.findIndex((r) => r.local_id === row.local_id);
        if (i >= 0) db.entry_index[i] = row;
        else db.entry_index.push(row);
      }
      return { error: null };
    },
    then: (resolve: (v: { data: Row[]; error: null }) => void) => {
      let rows = db[table].filter((r) => filters.every((f) => f(r)));
      if (range) rows = rows.slice(range[0], range[1] + 1);
      resolve({ data: rows, error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: (t: "entries" | "entry_index") => query(t) },
}));

const { backfillEmbeddings, backfillEmbeddingsForUser } = await import("@/lib/services/embeddings");

const fetchMock = vi.fn();

beforeEach(() => {
  db.entries = [];
  db.entry_index = [];
  upserts.length = 0;
  rangeCalls.length = 0;
  process.env.OPENAI_API_KEY = "test-key";
  fetchMock.mockReset();
  // OpenAI embeddings: tyle wektorów 1536-wymiarowych, ile tekstów w żądaniu.
  fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
    const { input } = JSON.parse(init.body) as { input: string[] };
    return new Response(
      JSON.stringify({ data: input.map((_, index) => ({ index, embedding: new Array(1536).fill(0.01) })) }),
      { status: 200 }
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function seed(n: number, indexedEvery = 3, user = "u1") {
  for (let i = 0; i < n; i++) {
    const id = `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
    db.entries.push({ id, user_id: user, title: `t${i}`, content: `<p>c${i}</p>`, created_at: `2026-07-01T10:00:00.000Z` });
    // Co trzeci wpis ma już wektor w indeksie; część innych ma wiersz bez wektora.
    if (i % indexedEvery === 0) db.entry_index.push({ local_id: id, user_id: user, embedding: "[0.1]" });
    else if (i % 2 === 0) db.entry_index.push({ local_id: id, user_id: user, embedding: null });
  }
}

describe("backfillEmbeddings → entry_index", () => {
  it("uzupełnia braki w entry_index partiami po 64 (np. 105 braków na 158 wpisów)", async () => {
    seed(158);
    const missing = db.entries.length - db.entry_index.filter((r) => r.embedding != null).length;
    expect(missing).toBe(105);

    const result = await backfillEmbeddings();
    expect(result).toEqual({ scanned: 158, missing: 105, embedded: 105, failed: 0, remaining: 0 });
    // 105 = 64 + 41 → dwa żądania do OpenAI i dwa upserty.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(upserts.map((u) => u.length)).toEqual([64, 41]);
    expect(upserts[0][0]).toMatchObject({ user_id: "u1", entry_date: "2026-07-01T10:00:00.000Z" });
    expect(db.entry_index.every((r) => r.embedding != null)).toBe(true);
  });

  it("jest idempotentny: drugie uruchomienie nic nie robi", async () => {
    seed(20);
    await backfillEmbeddings();
    fetchMock.mockClear();
    const again = await backfillEmbeddings();
    expect(again).toMatchObject({ missing: 0, embedded: 0, remaining: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("limit na wywołanie zostawia resztę w `remaining`", async () => {
    seed(158);
    const first = await backfillEmbeddings({ maxPerRun: 50 });
    expect(first).toMatchObject({ missing: 105, embedded: 50, remaining: 55 });
    const second = await backfillEmbeddings({ maxPerRun: 50 });
    expect(second).toMatchObject({ missing: 55, embedded: 50, remaining: 5 });
  });

  it("stronicuje odczyt po 1000 wierszy (więcej wpisów niż jedna strona)", async () => {
    seed(1500, 1); // wszystkie zaindeksowane
    const result = await backfillEmbeddings();
    expect(result).toMatchObject({ scanned: 1500, missing: 0 });
    expect(rangeCalls.filter((c) => c.table === "entries").map((c) => c.from)).toEqual([0, 1000]);
  });

  it("zawęża do jednego konta", async () => {
    seed(6, 3, "u1");
    seed(0);
    db.entries.push({ id: "other", user_id: "u2", title: "x", content: "", created_at: "2026-07-02T10:00:00.000Z" });
    const result = await backfillEmbeddingsForUser("u1");
    expect(result.scanned).toBe(6);
    expect(upserts.flat().every((r) => r.user_id === "u1")).toBe(true);
  });

  it("błąd jednej partii nie przerywa kolejnych, brak klucza przerywa całość", async () => {
    seed(158);
    let call = 0;
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      call++;
      if (call === 1) return new Response("boom", { status: 500 });
      const { input } = JSON.parse(init.body) as { input: string[] };
      return new Response(
        JSON.stringify({ data: input.map((_, index) => ({ index, embedding: new Array(1536).fill(0) })) }),
        { status: 200 }
      );
    });
    const result = await backfillEmbeddings();
    expect(result).toMatchObject({ embedded: 41, failed: 64 });

    delete process.env.OPENAI_API_KEY;
    await expect(backfillEmbeddings()).rejects.toMatchObject({ status: 503 });
  });
});
