import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Clé de site Turnstile de test : le contrôle réussit toujours, sans widget. */
const TEST_SITE_KEY = '1x00000000000000000000AA';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | undefined;
function loadTurnstile(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile indisponible'));
    document.head.append(script);
  });
  return scriptPromise;
}

/** Vérification anti-robot Cloudflare Turnstile (sans cookie). */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (siteKey === TEST_SITE_KEY) {
      onToken('jeton-de-test');
      return;
    }
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          language: 'fr',
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => setFailed(true),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [siteKey, onToken]);

  if (siteKey === TEST_SITE_KEY) {
    return <p className="text-sm text-muted">Vérification anti-robot en mode test.</p>;
  }
  return (
    <div>
      <div ref={ref} />
      {failed && (
        <p className="mt-2 text-sm text-urgence">
          La vérification anti-robot n’a pas pu se charger. Désactivez le bloqueur de contenu pour
          ce site ou appelez la mairie.
        </p>
      )}
    </div>
  );
}

interface FieldProps {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
    name: string;
    required?: boolean;
  }) => ReactNode;
}

/** Champ de formulaire avec libellé, aide et message d'erreur reliés. */
export function Field({ name, label, error, hint, required = false, children }: FieldProps) {
  const id = `champ-${name}`;
  const hintId = useId();
  const errorId = `${id}-erreur`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-bold">
        {label}
        {required ? (
          <span className="text-terracotta-text"> (obligatoire)</span>
        ) : (
          <span className="font-normal text-muted"> (facultatif)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children({
        id,
        name,
        required,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {error && (
        <p id={errorId} className="text-sm font-bold text-urgence">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border-2 border-trait bg-white px-3 py-2.5 text-base text-encre focus:border-terracotta focus:outline-none aria-[invalid=true]:border-urgence';

/** Récapitulatif des erreurs, placé en tête du formulaire et focalisé à l'envoi. */
export function ErrorSummary({
  errors,
  labels,
}: {
  errors: Record<string, string>;
  labels: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors);
  useEffect(() => {
    if (entries.length) ref.current?.focus();
  }, [entries.length, errors]);
  if (entries.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-card border-2 border-urgence bg-urgence-soft p-4 focus:outline-none"
    >
      <p className="font-bold">
        {entries.length === 1
          ? 'Une information est à corriger :'
          : `${entries.length} informations sont à corriger :`}
      </p>
      <ul className="mt-2 list-disc pl-5">
        {entries.map(([field, message]) => (
          <li key={field}>
            {labels[field] ? (
              <a href={`#champ-${field}`} className="text-encre">
                {message}
              </a>
            ) : (
              message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type SubmitState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'failed'; message: string };

/** Envoie le formulaire à l'API et normalise la réponse. */
export async function submitForm(
  url: string,
  data: FormData,
): Promise<{ ok: true } | { ok: false; errors?: Record<string, string>; message?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: data,
      headers: { accept: 'application/json' },
    });
    const json = (await res.json()) as {
      ok: boolean;
      errors?: Record<string, string>;
      message?: string;
    };
    if (json.ok) return { ok: true };
    return {
      ok: false,
      ...(json.errors ? { errors: json.errors } : {}),
      ...(json.message ? { message: json.message } : {}),
    };
  } catch {
    return {
      ok: false,
      message: 'La connexion a échoué. Vérifiez votre accès à internet et réessayez.',
    };
  }
}
