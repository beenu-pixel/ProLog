import { supabase, isConfigured } from "@/lib/supabase";
import type { EntryPhoto } from "@/lib/types";

/**
 * Operacje na zdjęciach wpisów w prywatnym buckecie Supabase Storage.
 *
 * Bucket jest prywatny, a RLS na `storage.objects` ogranicza dostęp do obiektów,
 * których pierwszy segment ścieżki to `auth.uid()`. Dlatego wszystkie operacje
 * wymagają zalogowanej sesji — upload jest dostępny tylko dla zalogowanych
 * (spójnie z funkcjami AI). Podgląd działa przez czasowe, podpisane URL-e.
 */

export const PHOTOS_BUCKET = "entry-photos";

/** Czas życia podpisanego URL-a (sekundy) — wystarczający na sesję przeglądania. */
const SIGNED_URL_TTL = 3600;

// --- Kompresja przed uploadem --------------------------------------------
// Dłuższy bok skalujemy do tego limitu i zapisujemy jako WebP. Dzięki temu
// nowe zdjęcia ważą dziesiątki KB zamiast kilku MB — miniatury i lightbox
// ładują się od razu, także na planie free (brak transformacji po stronie CDN).
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.8;

/** Id zalogowanego użytkownika lub null (brak sesji / konfiguracji). */
async function currentUserId(): Promise<string | null> {
  if (!isConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Wyciąga rozszerzenie pliku (małe litery) lub bezpieczny fallback. */
function fileExt(file: File): string {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  // Fallback z typu MIME (np. image/jpeg → jpeg).
  const fromType = file.type.split("/").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(fromType) ? fromType : "bin";
}

/**
 * Skaluje i kompresuje obraz do WebP (po stronie klienta, na canvasie). Zwraca
 * dane do uploadu: `blob` i rozszerzenie. Bezpieczny fallback do oryginału, gdy:
 * brak DOM (SSR), nieobsługiwany format (np. GIF — zachowujemy animację),
 * dekodowanie się nie powiedzie, albo wynik nie jest mniejszy niż oryginał
 * (np. już lekki WebP). Nigdy nie rzuca.
 */
async function compressImage(file: File): Promise<{ blob: Blob; ext: string }> {
  const fallback = { blob: file as Blob, ext: fileExt(file) };
  if (typeof document === "undefined") return fallback;
  // GIF mógłby być animowany — canvas spłaszczyłby go do jednej klatki.
  if (file.type === "image/gif" || !file.type.startsWith("image/")) return fallback;

  try {
    // `imageOrientation: from-image` uwzględnia EXIF, by zdjęcie nie wyszło obrócone.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return fallback;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
    );
    // Nie pogarszaj: gdy WebP nie powstał lub jest większy, zostaw oryginał.
    if (!blob || blob.size >= file.size) return fallback;
    return { blob, ext: "webp" };
  } catch {
    return fallback;
  }
}

/**
 * Wgrywa pojedyncze zdjęcie do prywatnego bucketa pod ścieżką
 * `${userId}/${uuid}.${ext}` i zwraca referencję `EntryPhoto`. Rzuca, gdy
 * brak sesji/konfiguracji lub upload się nie powiedzie — wołający pokazuje błąd.
 */
export async function uploadPhoto(file: File): Promise<EntryPhoto> {
  const userId = await currentUserId();
  if (!userId || !supabase) {
    throw new Error("Zaloguj się, aby dodać zdjęcie.");
  }

  const id =
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Kompresja do WebP przed wysłaniem (z bezpiecznym fallbackiem do oryginału).
  const { blob, ext } = await compressImage(file);
  const path = `${userId}/${id}.${ext}`;

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || file.type || undefined,
      cacheControl: String(SIGNED_URL_TTL),
      upsert: false,
    });
  if (error) throw error;

  return { id, path };
}

/** Usuwa zdjęcia z Storage (best-effort — nie rzuca przy błędzie/braku sesji). */
export async function deletePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const userId = await currentUserId();
    if (!userId || !supabase) return;
    await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
    // Zdejmij ewentualne wpisy z cache — i tak nie wskazują już na nic.
    if (typeof window !== "undefined") {
      for (const path of paths) {
        try {
          window.sessionStorage.removeItem(URL_CACHE_PREFIX + path);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Sprzątanie Storage to najlepszy wysiłek — błąd nie może psuć zapisu.
  }
}

// --- Cache podpisanych URL-i ---------------------------------------------
// Bez cache każde wejście we wpis generowało świeży token, więc przeglądarka
// traktowała ten sam plik jak nowy adres (cache miss) i pobierała go od nowa.
// Trzymamy URL-e w `sessionStorage` per ścieżka z TTL — ponowne otwarcie wpisu
// używa tego samego adresu, dzięki czemu obraz idzie z cache przeglądarki.
const URL_CACHE_PREFIX = "prolog.signed_url.";
// Zapas przed wygaśnięciem tokenu — by nie podać URL-a, który zaraz przestanie działać.
const URL_CACHE_SAFETY_MS = 60_000;

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

function readCachedUrl(path: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(URL_CACHE_PREFIX + path);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSignedUrl;
    if (Date.now() >= cached.expiresAt) {
      window.sessionStorage.removeItem(URL_CACHE_PREFIX + path);
      return null;
    }
    return cached.url;
  } catch {
    return null;
  }
}

function writeCachedUrl(path: string, url: string): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CachedSignedUrl = {
      url,
      expiresAt: Date.now() + SIGNED_URL_TTL * 1000 - URL_CACHE_SAFETY_MS,
    };
    window.sessionStorage.setItem(URL_CACHE_PREFIX + path, JSON.stringify(entry));
  } catch {
    // Brak miejsca / niedostępne sessionStorage — cache jest tylko optymalizacją.
  }
}

/**
 * Tworzy podpisane URL-e dla podanych ścieżek. Najpierw sięga po świeże wpisy z
 * cache (`sessionStorage`), a podpisuje tylko brakujące — i te dopisuje do cache,
 * by ponowne otwarcie wpisu trafiało w cache przeglądarki zamiast pobierać plik
 * od nowa. Best-effort: przy braku sesji/konfiguracji lub błędzie zwraca to, co
 * udało się ustalić (nigdy nie rzuca).
 */
export async function getSignedUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const map: Record<string, string> = {};
  const misses: string[] = [];
  for (const path of paths) {
    const cached = readCachedUrl(path);
    if (cached) map[path] = cached;
    else misses.push(path);
  }
  if (misses.length === 0) return map;

  try {
    if (!isConfigured || !supabase) return map;
    const { data, error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrls(misses, SIGNED_URL_TTL);
    if (error || !data) return map;
    for (const item of data) {
      if (item.path && item.signedUrl) {
        map[item.path] = item.signedUrl;
        writeCachedUrl(item.path, item.signedUrl);
      }
    }
    return map;
  } catch {
    return map;
  }
}
