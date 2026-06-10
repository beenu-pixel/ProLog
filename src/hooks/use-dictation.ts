"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { playSound } from "@/lib/sound";

// --- Dyktowanie (Web Speech API) -----------------------------------------
// Typy mowy nie są w standardowym lib.dom, więc definiujemy minimalny kontrakt.
type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

export interface UseDictation {
  /** Czy przeglądarka wspiera Web Speech API (po hydratacji). */
  supported: boolean;
  /** Czy trwa nasłuchiwanie. */
  listening: boolean;
  /** Start/stop dyktowania. */
  toggle: () => void;
}

/**
 * Dyktowanie głosowe (Web Speech API) jako reużywalny hook. Każdy gotowy
 * fragment transkrypcji trafia do `onTranscript`. Odtwarza markery start/stop.
 *
 * Na każdy start tworzymy ŚWIEŻY egzemplarz `SpeechRecognition`. Reużywanie
 * jednego obiektu po `stop()` jest zawodne (Chrome potrafi już nie wznowić
 * rozpoznawania / `start()` rzuca `InvalidStateError`), przez co „podyktuj →
 * przerwij → podyktuj znowu" przestawało działać. Świeży obiekt to naprawia.
 */
export function useDictation(onTranscript: (text: string) => void): UseDictation {
  // Wsparcie czytamy jak useHydrated — bez setState w efekcie i bez niezgodności
  // hydratacji (serwer: false, klient po hydratacji: realne).
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== null,
    () => false
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Najświeższy callback bez przebudowy obiektu rozpoznawania.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Odpinamy uchwyty i zatrzymujemy rozpoznawanie bez ruszania stanu Reacta
  // (przydatne przy starcie kolejnej sesji i przy odmontowaniu).
  const teardown = (recognition: SpeechRecognitionLike | null) => {
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
    try {
      recognition.stop();
    } catch {
      // mogło nie być uruchomione — pomijamy.
    }
  };

  // Sprzątanie przy odmontowaniu.
  useEffect(() => {
    return () => {
      teardown(recognitionRef.current);
      recognitionRef.current = null;
    };
  }, []);

  const stop = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    // WAŻNE: nie zerujemy `onresult` przed `stop()`. `stop()` dostarcza jeszcze
    // ostatnią (często jedyną) finalną frazę przez `onresult` tuż przed `onend` —
    // gdybyśmy odpięli uchwyt wcześniej, te słowa by przepadły. Sprzątanie
    // referencji i stanu zrobi `onend` (`finish`).
    try {
      recognition.stop();
    } catch {
      // nie wystartowało — wymuś sprzątanie ręcznie
      recognitionRef.current = null;
    }
    setListening(false);
    playSound("dictate-stop");
  };

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    // Posprzątaj ewentualny poprzedni egzemplarz, zanim wystartujemy nowy.
    teardown(recognitionRef.current);

    const recognition = new Ctor();
    recognition.lang = "pl-PL";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) text += result[0].transcript;
      }
      const trimmed = text.trim();
      if (trimmed) onTranscriptRef.current(trimmed);
    };
    // Zakończenie (cisza/limit/stop) lub błąd — zsynchronizuj stan, ale tylko gdy
    // to wciąż AKTUALNa sesja (świeży start mógł już podmienić ref).
    const finish = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setListening(false);
      }
    };
    recognition.onend = finish;
    recognition.onerror = finish;

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      playSound("dictate-start");
    } catch {
      // Gdyby start() mimo wszystko rzucił — wyczyść, żeby kolejny klik działał.
      recognitionRef.current = null;
      setListening(false);
    }
  };

  const toggle = () => {
    if (listening) stop();
    else start();
  };

  return { supported, listening, toggle };
}
