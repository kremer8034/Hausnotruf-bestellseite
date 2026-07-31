"use client";

import { useState } from "react";

import { STATUS_LABEL, VERTRAGS_STATUS, VertragsStatus } from "@/lib/typen";

export function StatusWechsler({
  id,
  status,
}: {
  id: string;
  status: VertragsStatus;
}) {
  const [wert, setWert] = useState(status);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState(false);

  async function aendern(neu: VertragsStatus) {
    const vorher = wert;
    setWert(neu);
    setLaeuft(true);
    setFehler(false);
    try {
      const antwort = await fetch(`/api/vertrag/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: neu }),
      });
      if (!antwort.ok) throw new Error();
    } catch {
      setWert(vorher);
      setFehler(true);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={wert}
        disabled={laeuft}
        onChange={(e) => aendern(e.target.value as VertragsStatus)}
        className="feld w-auto py-2 text-sm"
        aria-label="Status des Vertrags"
      >
        {VERTRAGS_STATUS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {fehler && (
        <span className="text-xs text-brk-700">Konnte nicht gespeichert werden.</span>
      )}
    </span>
  );
}
