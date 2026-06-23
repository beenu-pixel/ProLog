import { describe, expect, it } from "vitest";

import { validateAudioFile, MAX_AUDIO_BYTES } from "@/lib/audio-validation";

describe("validateAudioFile", () => {
  it("przepuszcza poprawny plik audio w granicach rozmiaru", () => {
    expect(validateAudioFile({ size: 1024, type: "audio/webm" })).toBeNull();
    expect(validateAudioFile({ size: MAX_AUDIO_BYTES, type: "audio/mpeg" })).toBeNull();
  });

  it("przepuszcza plik bez ustawionego typu MIME (MediaRecorder bywa pusty)", () => {
    expect(validateAudioFile({ size: 1024, type: "" })).toBeNull();
  });

  it("odrzuca zbyt duży plik kodem 413", () => {
    const result = validateAudioFile({ size: MAX_AUDIO_BYTES + 1, type: "audio/webm" });
    expect(result?.status).toBe(413);
  });

  it("odrzuca plik nie-audio kodem 400", () => {
    expect(validateAudioFile({ size: 1024, type: "image/png" })?.status).toBe(400);
    expect(validateAudioFile({ size: 1024, type: "application/pdf" })?.status).toBe(400);
  });

  it("rozmiar sprawdzany przed typem (duży obraz → 413, nie 400)", () => {
    const result = validateAudioFile({ size: MAX_AUDIO_BYTES + 1, type: "image/png" });
    expect(result?.status).toBe(413);
  });
});
