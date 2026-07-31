"use client";

import { ReactNode, useId } from "react";

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
