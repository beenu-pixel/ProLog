// Markery efektów dźwiękowych (Sound Effect Design).
//
// Dźwięki odtwarzamy przez Web Audio API, a nie `new Audio()`, bo to drugie
// dokłada zauważalne opóźnienie: każde kliknięcie musiałoby pobrać i zdekodować
// plik na nowo. Tutaj:
//   1. bajty plików pobieramy z wyprzedzeniem (już przy załadowaniu modułu),
//   2. dekodujemy je raz do bufora przy pierwszym odtworzeniu,
//   3. kolejne odtworzenia startują natychmiast z gotowego bufora,
//   4. pomijamy ewentualną ciszę na początku pliku, żeby klik szedł od razu.
//
// Każde nazwane zdarzenie to „oznaczone miejsce", w którym ma zagrać efekt.
// Aby dodać/podmienić dźwięk, wrzuć plik `public/sounds/<name>.mp3`.

import { isSoundEnabled } from "@/lib/settings";

export type SoundName =
  | "theme-toggle" // przełączenie trybu jasny/ciemny
  | "entry-new" // rozpoczęcie tworzenia wpisu (przycisk „+")
  | "entry-save" // zapis wpisu (nowy lub edycja)
  | "entry-delete" // usunięcie wpisu
  | "dictate-start" // start dyktowania głosowego
  | "dictate-stop"; // zatrzymanie dyktowania głosowego

const SOUND_NAMES: SoundName[] = [
  "theme-toggle",
  "entry-new",
  "entry-save",
  "entry-delete",
  "dictate-start",
  "dictate-stop",
];

// Surowe bajty plików — pobierane z wyprzedzeniem, więc nie czekamy na sieć
// w momencie kliknięcia.
const rawBytes = new Map<SoundName, Promise<ArrayBuffer>>();
// Zdekodowane bufory gotowe do natychmiastowego odtworzenia.
const buffers = new Map<SoundName, AudioBuffer>();
// Offset startu (w sekundach) pomijający ciszę na początku pliku.
const startOffsets = new Map<SoundName, number>();

let audioCtx: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

// Pierwsza próbka powyżej progu = realny początek dźwięku. Pozwala pominąć
// ciszę nagraną na starcie pliku, przez którą klik „szedł" z opóźnieniem.
function computeStartOffset(buffer: AudioBuffer): number {
  const threshold = 0.005;
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    if (Math.abs(data[i]) > threshold) {
      // Mała poduszka, by nie obciąć ataku dźwięku.
      return Math.max(0, i / buffer.sampleRate - 0.003);
    }
  }
  return 0;
}

function prefetch(name: SoundName): Promise<ArrayBuffer> {
  let bytes = rawBytes.get(name);
  if (!bytes) {
    bytes = fetch(`/sounds/${name}.mp3`).then((res) => res.arrayBuffer());
    rawBytes.set(name, bytes);
  }
  return bytes;
}

async function ensureBuffer(
  ctx: AudioContext,
  name: SoundName
): Promise<AudioBuffer | null> {
  const cached = buffers.get(name);
  if (cached) return cached;
  try {
    const bytes = await prefetch(name);
    // decodeAudioData „odpina" ArrayBuffer, więc dekodujemy z kopii.
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    buffers.set(name, buffer);
    startOffsets.set(name, computeStartOffset(buffer));
    return buffer;
  } catch {
    return null;
  }
}

function playBuffer(ctx: AudioContext, name: SoundName, buffer: AudioBuffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0, startOffsets.get(name) ?? 0);
}

/**
 * Odtwarza efekt dźwiękowy dla danego zdarzenia. Bezpieczne do wywołania w
 * dowolnym handlerze — brak pliku/uprawnień nie rzuca błędem. Pierwsze użycie
 * dekoduje plik (z już pobranych bajtów), kolejne grają natychmiast.
 */
export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  // AudioContext bywa „suspended" do pierwszego gestu użytkownika — wznawiamy.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  const ready = buffers.get(name);
  if (ready) {
    playBuffer(ctx, name, ready);
    return;
  }

  // Jeszcze nie zdekodowane — dekodujemy i gramy, gdy będzie gotowe.
  void ensureBuffer(ctx, name).then((buffer) => {
    if (buffer) playBuffer(ctx, name, buffer);
  });
}

// Pobranie bajtów z wyprzedzeniem (bez AudioContext, więc bez ostrzeżeń
// o braku gestu) — w chwili kliknięcia zostaje już tylko szybkie dekodowanie.
if (typeof window !== "undefined") {
  SOUND_NAMES.forEach((name) => {
    void prefetch(name).catch(() => {});
  });
}
