import { env } from 'cloudflare:workers';
import {
  BREVO_API_KEY,
  MAIL_DRY_RUN,
  MAIL_FROM,
  MAIL_TO,
  TURNSTILE_SECRET,
} from 'astro:env/server';
import type { FormDeps } from './handler.ts';

interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

/** Dépendances des formulaires lues dans l'environnement du Worker Cloudflare. */
export function formDeps(): FormDeps {
  const limiter = (env as { FORMS_RATE_LIMITER?: RateLimiter }).FORMS_RATE_LIMITER;
  return {
    ...(TURNSTILE_SECRET ? { turnstileSecret: TURNSTILE_SECRET } : {}),
    ...(MAIL_TO ? { mailTo: MAIL_TO } : {}),
    ...(BREVO_API_KEY ? { brevoApiKey: BREVO_API_KEY } : {}),
    mailFrom: MAIL_FROM,
    dryRun: MAIL_DRY_RUN,
    ...(limiter
      ? { rateLimit: async (key: string) => (await limiter.limit({ key })).success }
      : {}),
    log: (message) => console.log(message),
  };
}
