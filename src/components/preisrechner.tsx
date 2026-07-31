"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  IMMER_ENTHALTEN,
  OptionId,
  PAKETE,
  PaketId,
  optionenFuerPaket,
} from "@/lib/katalog";
import { berechnePreis, euro } from "@/lib/preis";
import { Pflegegrad } from "@/lib/typen";

import { Knopf } from "./ui";

/**
 * Preisrechner der Startseite.
 *
 * Zeigt den Beitrag, bevor der Kunde persönliche Daten eingibt – das ist die
 * häufigste Frage und der häufigste Abbruchgrund, wenn sie unbeantwortet bleibt.
 */
export function Preisrechner() {
  const [pflegegrad, setPflegegrad] = useState<Pflegegrad>("ohne");
  const [vdk, setVdk] = useState(false);
  const [paketId, setPaketId] = useState<PaketId>("komfortpaket");
  const [optionen, setOptionen] = useState<OptionId[]>([]);

  const hatPflegegrad = pflegegrad !== "ohne";

  const verfuegbar = useMemo(
    () =>
      PAKETE.filter((p) =>
        hatPflegegrad ? p.monatlichMitKue !== null || p.monatlichOhneKue !== null : p.monatlichOhneKue !== null,
      ),
    [hatPflegegrad],
  );

  const paket = verfuegbar.find((p) => p.id === paketId) ?? verfuegbar[0];
  // Mit Pflegegrad gilt der ermäßigte Beitrag, sofern das Paket ihn kennt.
  const mitKue = hatPflegegrad && paket.monatlichMitKue !== null;

  const buchbareOptionen = optionenFuerPaket(paket.id);
  const gueltigeOptionen = optionen.filter((o) =>
    buchbareOptionen.some((b) => b.id === o && !b.immerEnthalten),
  );

  const preis = useMemo(
    () =>
      berechnePreis({
        paketId: paket.id,
        optionen: gueltigeOptionen,
        kostenuebernahme: mitKue,
        vdkMitglied: vdk,
      }),
    [paket.id, gueltigeOptionen, mitKue, vdk],
  );

  function schalteOption(id: OptionId) {
    setOptionen((alt) =>
      alt.includes(id) ? alt.filter((o) => o !== id) : [...alt, id],
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-tinte-700">
            1. Liegt ein Pflegegrad vor?
          </h3>
          <div className="flex flex-wrap gap-2">
            {(["ohne", "1", "2", "3", "4", "5"] as Pflegegrad[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setPflegegrad(g)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  pflegegrad === g
                    ? "border-brk-600 bg-brk-600 text-white"
                    : "border-tinte-300 bg-white text-tinte-700 hover:border-tinte-400"
                }`}
              >
                {g === "ohne" ? "Keiner" : `Pflegegrad ${g}`}
              </button>
            ))}
          </div>
          <p className="hinweis">
            Mit einem Pflegegrad übernimmt die Pflegekasse in der Regel einen Teil der
            Kosten. Die endgültige Entscheidung trifft die Kasse.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-tinte-700">2. Welches Paket?</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {verfuegbar.map((p) => {
              const betrag =
                hatPflegegrad && p.monatlichMitKue !== null
                  ? p.monatlichMitKue
                  : p.monatlichOhneKue;
              const gewaehlt = p.id === paket.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaketId(p.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    gewaehlt
                      ? "border-brk-600 bg-brk-50 ring-1 ring-brk-600"
                      : "border-tinte-200 bg-white hover:border-tinte-300"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-tinte-900">{p.name}</span>
                    <span className="shrink-0 text-sm font-bold text-brk-700">
                      {betrag === 0 ? "0 €" : `${euro(betrag ?? 0)}`}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-tinte-500">
                    {p.einsatzbereich}
                    {p.inklusivEinsaetze > 0 &&
                      ` · ${p.inklusivEinsaetze} Helfereinsätze inklusive`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {buchbareOptionen.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-tinte-700">
              3. Zusätzliche Leistungen
            </h3>
            <div className="space-y-2">
              {buchbareOptionen.map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    o.immerEnthalten
                      ? "border-tinte-200 bg-tinte-50"
                      : "border-tinte-200 bg-white hover:border-tinte-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={o.immerEnthalten || optionen.includes(o.id)}
                    disabled={o.immerEnthalten}
                    onChange={() => schalteOption(o.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brk-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-tinte-800">{o.name}</span>
                      <span className="shrink-0 text-sm text-tinte-600">
                        {o.immerEnthalten ? "enthalten" : `+ ${euro(o.monatlich)}/Monat`}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-tinte-500">{o.hinweis}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-tinte-200 bg-white p-3">
          <input
            type="checkbox"
            checked={vdk}
            onChange={(e) => setVdk(e.target.checked)}
            className="h-4 w-4 accent-brk-600"
          />
          <span className="text-sm text-tinte-700">
            Ich bin VdK-Mitglied
            <span className="ml-1 text-xs text-tinte-500">(7 % Rabatt)</span>
          </span>
        </label>
      </div>

      {/* Preisübersicht bleibt beim Scrollen sichtbar. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border border-tinte-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-tinte-500 uppercase">
            Ihr Beitrag
          </p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-tinte-900">
              {euro(preis.summe.monatlich)}
            </span>
            <span className="text-sm text-tinte-500">/ Monat</span>
          </p>
          {preis.summe.einmalig > 0 && (
            <p className="mt-1 text-sm text-tinte-600">
              einmalig {euro(preis.summe.einmalig)}
            </p>
          )}

          <dl className="mt-4 space-y-1.5 border-t border-tinte-200 pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-tinte-600">{preis.basis.bezeichnung}</dt>
              <dd className="shrink-0 font-medium">{euro(preis.basis.monatlich)}</dd>
            </div>
            {preis.zusatz.map((p) => (
              <div key={p.bezeichnung} className="flex justify-between gap-3">
                <dt className="text-tinte-600">{p.bezeichnung}</dt>
                <dd className="shrink-0 font-medium">
                  {p.monatlich > 0 ? euro(p.monatlich) : euro(p.einmalig)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-tinte-200 pt-2 text-tinte-900">
              <dt className="font-semibold">Erstes Jahr gesamt</dt>
              <dd className="shrink-0 font-semibold">{euro(preis.kostenErstesJahr)}</dd>
            </div>
          </dl>

          {vdk && preis.vdkRabattBetrag > 0 && (
            <p className="mt-3 rounded-md bg-brk-50 px-3 py-2 text-xs text-brk-900">
              VdK-Rabatt: Sie sparen {euro(preis.vdkRabattBetrag)} im ersten Jahr.
            </p>
          )}

          {mitKue && (
            <p className="mt-3 rounded-md bg-tinte-100 px-3 py-2 text-xs text-tinte-600">
              Ermäßigter Beitrag. Er gilt ab Bestätigung der Kostenübernahme durch die
              Pflegekasse; bis dahin gilt der reguläre Beitrag.
            </p>
          )}

          <p className="mt-3 text-xs text-tinte-500">
            {preis.inklusivEinsaetze > 0
              ? `${preis.inklusivEinsaetze} Helfereinsätze pro Jahr inklusive, jeder weitere ${euro(preis.einsatzpauschale)}.`
              : `Helfereinsätze werden mit ${euro(preis.einsatzpauschale)} je Einsatz berechnet.`}
          </p>

          <Knopf
            breit
            className="mt-5"
            onClick={() => {
              const parameter = new URLSearchParams({
                paket: paket.id,
                pflegegrad,
                ...(gueltigeOptionen.length ? { optionen: gueltigeOptionen.join(",") } : {}),
                ...(vdk ? { vdk: "1" } : {}),
              });
              window.location.href = `/bestellen?${parameter}`;
            }}
          >
            Jetzt bestellen
          </Knopf>
          <p className="mt-2 text-center text-xs text-tinte-500">
            Dauert etwa 10 Minuten. Sie können jederzeit unterbrechen.
          </p>
        </div>

        <ul className="mt-4 space-y-1.5 text-xs text-tinte-600">
          {IMMER_ENTHALTEN.map((eintrag) => (
            <li key={eintrag} className="flex gap-2">
              <span aria-hidden="true" className="text-brk-600">
                ✓
              </span>
              {eintrag}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-tinte-500">
          Lieber persönlich?{" "}
          <Link href="/#kontakt" className="underline underline-offset-2">
            Wir rufen Sie zurück
          </Link>
        </p>
      </aside>
    </div>
  );
}
