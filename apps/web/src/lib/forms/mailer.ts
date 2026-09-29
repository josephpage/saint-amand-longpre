export interface MailAttachment {
  name: string;
  /** Contenu encodé en base64. */
  content: string;
}

export interface Mail {
  to: string;
  from: string;
  fromName: string;
  replyTo: { email: string; name: string };
  subject: string;
  text: string;
  attachments?: MailAttachment[];
}

export interface MailerOptions {
  apiKey?: string;
  /** N'envoie rien, écrit le message dans les journaux (développement, tests). */
  dryRun?: boolean;
  fetch?: typeof fetch;
  log?: (message: string) => void;
}

class MailError extends Error {}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Envoie un e-mail transactionnel via l'API Brevo. */
export async function sendMail(
  mail: Mail,
  { apiKey, dryRun, fetch: doFetch = fetch, log = console.log }: MailerOptions,
) {
  if (dryRun) {
    log(`[e-mail simulé] À : ${mail.to} · Objet : ${mail.subject}\n${mail.text}`);
    return;
  }
  if (!apiKey) throw new MailError('Clé API Brevo manquante (BREVO_API_KEY).');
  const res = await doFetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: mail.from, name: mail.fromName },
      to: [{ email: mail.to }],
      replyTo: mail.replyTo,
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: `<pre style="font:15px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(mail.text)}</pre>`,
      ...(mail.attachments?.length ? { attachment: mail.attachments } : {}),
    }),
  });
  if (!res.ok) throw new MailError(`Brevo a refusé l'envoi (${res.status}) : ${await res.text()}`);
}
