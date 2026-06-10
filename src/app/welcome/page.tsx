"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  useSession,
} from "@/lib/auth";
import { markWelcomeSeen } from "@/lib/welcome";

type Mode = "signin" | "signup";

/**
 * Ekran powitalny / logowania — część aplikacji (chrome aplikacji ukryty na tej
 * trasie). Nazwa aplikacji + logowanie e-mailem/hasłem (Supabase) oraz Google.
 * Logowanie jest nieobowiązkowe: „Wejdź bez konta" prowadzi do dziennika
 * (offline). Zalogowany użytkownik jest od razu przekierowany do dziennika.
 */
export default function WelcomePage() {
  const router = useRouter();
  const session = useSession();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Gdy sesja już istnieje (np. wejście tutaj po zalogowaniu) — do dziennika.
  useEffect(() => {
    if (session) {
      markWelcomeSeen();
      router.replace("/entries");
    }
  }, [session, router]);

  const isSignup = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError("Podaj e-mail i hasło.");
      return;
    }

    setLoading(true);
    const result = isSignup
      ? await signUpWithEmail(email.trim(), password)
      : await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setInfo("Konto utworzone. Sprawdź skrzynkę i potwierdź adres e-mail.");
      return;
    }
    // Sukces z sesją — przekierowanie obsłuży efekt reagujący na `session`.
    markWelcomeSeen();
  };

  const handleGoogle = () => {
    markWelcomeSeen();
    void signInWithGoogle();
  };

  const handleSkip = () => {
    markWelcomeSeen();
    router.push("/entries");
  };

  const switchMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setInfo(null);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">ProLog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Twój osobisty dziennik refleksji.
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {isSignup ? "Załóż konto" : "Zaloguj się"}
          </CardTitle>
          <CardDescription>
            {isSignup
              ? "Utwórz konto, aby synchronizować wpisy między urządzeniami."
              : "Zaloguj się, aby synchronizować wpisy między urządzeniami."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj.email@gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-muted-foreground">{info}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Proszę czekać…"
                : isSignup
                  ? "Załóż konto"
                  : "Zaloguj się"}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">lub</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
          >
            Zaloguj przez Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignup ? "Masz już konto?" : "Nie masz konta?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {isSignup ? "Zaloguj się" : "Załóż konto"}
            </button>
          </p>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={handleSkip}
        className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Wejdź bez konta
      </button>
    </div>
  );
}
