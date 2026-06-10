"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { playSound } from "@/lib/sound";

// --- Transkrypcja głosu (Groq Whisper) ------------------------------------
// Zamiast Web Speech API (zob. `use-dictation.ts`) nagrywamy audio przez
// `MediaRecorder`, a po zatrzymaniu wysyłamy plik do `/api/transcribe`, który
// po stronie serwera woła Groq. Daje to lepszą jakość polskiego i interpunkcję,
// kosztem braku podglądu „na żywo" — transkrypt pojawia się po nagraniu.
//
// Kontrakt jest zgodny z `useDictation` (`supported`, `listening`, `toggle`),
// rozszerzony o `transcribing` — etap po stopie, gdy czekamy na odpowiedź API.

const noopSubscribe = () => () => {};

function isSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export interface UseTranscription {
  /** Czy przeglądarka wspiera nagrywanie (po hydratacji). */
  supported: boolean;
  /** Czy trwa nagrywanie. */
  listening: boolean;
  /** Czy trwa wysyłka/transkrypcja po zatrzymaniu nagrywania. */
  transcribing: boolean;
  /** Start/stop nagrywania. */
  toggle: () => void;
}

/**
 * Nagrywanie głosu i transkrypcja przez Groq (Whisper). Gotowy transkrypt trafia
 * do `onTranscript`. Odtwarza markery start/stop jak dyktowanie.
 */
export function useTranscription(
  onTranscript: (text: string) => void
): UseTranscription {
  // Wsparcie czytamy jak useHydrated — bez setState w efekcie i bez niezgodności
  // hydratacji (serwer: false, klient po hydratacji: realne).
  const supported = useSyncExternalStore(noopSubscribe, isSupported, () => false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Najświeższy callback bez przebudowy nagrywarki.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Zatrzymuje ścieżki mikrofonu (gaśnie wskaźnik nagrywania w przeglądarce).
  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  // Sprzątanie przy odmontowaniu.
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // mogło nie nagrywać — pomijamy
      }
      releaseStream();
    };
  }, []);

  const transcribe = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) return;
      const data = (await res.json()) as { text?: string };
      const text = data.text?.trim();
      if (text) onTranscriptRef.current(text);
    } catch {
      // Najlepszy wysiłek — błąd sieci/serwera nie może wywalić apki.
    } finally {
      setTranscribing(false);
    }
  };

  const start = async () => {
    if (!isSupported()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseStream();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size > 0) void transcribe(blob);
      };

      recorderRef.current = recorder;
      recorder.start();
      setListening(true);
      playSound("dictate-start");
    } catch {
      // Brak zgody na mikrofon / inny błąd — sprzątamy, by kolejny klik działał.
      releaseStream();
      recorderRef.current = null;
      setListening(false);
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setListening(false);
    playSound("dictate-stop");
    if (!recorder) {
      releaseStream();
      return;
    }
    try {
      recorder.stop(); // dalej w `onstop`: budowa bloba + wysyłka
    } catch {
      releaseStream();
    }
  };

  const toggle = () => {
    if (listening) stop();
    else void start();
  };

  return { supported, listening, transcribing, toggle };
}
