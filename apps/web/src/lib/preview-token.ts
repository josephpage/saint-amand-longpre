/**
 * Liens de prévisualisation signés par WordPress (voir sal-headless.php) :
 * sig = HMAC-SHA256(secret, "type:id:expiration"), en hexadécimal.
 */

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison à temps constant pour ne pas divulguer la signature attendue. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPreview(
  secret: string,
  type: string,
  id: number,
  expires: number,
): Promise<string> {
  return hmacHex(secret, `${type}:${id}:${expires}`);
}

export type PreviewCheck =
  | { ok: true; type: string; id: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'signature' };

export async function verifyPreview(
  params: URLSearchParams,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<PreviewCheck> {
  const type = params.get('type') ?? '';
  const id = Number(params.get('id'));
  const expires = Number(params.get('exp'));
  const sig = params.get('sig') ?? '';
  if (
    !/^[a-z_]+$/.test(type) ||
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(expires) ||
    !sig
  ) {
    return { ok: false, reason: 'invalid' };
  }
  if (expires < nowSeconds) return { ok: false, reason: 'expired' };
  const expected = await signPreview(secret, type, id, expires);
  if (!safeEqual(expected, sig.toLowerCase())) return { ok: false, reason: 'signature' };
  return { ok: true, type, id };
}
