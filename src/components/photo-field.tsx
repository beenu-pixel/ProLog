"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { useSignedPhotoUrls } from "@/hooks/use-signed-photo-urls";
import { uploadPhoto } from "@/lib/photos";
import type { EntryPhoto } from "@/lib/types";

export interface PhotoFieldHandle {
  /** Otwiera systemowe okno wyboru plików (woła go przycisk z paska narzędzi). */
  open: () => void;
}

/**
 * Przycisk „dodaj zdjęcie" do slotu `toolbarExtra` edytora — stylem dopasowany
 * do pozostałych ikon paska narzędzi (`Dyktuj`). Renderowany tylko zalogowanym.
 */
export function PhotoAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Dodaj zdjęcie"
      title="Dodaj zdjęcie"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ImagePlus className="size-4" />
      <span>Zdjęcie</span>
    </button>
  );
}

interface PhotoFieldProps {
  photos: EntryPhoto[];
  onChange: (photos: EntryPhoto[]) => void;
  /** Zgłasza wgrane w tej sesji zdjęcie (rodzic sprząta porzucone uploady). */
  onUploaded?: (photo: EntryPhoto) => void;
}

/** Lokalny stan wgrywanego pliku — miniatura z `URL.createObjectURL`. */
interface Pending {
  tempId: string;
  previewUrl: string;
}

/**
 * Edytowalna siatka zdjęć wpisu: ukryty input pliku (otwierany przez `open()`),
 * miniatury wgranych zdjęć z przyciskiem usuwania oraz miniatury w trakcie
 * uploadu (spinner). Usunięcie zmienia tylko tablicę — kasowanie z Storage robi
 * rodzic przy zapisie/porzuceniu, by edycja dało się cofnąć (Anuluj).
 */
export const PhotoField = forwardRef<PhotoFieldHandle, PhotoFieldProps>(
  function PhotoField({ photos, onChange, onUploaded }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState<Pending[]>([]);
    const [error, setError] = useState<string | null>(null);
    const { urls } = useSignedPhotoUrls(photos);

    useImperativeHandle(ref, () => ({
      open: () => inputRef.current?.click(),
    }));

    const handleFiles = async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError(null);
      const files = Array.from(fileList).filter((f) =>
        f.type.startsWith("image/")
      );

      // Lokalny akumulator: kolejne pliki z jednej partii dokładamy do najświeższej
      // listy bez czekania na re-render rodzica między uploadami.
      let working = photos;
      for (const file of files) {
        const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        setPending((prev) => [...prev, { tempId, previewUrl }]);
        try {
          const photo = await uploadPhoto(file);
          working = [...working, photo];
          onChange(working);
          onUploaded?.(photo);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Nie udało się wgrać zdjęcia."
          );
        } finally {
          URL.revokeObjectURL(previewUrl);
          setPending((prev) => prev.filter((p) => p.tempId !== tempId));
        }
      }
    };

    const remove = (id: string) => {
      onChange(photos.filter((p) => p.id !== id));
    };

    const hasAny = photos.length > 0 || pending.length > 0;

    return (
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            // Reset, by ponowny wybór tego samego pliku też odpalił onChange.
            e.target.value = "";
          }}
        />

        {hasAny && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {urls[photo.path] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase; next/image wymagałby konfiguracji remotePatterns
                  <img
                    src={urls[photo.path]}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Usuń zdjęcie"
                  onClick={() => remove(photo.id)}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-opacity hover:bg-background"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}

            {pending.map((p) => (
              <div
                key={p.tempId}
                className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- lokalny podgląd z createObjectURL */}
                <img
                  src={p.previewUrl}
                  alt=""
                  className="size-full object-cover opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);
