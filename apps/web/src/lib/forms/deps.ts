import {
  BREVO_API_KEY,
  MAIL_DRY_RUN,
  MAIL_FROM,
  MAIL_TO,
  TURNSTILE_SECRET,
} from 'astro:env/server';
import type { FormDeps } from './handler.ts';

/**
 * Dépendances des formulaires lues dans l'environnement Cloudflare Pages.
 * Pages ne propose pas la liaison Rate Limiting : la protection repose sur
 * Turnstile (un défi par envoi) et le champ piège.
 */
export function formDeps(): FormDeps {
  return {
    ...(TURNSTILE_SECRET ? { turnstileSecret: TURNSTILE_SECRET } : {}),
    ...(MAIL_TO ? { mailTo: MAIL_TO } : {}),
    ...(BREVO_API_KEY ? { brevoApiKey: BREVO_API_KEY } : {}),
    mailFrom: MAIL_FROM,
    dryRun: MAIL_DRY_RUN,
    log: (message) => console.log(message),
  };
}
