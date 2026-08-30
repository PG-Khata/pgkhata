import { Resend } from "resend";

const DEFAULT_FROM = "PGKhata <no-reply@pgkhata.com>";

let client: Resend | undefined;

/**
 * Lazily constructed so importing a template does not require RESEND_API_KEY.
 * `packages/auth` imports this module at module scope; eager construction made
 * the whole auth package unloadable without mail credentials.
 */
function resend(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    client = new Resend(apiKey);
  }
  return client;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const { data, error } = await resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}
