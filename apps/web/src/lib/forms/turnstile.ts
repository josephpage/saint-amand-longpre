/** Clé secrète de test Cloudflare : la vérification réussit toujours. */
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Vérifie le jeton Turnstile renvoyé par le navigateur.
 * Avec la clé de test, la réponse de Cloudflare est connue d'avance : on
 * évite l'appel réseau (tests et développement hors ligne).
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
  doFetch: typeof fetch = fetch,
): Promise<boolean> {
  if (secret === TURNSTILE_TEST_SECRET) return token.length > 0;
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  try {
    const res = await doFetch(VERIFY_URL, { method: 'POST', body });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
