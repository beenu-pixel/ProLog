"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Ten sam animowany pasek przewijania co `CustomScroll`, ale dla przewijania
 * CAŁEGO OKNA — dla tras, które nie mają własnego kontenera scrolla (np. `/docs`,
 * gdzie własny `overflow` zepsułby `sticky` bocznej nawigacji). Natywny pasek
 * okna chowamy klasą `hide-native-scroll` na <html>, a zamiast niego rysujemy
 * pływający thumb: pojawia się przy przewijaniu i gdy kursor podjedzie do prawej
 * krawędzi ekranu, i da się go chwycić myszą.
 */
export function WindowScroll() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearEdgeRef = useRef(false);
  const draggingRef = useRef(false);

  const showThumb = useCallback(() => {
    wrapRef.current?.classList.add("show-scroll");
  }, []);
  const hideThumb = useCallback(() => {
    if (draggingRef.current) return;
    wrapRef.current?.classList.remove("show-scroll");
  }, []);

  const metrics = () => {
    const doc = document.documentElement;
    const view = window.innerHeight;
    const total = Math.max(doc.scrollHeight, document.body.scrollHeight);
    return { view, total, maxScroll: total - view };
  };

  const updateThumb = useCallback(() => {
    const th = thumbRef.current;
    if (!th) return;
    const { view, total, maxScroll } = metrics();
    if (maxScroll <= 1) {
      th.style.height = "0px";
      return;
    }
    const thumbH = Math.max(24, (view / total) * view);
    const maxTop = view - thumbH;
    th.style.height = `${thumbH}px`;
    th.style.top = `${(window.scrollY / maxScroll) * maxTop}px`;
  }, []);

  useEffect(() => {
    // Natywny pasek okna chowamy tylko na czas życia tej trasy.
    document.documentElement.classList.add("hide-native-scroll");
    updateThumb();

    const onScroll = () => {
      updateThumb();
      showThumb();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        if (!nearEdgeRef.current) hideThumb();
      }, 900);
    };
    const onMove = (e: MouseEvent) => {
      const near = window.innerWidth - e.clientX <= 44;
      nearEdgeRef.current = near;
      if (near) {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        showThumb();
      } else if (!hideTimerRef.current) {
        hideThumb();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", updateThumb);
    // Zmiana wysokości treści (rozwijane sekcje, dociągane dane) → nowa proporcja.
    const ro = new ResizeObserver(updateThumb);
    ro.observe(document.body);

    return () => {
      document.documentElement.classList.remove("hide-native-scroll");
      document.body.classList.remove("scroll-dragging");
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", updateThumb);
      ro.disconnect();
    };
  }, [updateThumb, showThumb, hideThumb]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const th = thumbRef.current;
      if (!th || e.button !== 0) return;
      const { view, maxScroll } = metrics();
      const maxThumbTop = view - th.offsetHeight;
      if (maxThumbTop <= 0 || maxScroll <= 0) return;
      e.preventDefault();

      const startY = e.clientY;
      const startScroll = window.scrollY;
      draggingRef.current = true;
      try {
        th.setPointerCapture(e.pointerId);
      } catch {
        // brak przechwycenia to nie problem — ruch śledzimy na oknie
      }
      document.body.classList.add("scroll-dragging");
      showThumb();

      const onMove = (ev: PointerEvent) => {
        const next = startScroll + ((ev.clientY - startY) * maxScroll) / maxThumbTop;
        window.scrollTo({ top: Math.min(maxScroll, Math.max(0, next)) });
      };
      const onUp = (ev: PointerEvent) => {
        draggingRef.current = false;
        document.body.classList.remove("scroll-dragging");
        try {
          th.releasePointerCapture(ev.pointerId);
        } catch {}
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (!nearEdgeRef.current) hideThumb();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [showThumb, hideThumb]
  );

  return (
    <div
      ref={wrapRef}
      className="custom-scroll-wrap pointer-events-none fixed inset-y-0 right-0 z-50 w-4"
      aria-hidden
    >
      <div
        ref={thumbRef}
        className="scroll-thumb"
        style={{ right: 4 }}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
}
