import Link from "next/link";

import { Preisrechner } from "@/components/preisrechner";
import { Fusszeile, Karte, Knopf, Kopfzeile } from "@/components/ui";
import { ladeStammdatenSicher } from "@/lib/db";

export default async function Startseite() {
  const stammdaten = await ladeStammdatenSicher();

  return (
    <>
      <Kopfzeile telefon={stammdaten.telefon} />

      <main>
        <section className="border-b border-tinte-200 bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-wide text-brk-600 uppercase">
                Hausnotruf und Mobilruf
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-tinte-900 sm:text-4xl">
                Hilfe auf Knopfdruck — rund um die Uhr
              </h1>
              <p className="mt-4 text-lg text-tinte-600">
                Ein Knopfdruck genügt, und unsere Notrufzentrale meldet sich. Wir schicken
                Hilfe, verständigen Angehörige und kommen im Bedarfsfall selbst vorbei.
              </p>
              <p className="mt-4 text-tinte-600">
                Den Vertrag schließen Sie hier direkt online ab — ohne Hausbesuch, ohne
                Papierkram. Wir kommen erst zum Aufbau des Geräts zu Ihnen.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/bestellen">
                  <Knopf>Vertrag online abschließen</Knopf>
                </Link>
                <Link href="#rechner">
                  <Knopf art="neben">Preis berechnen</Knopf>
                </Link>
              </div>
            </div>

            <Karte className="bg-tinte-50">
              <h2 className="text-base font-semibold text-tinte-900">
                So läuft es ab
              </h2>
              <ol className="mt-4 space-y-4">
                {[
                  ["Online bestellen", "Sie füllen das Formular aus und unterschreiben digital. Etwa zehn Minuten."],
                  ["Vertrag per E-Mail", "Sie erhalten den vollständigen Vertrag sofort als PDF."],
                  ["Termin vor Ort", "Wir melden uns und vereinbaren die Installation."],
                  ["Aufbau und Einweisung", "Unser Techniker richtet alles ein und erklärt die Bedienung."],
                ].map(([titel, text], i) => (
                  <li key={titel} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brk-600 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-tinte-800">
                        {titel}
                      </span>
                      <span className="block text-sm text-tinte-600">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Karte>
          </div>
        </section>

        <section id="rechner" className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight text-tinte-900">
            Was kostet mich das?
          </h2>
          <p className="mt-1 mb-8 text-tinte-600">
            Stellen Sie sich Ihr Paket zusammen — der Beitrag wird sofort berechnet.
          </p>
          <Preisrechner />
        </section>

        <section id="kontakt" className="border-t border-tinte-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-2xl font-bold tracking-tight text-tinte-900">
              Sie haben Fragen?
            </h2>
            <p className="mt-2 max-w-2xl text-tinte-600">
              {stammdaten.hausnotrufbeauftragter.split(",")[0]} berät Sie gern
              persönlich — auch dazu, welches Paket zu Ihrer Situation passt und was die
              Pflegekasse übernimmt.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <a href={`tel:${stammdaten.telefon.replace(/[^+\d]/g, "")}`}>
                <Knopf art="neben">{stammdaten.telefon}</Knopf>
              </a>
              <a
                href={`mailto:${stammdaten.email}`}
                className="text-sm text-tinte-600 underline underline-offset-2 hover:text-brk-700"
              >
                {stammdaten.email}
              </a>
            </div>
          </div>
        </section>
      </main>

      <Fusszeile impressumUrl={stammdaten.impressumUrl} />
    </>
  );
}
