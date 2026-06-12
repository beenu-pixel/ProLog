"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Wrapper z własnym, animowanym paskiem przewijania (jak lista wpisów). Natywny
 * pasek chowamy (`.hide-native-scroll`), a nakładamy `.scroll-thumb`, którego
 * pozycję i wysokość liczy JS z proporcji przewijania; pojawia się po najechaniu
 * (`.show-scroll`). Style/animacja są w `globals.css`.
 *
 * Wymaga POJEDYNCZEGO elementu-dziecka opakowującego treść — to jego rozmiar
 * obserwuje `ResizeObserver`, więc thumb aktualizuje się przy zmianie/rośnięciu
 * treści (np. dochodzące wiadomości, strumień odpowiedzi).
 *
 * `thumbRight` przesuwa thumb w poziomie: ujemne = w rynnie poza treścią (lista
 * wpisów), dodatnie = tuż przy wewnętrznej krawędzi (panel czatu).
 *
 * Wysokość obszaru przewijania ustala `contentClassName`: w kolumnie o znanej
 * wysokości użyj `h-full` (lista wpisów wypełnia `flex-1`); gdzie wysokości brak —
 * `max-h-[...]`, by panel rósł z treścią i przewijał się po przekroczeniu (czat).
 */
export function CustomScroll({
  children,
  className,
  contentClassName,
  contentStyle,
  thumbRight = -8,
  innerRef,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Styl inline obszaru przewijania (np. maska fade krawędzi listy). */
  contentStyle?: CSSProperties;
  thumbRight?: number;
  innerRef?: RefObject<HTMLDivElement | null>;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = innerRef ?? internalRef;
  const thumbRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Auto-ukrywanie po przewinięciu oraz flaga „kursor przy prawej krawędzi".
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearEdgeRef = useRef(false);

  const showThumb = useCallback(() => {
    wrapRef.current?.classList.add("show-scroll");
  }, []);
  const hideThumb = useCallback(() => {
    wrapRef.current?.classList.remove("show-scroll");
  }, []);

  // Pasek pojawia się, dopiero gdy kursor wjedzie w wąską strefę przy prawej
  // krawędzi (jakby chciał go chwycić) — nie na całym obszarze treści.
  const EDGE_ZONE = 44; // px od prawej krawędzi
  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const near = rect.right - e.clientX <= EDGE_ZONE;
      nearEdgeRef.current = near;
      if (near) {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        showThumb();
      } else if (!hideTimerRef.current) {
        // Z dala od krawędzi i poza oknem auto-ukrycia po scrollu → chowamy.
        hideThumb();
      }
    },
    [showThumb, hideThumb]
  );

  const handleMouseLeave = useCallback(() => {
    nearEdgeRef.current = false;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    hideThumb();
  }, [hideThumb]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );

  const updateThumb = useCallback(() => {
    const sc = scrollRef.current;
    const th = thumbRef.current;
    if (!sc || !th) return;
    const { scrollTop, scrollHeight, clientHeight } = sc;
    if (scrollHeight <= clientHeight + 1) {
      th.style.height = "0px"; // brak przewijania = brak thumba
      return;
    }
    const thumbH = Math.max(24, (clientHeight / scrollHeight) * clientHeight);
    const maxTop = clientHeight - thumbH;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    th.style.height = `${thumbH}px`;
    th.style.top = `${top}px`;
  }, [scrollRef]);

  // Realne przewijanie (kółko/trackpad/klawiatura): pokaż pasek i zaplanuj jego
  // schowanie chwilę po zatrzymaniu — chyba że kursor czeka przy krawędzi.
  const handleScroll = useCallback(() => {
    updateThumb();
    showThumb();
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (!nearEdgeRef.current) hideThumb();
    }, 900);
  }, [updateThumb, showThumb, hideThumb]);

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    updateThumb();

    // Rośnięcie treści (np. strumień odpowiedzi) łapiemy obserwując dzieci;
    // pojawienie/wymianę dzieci (hydratacja, filtr, nowe wiadomości) — mutacjami.
    const ro = new ResizeObserver(updateThumb);
    ro.observe(sc);
    const observeChildren = () => {
      for (const child of Array.from(sc.children)) ro.observe(child);
    };
    observeChildren();
    const mo = new MutationObserver(() => {
      observeChildren();
      updateThumb();
    });
    mo.observe(sc, { childList: true });
    window.addEventListener("resize", updateThumb);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", updateThumb);
    };
  }, [updateThumb, scrollRef]);

  return (
    <div
      ref={wrapRef}
      className={cn("custom-scroll-wrap relative", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn("hide-native-scroll overflow-y-auto", contentClassName)}
        style={contentStyle}
      >
        {children}
      </div>
      <div ref={thumbRef} className="scroll-thumb" style={{ right: thumbRight }} aria-hidden />
    </div>
  );
}
