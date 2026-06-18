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
  const path = `${userId}/${id}.${fileExt(file)}`;

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
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
  } catch {
    // Sprzątanie Storage to najlepszy wysiłek — błąd nie może psuć zapisu.
  }
}

/**
 * Tworzy podpisane URL-e dla podanych ścieżek. Best-effort: przy braku
 * sesji/konfiguracji lub błędzie zwraca pusty obiekt (nigdy nie rzuca).
 */
export async function getSignedUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  try {
    if (!isConfigured || !supabase) return {};
    const { data, error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error || !data) return {};
    const map: Record<string, string> = {};
    for (const item of data) {
      if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
    }
    return map;
  } catch {
    return {};
  }
}
