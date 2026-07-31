import { STATUS_LABEL, VertragsStatus } from "@/lib/typen";

/** Farbige Kennzeichnung des Bearbeitungsstands eines Vertrags. */
export function StatusZeichen({ status }: { status: VertragsStatus }) {
  const farben: Record<VertragsStatus, string> = {
    neu: "bg-brk-50 text-brk-700",
    kasse_beantragt: "bg-amber-50 text-amber-700",
    kasse_genehmigt: "bg-sky-50 text-sky-700",
    installiert: "bg-emerald-50 text-emerald-700",
    gekuendigt: "bg-tinte-100 text-tinte-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${farben[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
