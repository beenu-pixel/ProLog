"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface LightboxImage {
  id: string;
  url: string;
}

interface PhotoLightboxProps {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Pełnoekranowy podgląd zdjęć: czarne tło, wyśrodkowany obraz, nawigacja
 * strzałkami (klawiatura ← →, Esc do zamknięcia) i przyciskami. Tap w tło lub ✕
 * zamyka. Mobile-first, ale działa też myszą/klawiaturą na desktopie.
 */
export function PhotoLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const count = images.length;
  const hasMany = count > 1;

  const prev = () => onIndexChange((index - 1 + count) % count);
  const next = () => onIndexChange((index + 1) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMany) onIndexChange((index - 1 + count) % count);
      else if (e.key === "ArrowRight" && hasMany) onIndexChange((index + 1) % count);
    };
    window.addEventListener("keydown", onKey);
    // Blokada przewijania tła na czas otwartego podglądu.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, count, hasMany, onClose, onIndexChange]);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 duration-200 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Podgląd zdjęcia"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      {hasMany && (
        <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/90">
          {index + 1} / {count}
        </span>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
      <img
        src={current.url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] object-contain"
      />

      {hasMany && (
        <>
          <NavButton side="left" onClick={prev} />
          <NavButton side="right" onClick={next} />
        </>
      )}
    </div>
  );
}

function NavButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Poprzednie" : "Następne"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20",
        side === "left" ? "left-3" : "right-3"
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-6" />
      ) : (
        <ChevronRight className="size-6" />
      )}
    </button>
  );
}
