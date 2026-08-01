import type { NextConfig } from "next";

/**
 * Kopfzeilen, die auf jeder Antwort stehen.
 *
 * Die Inhaltsrichtlinie (CSP) fehlt hier bewusst: Sie braucht für jede Seite
 * einen frischen Zufallswert und steht deshalb in der Middleware.
 */
const sicherheitsKopfzeilen = [
  // Kein Einbetten in fremde Seiten. Sonst ließe sich die Unterschriftenfläche
  // unsichtbar über eine fremde Schaltfläche legen und jemand würde
  // unterschreiben, ohne es zu merken.
  { key: "X-Frame-Options", value: "DENY" },
  // Browser sollen den vom Server genannten Dateityp nicht überstimmen.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Beim Wechsel auf eine fremde Seite nur die Herkunft mitgeben, nie den
  // vollen Pfad - in dem stünde sonst etwa eine Vertragskennung.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Die Seite braucht weder Kamera noch Mikrofon noch Standort.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Nur über HTTPS, für ein Jahr.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Verrät sonst die eingesetzte Fassung von Next.js.
  poweredByHeader: false,

  // Das Vertrags-PDF wird zur Laufzeit aus dem Dateisystem gelesen.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/vertrag/**"],
  },

  async headers() {
    return [
      { source: "/:pfad*", headers: sicherheitsKopfzeilen },
      // Geschützte Bereiche gehören in keinen Suchindex.
      {
        source: "/:bereich(backoffice|techniker|api)/:pfad*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
