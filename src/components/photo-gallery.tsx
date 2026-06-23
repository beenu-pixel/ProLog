"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { PhotoLightbox } from "@/components/photo-lightbox";
import { useSignedPhotoUrls } from "@/hooks/use-signed-photo-urls";
import type { EntryPhoto } from "@/lib/types";

/** Maks. liczba miniatur w siatce; nadmiar chowamy pod nakładką „+N". */
const MAX_TILES = 4;

interface PhotoGalleryProps {
  photos: EntryPhoto[];
}

/**
 * Siatka miniatur zdjęć wpisu (tylko podgląd). Po kliknięciu otwiera
 * pełnoekranowy lightbox ze wszystkimi zdjęciami. Bezpieczna wewnątrz `<Link>`
 * (klik miniatury zatrzymuje nawigację rodzica). Renderuje się tylko, gdy są
 * zdjęcia i uda się uzyskać podpisane URL-e (prywatny bucket → tylko właściciel).
 */
export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const { urls, loading } = useSignedPhotoUrls(photos);
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (photos.length === 0) return null;

  // Tylko zdjęcia z dostępnym URL-em (właściciel). Gość/brak sesji → pusto.
  const resolved = photos
    .map((p) => ({ id: p.id, url: urls[p.path] }))
    .filter((p): p is { id: string; url: string } => Boolean(p.url));

  if (loading && resolved.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-xl border">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (resolved.length === 0) return null;

  const tiles = resolved.slice(0, MAX_TILES);
  const overflow = resolved.length - tiles.length;

  const open = (e: React.MouseEvent, index: number) => {
    // Działa wewnątrz <Link> w widoku dnia — nie nawigujemy do szczegółu.
    e.preventDefault();
    e.stopPropagation();
    setOpenAt(index);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((img, i) => {
          const isLast = i === tiles.length - 1 && overflow > 0;
          return (
            <button
              key={img.id}
              type="button"
              onClick={(e) => open(e, i)}
              className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              <GalleryImage url={img.url} />
              {isLast && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-medium text-white">
                  +{overflow}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {openAt !== null && (
        <PhotoLightbox
          images={resolved}
          index={openAt}
          onIndexChange={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  );
}

/**
 * Pojedyncza miniatura z własnym wskaźnikiem ładowania. Pokazuje kółko, dopóki
 * obraz nie zostanie w pełni pobrany — wtedy znika spinner, a obraz pojawia się
 * od razu w całości (bez stopniowego doczytywania). Każda miniatura ładuje się
 * niezależnie od pozostałych.
 */
function GalleryImage({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
      <img
        src={url}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`size-full object-cover transition-transform duration-200 hover:scale-[1.03] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}
