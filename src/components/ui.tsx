import Link from "next/link";
import { ReactNode } from "react";

/**
 * PLATZHALTER: Bis das offizielle BRK-Logo als Datei vorliegt, wird das
 * Rotkreuz-Signet als SVG gezeichnet. Austausch nur hier nötig.
 */
export function Logo({ klein = false }: { klein?: boolean }) {
  const groesse = klein ? 28 : 36;
  return (
    <span className="flex items-center gap-3">
      <svg
        width={groesse}
        height={groesse}
        viewBox="0 0 36 36"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="36" height="36" rx="4" fill="#fff" />
        <path
          d="M13 2h10v11h11v10H23v11H13V23H2V13h11z"
          fill="var(--color-brk-500)"
        />
      </svg>
      <span className="leading-tight">
        <span
          className={`block font-bold tracking-tight text-tinte-900 ${
            klein ? "text-sm" : "text-base"
          }`}
        >
          Bayerisches Rotes Kreuz
        </span>
        <span className="block text-xs text-tinte-500">
          Kreisverband Miltenberg-Obernburg
        </span>
      </span>
    </span>
  );
}

export function Kopfzeile({ telefon }: { telefon: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-tinte-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="rounded-sm">
          <Logo />
        </Link>
        <a
          href={`tel:${telefon.replace(/[^+\d]/g, "")}`}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-tinte-600 transition hover:bg-tinte-100 hover:text-brk-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1z"
              fill="currentColor"
            />
          </svg>
          <span className="hidden sm:inline">Fragen? </span>
          {telefon}
        </a>
      </div>
    </header>
  );
}

export function Fusszeile({ impressumUrl }: { impressumUrl: string }) {
  return (
    <footer className="mt-16 border-t border-tinte-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-tinte-500 sm:flex-row sm:justify-between">
        <p>BRK-Kreisverband Miltenberg-Obernburg · Römerstraße 93 · 63785 Obernburg</p>
        <nav className="flex gap-4">
          <a href={impressumUrl} className="hover:text-brk-700">
            Impressum
          </a>
          <Link href="/datenschutz" className="hover:text-brk-700">
            Datenschutz
          </Link>
          <Link href="/agb" className="hover:text-brk-700">
            AGB
          </Link>
          <Link href="/widerruf" className="hover:text-brk-700">
            Widerrufsbelehrung
          </Link>
        </nav>
      </div>
    </footer>
  );
}

type KnopfProps = {
  children: ReactNode;
  art?: "haupt" | "neben" | "still";
  breit?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Knopf({
  children,
  art = "haupt",
  breit = false,
  className = "",
  ...rest
}: KnopfProps) {
  const basis =
    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const arten = {
    haupt: "bg-brk-600 text-white hover:bg-brk-700 shadow-sm",
    neben: "border border-tinte-300 bg-white text-tinte-700 hover:bg-tinte-100",
    still: "text-tinte-600 hover:bg-tinte-100",
  };
  return (
    <button
      {...rest}
      className={`${basis} ${arten[art]} ${breit ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Karte({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-tinte-200 bg-white p-5 shadow-xs sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function Abschnitt({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-tinte-900 sm:text-2xl">{titel}</h2>
      {hinweis && <p className="mt-1 mb-4 text-sm text-tinte-500">{hinweis}</p>}
      <div className={hinweis ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export function Hinweisbox({
  art = "info",
  children,
}: {
  art?: "info" | "warnung";
  children: ReactNode;
}) {
  const stile = {
    info: "border-tinte-200 bg-tinte-100 text-tinte-700",
    warnung: "border-brk-200 bg-brk-50 text-brk-900",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${stile[art]}`}>{children}</div>
  );
}
