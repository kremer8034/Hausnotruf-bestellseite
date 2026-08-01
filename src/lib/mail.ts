import "server-only";

import nodemailer from "nodemailer";

import { ladeSmtp, SmtpEinstellungen } from "./db";

export interface Anhang {
  dateiname: string;
  inhalt: Uint8Array | Buffer;
  typ?: string;
}

export interface MailAuftrag {
  an: string;
  betreff: string;
  text: string;
  html?: string;
  anhaenge?: Anhang[];
}

function transport(smtp: SmtpEinstellungen) {
  if (!smtp.host) {
    throw new Error(
      "Es ist kein SMTP-Zugang hinterlegt. Bitte im Backoffice unter Einstellungen eintragen.",
    );
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.sicher,
    auth: smtp.benutzer ? { user: smtp.benutzer, pass: smtp.passwort } : undefined,
  });
}

export async function sendeMail(auftrag: MailAuftrag): Promise<void> {
  const smtp = await ladeSmtp();
  await transport(smtp).sendMail({
    from: `"${smtp.absenderName}" <${smtp.absenderAdresse}>`,
    to: auftrag.an,
    subject: auftrag.betreff,
    text: auftrag.text,
    html: auftrag.html,
    attachments: auftrag.anhaenge?.map((a) => ({
      filename: a.dateiname,
      content: Buffer.from(a.inhalt),
      contentType: a.typ ?? "application/pdf",
    })),
  });
}

export async function pruefeSmtp(): Promise<void> {
  const smtp = await ladeSmtp();
  await transport(smtp).verify();
}

/**
 * Entschärft Text, der in eine HTML-Mail eingesetzt wird.
 *
 * Namen, Anschriften und Hinweise kommen aus einem offenen Formular. Ohne
 * diese Umwandlung könnte jemand über ein Eingabefeld eigenes Markup in die
 * Nachricht ans Backoffice schmuggeln – etwa einen Link, der wie unserer
 * aussieht, aber woanders hinführt. Die Absätze der Vorlage dürfen weiterhin
 * Markup enthalten; nur die eingesetzten Werte laufen durch diese Funktion.
 */
export function htmlText(wert: unknown): string {
  return String(wert ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Schlichtes HTML-Gerüst – E-Mail-Clients vertragen kein modernes CSS. */
export function mailVorlage(titel: string, absaetze: string[], fuss: string): string {
  const inhalt = absaetze
    .map(
      (a) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${a}</p>`,
    )
    .join("");
  return `<!doctype html><html lang="de"><body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:24px 28px 8px">
<div style="font-size:13px;font-weight:bold;color:#e60005;letter-spacing:.04em;text-transform:uppercase">Bayerisches Rotes Kreuz</div>
<h1 style="margin:6px 0 18px;font-size:20px;color:#0f172a">${htmlText(titel)}</h1>
${inhalt}
</td></tr>
<tr><td style="padding:8px 28px 24px;border-top:1px solid #e2e8f0">
<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b">${htmlText(fuss)}</p>
</td></tr></table></td></tr></table></body></html>`;
}
