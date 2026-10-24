export type EmailResult = { ok: true } | { ok: false; message: string };

const FALLBACK = "We couldn't send the email. Try again, or download the PDF.";

/** Sends the finished report PDF to the server, which emails it. Nothing is kept. */
export async function emailReport(email: string, pdf: Blob): Promise<EmailResult> {
  const body = new FormData();
  body.append("email", email.trim());
  body.append("file", pdf, "disclosure-report.pdf");
  try {
    const res = await fetch("/api/email-report", { method: "POST", body });
    if (res.ok) return { ok: true };
    const detail = ((await res.json().catch(() => null)) as { detail?: unknown } | null)?.detail;
    return { ok: false, message: typeof detail === "string" ? detail : FALLBACK };
  } catch {
    return { ok: false, message: FALLBACK };
  }
}
