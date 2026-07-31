"use client";

export function Abmelden() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/anmelden", { method: "DELETE" });
        window.location.href = "/anmelden";
      }}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-tinte-600 transition hover:bg-tinte-100 hover:text-brk-700"
    >
      Abmelden
    </button>
  );
}
