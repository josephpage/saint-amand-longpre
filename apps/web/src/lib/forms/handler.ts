import type { z } from 'zod';
import { sendMail, type MailAttachment } from './mailer.ts';
import { contactSchema, fieldErrors, reportSchema, validatePhoto } from './schemas.ts';
import { verifyTurnstile } from './turnstile.ts';

export interface FormDeps {
  turnstileSecret?: string;
  mailTo?: string;
  mailFrom: string;
  brevoApiKey?: string;
  dryRun: boolean;
  /** Retourne false quand l'expéditeur a dépassé la limite d'envois. */
  rateLimit?: (key: string) => Promise<boolean>;
  fetch?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
}

const PHONE = '02 54 82 83 74';
const UNAVAILABLE = `Le formulaire est momentanément indisponible. Appelez la mairie au ${PHONE}.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

function formToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') out[key] = value;
  }
  out.consent = form.get('consent') === 'on' || form.get('consent') === 'true';
  out.turnstileToken = form.get('cf-turnstile-response') ?? form.get('turnstileToken') ?? '';
  return out;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const stamp = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(d);

interface Prepared<T> {
  data: T;
  ip: string | null;
}

/** Contrôles communs : format, anti-robot, limite d'envois, configuration. */
async function prepare<T>(
  request: Request,
  schema: z.ZodType<T>,
  deps: FormDeps,
): Promise<{ response: Response } | ({ response?: undefined; form: FormData } & Prepared<T>)> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { response: json(400, { ok: false, message: 'Requête invalide.' }) };
  }
  const parsed = schema.safeParse(formToObject(form));
  if (!parsed.success)
    return { response: json(422, { ok: false, errors: fieldErrors(parsed.error) }) };

  const ip = request.headers.get('cf-connecting-ip');
  if (deps.rateLimit && !(await deps.rateLimit(ip ?? 'inconnu'))) {
    return {
      response: json(429, {
        ok: false,
        message: `Trop d’envois en peu de temps. Réessayez dans une minute ou appelez le ${PHONE}.`,
      }),
    };
  }
  if (!deps.turnstileSecret || (!deps.dryRun && !deps.mailTo)) {
    deps.log?.('Formulaire : configuration incomplète (TURNSTILE_SECRET ou MAIL_TO).');
    return { response: json(503, { ok: false, message: UNAVAILABLE }) };
  }
  const token = (parsed.data as { turnstileToken: string }).turnstileToken;
  if (!(await verifyTurnstile(token, deps.turnstileSecret, ip, deps.fetch))) {
    return {
      response: json(422, {
        ok: false,
        errors: {
          turnstileToken: 'La vérification anti-robot a échoué. Rechargez la page et réessayez.',
        },
      }),
    };
  }
  return { data: parsed.data, ip, form };
}

async function deliver(
  deps: FormDeps,
  mail: {
    subject: string;
    text: string;
    replyTo: { email: string; name: string };
    attachments?: MailAttachment[];
  },
): Promise<Response> {
  try {
    await sendMail(
      {
        ...mail,
        to: deps.mailTo ?? 'mairie@example.test',
        from: deps.mailFrom,
        fromName: 'Site de la mairie',
      },
      { apiKey: deps.brevoApiKey, dryRun: deps.dryRun, fetch: deps.fetch, log: deps.log },
    );
  } catch (error) {
    deps.log?.(
      `Formulaire : échec de l'envoi — ${error instanceof Error ? error.message : String(error)}`,
    );
    return json(502, { ok: false, message: UNAVAILABLE });
  }
  return json(200, { ok: true });
}

export async function handleContact(request: Request, deps: FormDeps): Promise<Response> {
  const prepared = await prepare(request, contactSchema, deps);
  if (prepared.response) return prepared.response;
  const d = prepared.data;
  const text = [
    'Nouveau message reçu depuis le formulaire de contact du site.',
    '',
    `Objet : ${d.subject}`,
    `Nom : ${d.name}`,
    `E-mail : ${d.email}`,
    `Téléphone : ${d.phone || 'non renseigné'}`,
    '',
    'Message :',
    d.message,
    '',
    `— Envoyé le ${stamp(deps.now?.() ?? new Date())}. Répondez directement à ce message pour écrire à l'expéditeur.`,
  ].join('\n');
  return deliver(deps, {
    subject: `[Site] ${d.subject} — ${d.name}`,
    text,
    replyTo: { email: d.email, name: d.name },
  });
}

export async function handleReport(request: Request, deps: FormDeps): Promise<Response> {
  const prepared = await prepare(request, reportSchema, deps);
  if (prepared.response) return prepared.response;
  const d = prepared.data;
  const photo = prepared.form.get('photo');
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  const photoError = validatePhoto(file);
  if (photoError) return json(422, { ok: false, errors: { photo: photoError } });

  const attachments: MailAttachment[] = file
    ? [
        {
          name: file.name.replace(/[^\w.-]+/g, '_') || 'photo.jpg',
          content: toBase64(await file.arrayBuffer()),
        },
      ]
    : [];
  const text = [
    'Nouveau signalement reçu depuis le site.',
    '',
    `Type : ${d.category}`,
    `Lieu : ${d.location}`,
    '',
    'Description :',
    d.description,
    '',
    `Signalé par : ${d.name} (${d.email}${d.phone ? `, ${d.phone}` : ''})`,
    file ? 'Une photo est jointe à ce message.' : 'Aucune photo jointe.',
    '',
    `— Envoyé le ${stamp(deps.now?.() ?? new Date())}.`,
  ].join('\n');
  return deliver(deps, {
    subject: `[Signalement] ${d.category} — ${d.location}`,
    text,
    replyTo: { email: d.email, name: d.name },
    attachments,
  });
}
