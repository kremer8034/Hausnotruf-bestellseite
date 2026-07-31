import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Erneuert die Anmeldesitzung, damit sie in Server Components gültig bleibt.
 * Läuft nur auf den geschützten Bereichen – die Kundenstrecke braucht keine
 * Anmeldung und soll ohne Umweg ausgeliefert werden.
 */
export async function middleware(anfrage: NextRequest) {
  const antwort = NextResponse.next({ request: anfrage });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const schluessel = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !schluessel) return antwort;

  const client = createServerClient(url, schluessel, {
    cookies: {
      getAll: () => anfrage.cookies.getAll(),
      setAll: (zuSetzen: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of zuSetzen) {
          antwort.cookies.set(name, value, options);
        }
      },
    },
  });

  await client.auth.getUser();
  return antwort;
}

export const config = {
  matcher: ["/backoffice/:path*", "/techniker/:path*", "/anmelden"],
};
