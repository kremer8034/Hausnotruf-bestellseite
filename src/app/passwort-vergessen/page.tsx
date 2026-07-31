import { PasswortVergessenFormular } from "@/components/passwortformulare";
import { Logo } from "@/components/ui";

export const metadata = {
  title: "Passwort vergessen – BRK Hausnotruf",
  robots: { index: false, follow: false },
};

export default function PasswortVergessen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-tinte-200 bg-white p-6 shadow-xs">
          <h1 className="mb-4 text-lg font-bold text-tinte-900">Passwort vergessen</h1>
          <PasswortVergessenFormular />
        </div>
      </div>
    </main>
  );
}
