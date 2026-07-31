import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Das Vertrags-PDF wird zur Laufzeit aus dem Dateisystem gelesen.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/vertrag/**"],
  },
};

export default nextConfig;
