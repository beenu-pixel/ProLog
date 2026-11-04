"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { tapHaptic } from "@/lib/haptics";
import {
  endNavigation,
  startNavigation,
  useNavigationFrom,
} from "@/lib/nav-progress";

/** Wszystko, co użytkownik odbiera jako „do stuknięcia". Pola tekstowe i suwaki celowo poza listą. */
const TAP_TARGET = [
  "a[href]",
  "button",
  "summary",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="switch"]',
  '[role="option"]',
  'label:has(input[type="checkbox"])',
  'label:has(input[type="radio"])',
  'label:has(input[type="file"])',
].join(",");

/** Opóźnienie reakcji: palec, który zaczyna przewijać, nie powinien mignąć elementem pod spodem. */
const SHOW_DELAY_MS = 50;
/** Najkrótsze widoczne wciśnięcie: szybkie stuknięcie trwa krócej, niż oko zdąży je zauważyć. */
const MIN_VISIBLE_MS = 120;
const MOVE_CANCEL_PX = 10;
/** Przejście, które nigdy nie doszło do skutku (np. handler je anulował), nie może wisieć bez końca. */
const NAV_TIMEOUT_MS = 10_000;

function findTapTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const el = node.closest<HTMLElement>(TAP_TARGET);
  if (!el || el.matches(':disabled, [aria-disabled="true"]')) return null;
  return el;
}

/** Czy ten klik zacznie przejście na inną stronę w obrębie aplikacji. */
function startsInternalNavigation(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (!(e.target instanceof Element)) return false;
  const link = e.target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download")) return false;
  if (link.target && link.target !== "_self") return false;
  const url = new URL(link.href);
  return url.origin === window.location.origin && url.pathname !== window.location.pathname;
}

/**
 * Wspólna odpowiedź aplikacji na dotyk, żeby użytkownik wiedział, że stuknięcie
 * dotarło: element pod palcem przygasa (`data-pressed`, wygląd w `globals.css`),
 * Android dodatkowo krótko wibruje, a przejście na inną stronę pokazuje pasek
 * postępu. Globalne nasłuchy zamiast `:active`, bo Safari stosuje `:active` tylko
 * przy własnych nasłuchach dotyku, a szybkie stuknięcie gasi je, zanim je widać.
 * Mysz zachowuje dotychczasowe stany `hover`.
 *
 * Pasek postępu zapalają też przejścia z kodu (`useProgressRouter`), np. po
 * zapisie wpisu — stan żyje we wspólnym storze `nav-progress`.
 */
export function TapFeedback() {
  const pathname = usePathname();
  const navFrom = useNavigationFrom();
  const navigating = navFrom !== null && navFrom === pathname;

  // Zmiana ścieżki kończy ładowanie.
  useEffect(() => {
    if (navFrom !== null && navFrom !== pathname) endNavigation();
  }, [navFrom, pathname]);

  useEffect(() => {
    let pressed: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let shownAt: number | null = null;
    let showTimer: number | undefined;
    let touchClick = false;

    const show = () => {
      if (!pressed) return;
      pressed.setAttribute("data-pressed", "");
      shownAt = performance.now();
    };

    const cancel = () => {
      window.clearTimeout(showTimer);
      pressed?.removeAttribute("data-pressed");
      pressed = null;
      shownAt = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      cancel();
      touchClick = e.pointerType !== "mouse";
      if (!touchClick) return;
      pressed = findTapTarget(e.target);
      if (!pressed) return;
      startX = e.clientX;
      startY = e.clientY;
      showTimer = window.setTimeout(show, SHOW_DELAY_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pressed) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_CANCEL_PX) cancel();
    };

    const onPointerUp = () => {
      if (!pressed) return;
      window.clearTimeout(showTimer);
      if (shownAt === null) show();
      const released = pressed;
      const elapsed = performance.now() - (shownAt ?? 0);
      pressed = null;
      shownAt = null;
      window.setTimeout(
        () => released.removeAttribute("data-pressed"),
        Math.max(0, MIN_VISIBLE_MS - elapsed)
      );
    };

    const onClick = (e: MouseEvent) => {
      if (touchClick && e.isTrusted && findTapTarget(e.target)) tapHaptic();
      touchClick = false;
      if (startsInternalNavigation(e)) startNavigation();
    };

    // Strona przywrócona z bfcache wraca razem ze stanem z chwili wyjścia.
    const onPageShow = () => {
      cancel();
      endNavigation();
      document
        .querySelectorAll("[data-pressed]")
        .forEach((el) => el.removeAttribute("data-pressed"));
    };

    const passive = { capture: true, passive: true };
    document.addEventListener("pointerdown", onPointerDown, passive);
    document.addEventListener("pointermove", onPointerMove, passive);
    document.addEventListener("pointerup", onPointerUp, passive);
    document.addEventListener("pointercancel", cancel, passive);
    document.addEventListener("click", onClick, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancel();
      document.removeEventListener("pointerdown", onPointerDown, passive);
      document.removeEventListener("pointermove", onPointerMove, passive);
      document.removeEventListener("pointerup", onPointerUp, passive);
      document.removeEventListener("pointercancel", cancel, passive);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!navigating) return;
    const timer = window.setTimeout(endNavigation, NAV_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [navigating]);

  if (!navigating) return null;
  return <div role="progressbar" aria-label="Ładowanie strony" className="nav-progress" />;
}
