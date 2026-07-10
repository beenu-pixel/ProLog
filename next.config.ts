import type { NextConfig } from "next";

// Nagłówki bezpieczeństwa dla WSZYSTKICH tras. Domykają „A05 Security
// Misconfiguration" z audytu: clickjacking, MIME-sniffing, wyciek referera,
// nadmiarowe uprawnienia przeglądarki, brak wymuszenia HTTPS.
//
// Świadomie POMIJAMY na razie Content-Security-Policy — wymaga osobnego,
// ostrożnego dostrojenia (Next wstrzykuje inline-skrypty, landing używa three.js,
// motyw ustawia inline-skrypt w <head>), a zbyt ciasna CSP wywróciłaby aplikację.
// X-Frame-Options: DENY i tak daje pełną ochronę przed clickjackingiem.
const securityHeaders = [
  // Wymuszenie HTTPS (ignorowane na http://localhost — bezpieczne lokalnie).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Zakaz osadzania w obcych ramkach → brak clickjackingu.
  { key: "X-Frame-Options", value: "DENY" },
  // Przeglądarka nie zgaduje typu treści (blokuje ataki przez MIME-sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nie wysyłaj pełnego URL-a (z danymi) do obcych domen.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Mikrofon TYLKO dla własnej domeny (transkrypcja głosu); kamera i geolokalizacja
  // wyłączone — aplikacja ich nie używa (zdjęcia idą zwykłym inputem plików).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
