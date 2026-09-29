import { describe, expect, it, vi } from 'vitest';
import { handleContact, handleReport, type FormDeps } from './handler.ts';
import { TURNSTILE_TEST_SECRET } from './turnstile.ts';

const validContact = {
  name: 'Camille Martin',
  email: 'camille@example.fr',
  phone: '06 12 34 56 78',
  subject: 'Location de salle',
  message: 'Bonjour, la salle des fêtes est-elle libre le 12 décembre ?',
  consent: 'on',
  'cf-turnstile-response': 'jeton',
  website: '',
};

function request(fields: Record<string, string | File>, ip = '203.0.113.1'): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request('https://www.saintamandlongpre.fr/api/contact/', {
    method: 'POST',
    body: form,
    headers: { 'cf-connecting-ip': ip },
  });
}

function deps(overrides: Partial<FormDeps> = {}): FormDeps & { fetch: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async () => new Response('{"messageId":"1"}', { status: 201 }));
  return {
    turnstileSecret: TURNSTILE_TEST_SECRET,
    mailTo: 'mairie@saintamandlongpre.fr',
    mailFrom: 'site@saintamandlongpre.fr',
    brevoApiKey: 'cle',
    dryRun: false,
    fetch: fetchMock,
    now: () => new Date('2026-09-28T10:00:00Z'),
    log: () => {},
    ...overrides,
  } as FormDeps & { fetch: ReturnType<typeof vi.fn> };
}

describe('formulaire de contact', () => {
  it('envoie le message à la mairie via Brevo, avec réponse à l’expéditeur', async () => {
    const d = deps();
    const res = await handleContact(request(validContact), d);
    expect(res.status).toBe(200);
    expect(d.fetch).toHaveBeenCalledOnce();
    const [url, init] = d.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual([{ email: 'mairie@saintamandlongpre.fr' }]);
    expect(body.replyTo).toEqual({ email: 'camille@example.fr', name: 'Camille Martin' });
    expect(body.subject).toBe('[Site] Location de salle — Camille Martin');
    expect(body.textContent).toContain('la salle des fêtes est-elle libre');
  });

  it('renvoie les erreurs par champ', async () => {
    const res = await handleContact(
      request({ ...validContact, email: 'pas-un-mail', message: 'court', consent: '' }),
      deps(),
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(Object.keys(json.errors)).toEqual(
      expect.arrayContaining(['email', 'message', 'consent']),
    );
  });

  it('rejette les robots qui remplissent le champ piège', async () => {
    const res = await handleContact(request({ ...validContact, website: 'http://spam' }), deps());
    expect(res.status).toBe(422);
  });

  it('applique la limite d’envois', async () => {
    const res = await handleContact(request(validContact), deps({ rateLimit: async () => false }));
    expect(res.status).toBe(429);
  });

  it('refuse l’envoi si la vérification Turnstile échoue', async () => {
    const d = deps({ turnstileSecret: 'vrai-secret' });
    d.fetch.mockResolvedValueOnce(new Response('{"success":false}'));
    const res = await handleContact(request(validContact), d);
    expect(res.status).toBe(422);
    expect((await res.json()).errors.turnstileToken).toBeDefined();
  });

  it('simule l’envoi en mode test sans appeler Brevo', async () => {
    const log = vi.fn();
    const d = deps({ dryRun: true, mailTo: undefined, brevoApiKey: undefined, log });
    const res = await handleContact(request(validContact), d);
    expect(res.status).toBe(200);
    expect(d.fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[e-mail simulé]'));
  });

  it('indique un numéro de repli quand la configuration manque', async () => {
    const res = await handleContact(request(validContact), deps({ mailTo: undefined }));
    expect(res.status).toBe(503);
    expect((await res.json()).message).toContain('02 54 82 83 74');
  });

  it('signale une panne de Brevo sans exposer le détail', async () => {
    const d = deps();
    d.fetch.mockResolvedValueOnce(new Response('quota', { status: 400 }));
    const res = await handleContact(request(validContact), d);
    expect(res.status).toBe(502);
    expect((await res.json()).message).not.toContain('quota');
  });
});

describe('signalement', () => {
  const validReport = {
    name: 'Camille Martin',
    email: 'camille@example.fr',
    category: 'Éclairage public',
    location: 'Devant le 12 rue Jules Ferry',
    description: 'Le lampadaire ne s’allume plus depuis trois jours.',
    consent: 'on',
    'cf-turnstile-response': 'jeton',
  };

  it('joint la photo au message', async () => {
    const d = deps();
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], 'lampadaire.jpg', {
      type: 'image/jpeg',
    });
    const res = await handleReport(request({ ...validReport, photo }), d);
    expect(res.status).toBe(200);
    const body = JSON.parse((d.fetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.subject).toBe('[Signalement] Éclairage public — Devant le 12 rue Jules Ferry');
    expect(body.attachment).toEqual([
      { name: 'lampadaire.jpg', content: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 1, 2, 3)) },
    ]);
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    const res = await handleReport(request({ ...validReport, photo: pdf }), deps());
    expect(res.status).toBe(422);
    expect((await res.json()).errors.photo).toContain('formats acceptés');
  });

  it('fonctionne sans photo', async () => {
    const res = await handleReport(request(validReport), deps());
    expect(res.status).toBe(200);
  });
});

describe('messages d’erreur', () => {
  it('sont en français même quand un champ est absent', async () => {
    const res = await handleContact(request({ name: 'x' }), deps());
    const { errors } = (await res.json()) as { errors: Record<string, string> };
    expect(errors.message).toBe('Message : ce champ est obligatoire.');
    expect(errors.email).toBe('E-mail : ce champ est obligatoire.');
    expect(Object.values(errors).every((m) => !/invalid|expected/i.test(m))).toBe(true);
  });
});
