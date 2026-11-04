import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge musi znać własne tokeny z globals.css. Inaczej `text-caption`
// (rozmiar) wygląda dla niego jak kolor i znika, gdy obok stoi `text-foreground`,
// a `shadow-raised` jak kolor cienia.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "ui", "body", "title", "display"],
      shadow: ["raised", "overlay"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
