/**
 * Rollen der Backoffice-Zugänge.
 *
 * Bewusst ohne "server-only": Die Benutzerverwaltung im Browser braucht die
 * Bezeichnungen ebenfalls.
 */
export type Rolle = "admin" | "mitarbeiter" | "techniker";

export const ROLLEN: { wert: Rolle; text: string; beschreibung: string }[] = [
  {
    wert: "admin",
    text: "Administrator",
    beschreibung: "Verträge, Installationen, Einstellungen und Benutzerverwaltung.",
  },
  {
    wert: "mitarbeiter",
    text: "Mitarbeiter",
    beschreibung: "Verträge einsehen und bearbeiten, Installationen einsehen.",
  },
  {
    wert: "techniker",
    text: "Techniker",
    beschreibung: "Nur die Terminübersicht und die Erfassung vor Ort.",
  },
];

export function rollenName(rolle: Rolle): string {
  return ROLLEN.find((r) => r.wert === rolle)?.text ?? rolle;
}

export function istRolle(wert: unknown): wert is Rolle {
  return wert === "admin" || wert === "mitarbeiter" || wert === "techniker";
}
