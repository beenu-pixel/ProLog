"use client";

import { Suspense, useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";

import { supabase, isConfigured } from "@/lib/supabase";

// PostHog (region EU). Inicjalizacja po stronie klienta. WAŻNE: ProLog to dziennik
// + rozmowy z terapeutą, więc w nagraniach sesji MASKUJEMY cały tekst i pola formularzy,
// żeby nie zapisywać wrażliwych treści użytkownika (RODO). Heatmapy działają na autocapture.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/** Ręczne pageviews — App Router (SPA) nie wysyła ich sam na zmianach trasy. */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthog.__loaded) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/** Powiązuje zdarzenia z zalogowanym użytkownikiem (Supabase) — person_profiles: identified_only. */
function PostHogIdentify() {
  useEffect(() => {
    if (!isConfigured || !supabase || !KEY) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data.session?.user;
      if (user && posthog.__loaded) {
        posthog.identify(user.id, { email: user.email });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!posthog.__loaded) return;
      if (event === "SIGNED_IN" && session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      } else if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!KEY || typeof window === "undefined" || posthog.__loaded) return;
    posthog.init(KEY, {
      api_host: HOST,
      defaults: "2026-05-30",
      person_profiles: "identified_only",
      capture_pageview: false, // robimy ręcznie (App Router)
      capture_pageleave: true,
      capture_exceptions: true, // error tracking
      autocapture: true, // potrzebne do heatmap i auto-zdarzeń
      capture_heatmaps: true,
      // Prywatność nagrań sesji: maskuj WSZYSTKIE pola i tekst (wrażliwe treści dziennika).
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
