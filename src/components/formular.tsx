"use client";

import { ReactNode, useEffect, useId, useState } from "react";

interface Basis {
  etikett: string;
  hinweis?: string;
  fehler?: string;
  pflicht?: boolean;
}

function Rahmen({
  etikett,
  hinweis,
  fehler,
  pflicht,
  id,
  children,
}: Basis & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="etikett">
        {etikett}
        {pflicht && <span className="ml-0.5 text-brk-600">*</span>}
      </label>
      {children}
      {fehler ? (
        <p className="fehlertext">{fehler}</p>
      ) : hinweis ? (
        <p className="hinweis">{hinweis}</p>
      ) : null}
    </div>
  );
}

export function Textfeld({
  etikett,
  hinweis,
  fehler,
  pflicht,
  ...rest
}: Basis & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Rahmen etikett={etikett} hinweis={hinweis} fehler={fehler} pflicht={pflicht} id={id}>
      <input
        id={id}
        {...rest}
        aria-invalid={Boolean(fehler)}
        className={`feld ${fehler ? "feld-fehler" : ""}`}
      />
    </Rahmen>
  );
}

export function Textbereich({
  etikett,
  hinweis,
  fehler,
  pflicht,
  ...rest
}: Basis & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Rahmen etikett={etikett} hinweis={hinweis} fehler={fehler} pflicht={pflicht} id={id}>
      <textarea
        id={id}
        rows={3}
        {...rest}
        aria-invalid={Boolean(fehler)}
        className={`feld resize-y ${fehler ? "feld-fehler" : ""}`}
      />
    </Rahmen>
  );
}

/** Wandelt TT.MM.JJJJ in das ISO-Format um, das ein Datumsfeld erwartet. */
export function zuIsoDatum(deutsch: string): string {
  const treffer = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((deutsch ?? "").trim());
  return treffer ? `${treffer[3]}-${treffer[2]}-${treffer[1]}` : "";
}

/** Wandelt das ISO-Format des Datumsfelds zurück nach TT.MM.JJJJ. */
export function vonIsoDatum(iso: string): string {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return treffer ? `${treffer[3]}.${treffer[2]}.${treffer[1]}` : "";
}

function heuteIso(): string {
  const d = new Date();
  const zweistellig = (n: number) => String(n).padStart(2, "0");
  // Bewusst lokal statt über toISOString: sonst springt der Wert kurz vor
  // Mitternacht auf den Vortag.
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}

/**
 * Datumsfeld mit Kalenderauswahl.
 *
 * Nutzt das native Datumsfeld des Browsers: auf dem Handy erscheint die
 * gewohnte Auswahl, am Rechner ein Kalender neben dem Feld. Tippen bleibt
 * möglich. Nach außen wird weiterhin TT.MM.JJJJ gereicht, weil der Vertrag
 * dieses Format erwartet.
 */
export function Datumsfeld({
  etikett,
  hinweis,
  fehler,
  pflicht,
  wert,
  onAendern,
  ab,
  hoechstensHeute = false,
  ...rest
}: Basis & {
  wert: string;
  onAendern: (wert: string) => void;
  /** Frühestes wählbares Datum im ISO-Format. */
  ab?: string;
  /** Begrenzt die Auswahl auf heute – etwa für ein Geburtsdatum. */
  hoechstensHeute?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const id = useId();
  const [bis, setBis] = useState<string | undefined>(undefined);

  // Erst nach dem Einhängen setzen, sonst weichen Server- und Browserfassung
  // voneinander ab, sobald sich das Datum ändert.
  useEffect(() => {
    if (hoechstensHeute) setBis(heuteIso());
  }, [hoechstensHeute]);

  return (
    <Rahmen etikett={etikett} hinweis={hinweis} fehler={fehler} pflicht={pflicht} id={id}>
      <input
        id={id}
        type="date"
        {...rest}
        min={ab}
        max={bis}
        value={zuIsoDatum(wert)}
        onChange={(e) => onAendern(vonIsoDatum(e.target.value))}
        aria-invalid={Boolean(fehler)}
        className={`feld ${fehler ? "feld-fehler" : ""}`}
      />
    </Rahmen>
  );
}

export function Auswahlfeld({
  etikett,
  hinweis,
  fehler,
  pflicht,
  optionen,
  platzhalter,
  ...rest
}: Basis & {
  optionen: { wert: string; text: string }[];
  platzhalter?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Rahmen etikett={etikett} hinweis={hinweis} fehler={fehler} pflicht={pflicht} id={id}>
      <select
        id={id}
        {...rest}
        aria-invalid={Boolean(fehler)}
        className={`feld ${fehler ? "feld-fehler" : ""}`}
      >
        {platzhalter && <option value="">{platzhalter}</option>}
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </Rahmen>
  );
}

export function Kontrollkaestchen({
  etikett,
  hinweis,
  fehler,
  ...rest
}: { etikett: ReactNode; hinweis?: string; fehler?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          {...rest}
          aria-invalid={Boolean(fehler)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-tinte-300 text-brk-600 accent-brk-600"
        />
        <label htmlFor={id} className="cursor-pointer text-sm text-tinte-700">
          {etikett}
        </label>
      </div>
      {fehler ? (
        <p className="fehlertext ml-8">{fehler}</p>
      ) : hinweis ? (
        <p className="hinweis ml-8">{hinweis}</p>
      ) : null}
    </div>
  );
}

export function Wahlgruppe<T extends string>({
  etikett,
  hinweis,
  fehler,
  optionen,
  wert,
  onAendern,
  spalten = 1,
}: Basis & {
  optionen: { wert: T; text: string; beschreibung?: string }[];
  wert: T | null;
  onAendern: (wert: T) => void;
  spalten?: 1 | 2;
}) {
  return (
    <fieldset>
      <legend className="etikett">{etikett}</legend>
      <div className={`grid gap-2 ${spalten === 2 ? "sm:grid-cols-2" : ""}`}>
        {optionen.map((o) => {
          const gewaehlt = wert === o.wert;
          return (
            <label
              key={o.wert}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                gewaehlt
                  ? "border-brk-600 bg-brk-50 ring-1 ring-brk-600"
                  : "border-tinte-200 bg-white hover:border-tinte-300"
              }`}
            >
              <input
                type="radio"
                checked={gewaehlt}
                onChange={() => onAendern(o.wert)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brk-600"
              />
              <span>
                <span className="block text-sm font-medium text-tinte-800">{o.text}</span>
                {o.beschreibung && (
                  <span className="mt-0.5 block text-xs text-tinte-500">
                    {o.beschreibung}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {fehler ? <p className="fehlertext">{fehler}</p> : hinweis ? <p className="hinweis">{hinweis}</p> : null}
    </fieldset>
  );
}

export function Fortschritt({
  schritt,
  gesamt,
  titel,
}: {
  schritt: number;
  gesamt: number;
  titel: string;
}) {
  const anteil = Math.round((schritt / gesamt) * 100);
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-tinte-700">{titel}</p>
        <p className="text-xs text-tinte-500">
          Schritt {schritt} von {gesamt}
        </p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-tinte-200"
        role="progressbar"
        aria-valuenow={anteil}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Fortschritt der Bestellung"
      >
        <div
          className="h-full rounded-full bg-brk-600 transition-all duration-300"
          style={{ width: `${anteil}%` }}
        />
      </div>
    </div>
  );
}
