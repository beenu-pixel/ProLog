import { Brain, BookOpen, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";

const FEATURES = [
  {
    icon: Brain,
    title: "Cyfrowy psychoterapeuta",
    desc: "Rozmawiaj z AI, które zna kontekst Twoich wpisów. Zadaje trafne pytania, pomaga nazwać emocje i spojrzeć na sytuację ze stoickim spokojem.",
  },
  {
    icon: BookOpen,
    title: "Dziennik i nastrój",
    desc: "Codzienne wpisy, ocena nastroju 1–5 i statystyki, które pokazują wzorce. Prosty, skupiony interfejs w duchu stoicyzmu — nic Cię nie rozprasza.",
  },
  {
    icon: ShieldCheck,
    title: "Prywatność i integracje",
    desc: "Twoje dane są pod kontrolą. Funkcje AI dostępne dopiero po zalogowaniu, a dla zaawansowanych — REST API, MCP i własne integracje.",
  },
];

export function LandingFeatures() {
  return (
    <section id="funkcje" className="mx-auto w-full max-w-6xl px-6 py-20 lg:px-8 lg:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Wszystko, czego potrzebujesz do refleksji
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Trzy filary ProLog — codzienny zapis, rozmowa z AI i pełna kontrola nad danymi.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 120}>
            <Card className="h-full transition-transform duration-300 hover:-translate-y-1">
              <CardHeader>
                <span className="flex size-11 items-center justify-center rounded-lg border bg-secondary/50">
                  <f.icon className="size-5" strokeWidth={1.8} />
                </span>
                <CardTitle className="mt-4 text-xl">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
