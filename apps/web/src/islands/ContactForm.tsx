import { useCallback, useRef, useState, type SubmitEvent } from 'react';
import { CONTACT_SUBJECTS, contactSchema, fieldErrors } from '~/lib/forms/schemas.ts';
import {
  ErrorSummary,
  Field,
  inputClass,
  submitForm,
  Turnstile,
  type SubmitState,
} from './form-kit.tsx';

const LABELS: Record<string, string> = {
  name: 'Nom et prénom',
  email: 'E-mail',
  phone: 'Téléphone',
  subject: 'Objet',
  message: 'Message',
  consent: 'Consentement',
};

export default function ContactForm({ siteKey, phone }: { siteKey: string; phone: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [token, setToken] = useState('');
  const doneRef = useRef<HTMLDivElement>(null);
  const onToken = useCallback((t: string) => setToken(t), []);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = contactSchema.safeParse({
      ...Object.fromEntries(data.entries()),
      consent: data.get('consent') === 'on',
      turnstileToken: token,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setState({ status: 'sending' });
    data.set('turnstileToken', token);
    const result = await submitForm('/api/contact/', data);
    if (result.ok) {
      setState({ status: 'sent' });
      requestAnimationFrame(() => doneRef.current?.focus());
    } else {
      setErrors(result.errors ?? {});
      setState(result.message ? { status: 'failed', message: result.message } : { status: 'idle' });
    }
  }

  if (state.status === 'sent') {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        role="status"
        className="card grid gap-2 p-6 focus:outline-none"
      >
        <h2 className="text-2xl">Message envoyé</h2>
        <p>
          Merci, votre message a bien été transmis au secrétariat de mairie. Vous recevrez une
          réponse à l’adresse e-mail indiquée.
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      <ErrorSummary errors={errors} labels={LABELS} />
      {state.status === 'failed' && (
        <p role="alert" className="rounded-card bg-urgence-soft p-4 font-bold">
          {state.message}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label={LABELS.name!} error={errors.name} required>
          {(p) => <input {...p} type="text" autoComplete="name" className={inputClass} />}
        </Field>
        <Field
          name="email"
          label={LABELS.email!}
          error={errors.email}
          hint="Pour vous répondre."
          required
        >
          {(p) => <input {...p} type="email" autoComplete="email" className={inputClass} />}
        </Field>
        <Field name="phone" label={LABELS.phone!} error={errors.phone}>
          {(p) => <input {...p} type="tel" autoComplete="tel" className={inputClass} />}
        </Field>
        <Field name="subject" label={LABELS.subject!} error={errors.subject} required>
          {(p) => (
            <select {...p} defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choisissez un objet
              </option>
              {CONTACT_SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field name="message" label={LABELS.message!} error={errors.message} required>
        {(p) => <textarea {...p} rows={7} className={inputClass} />}
      </Field>
      <div aria-hidden="true" className="hidden">
        <label htmlFor="champ-website">Ne pas remplir</label>
        <input id="champ-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-1.5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            id="champ-consent"
            name="consent"
            className="mt-1 size-5 accent-rouge"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'champ-consent-erreur' : undefined}
          />
          <span>
            J’accepte que la mairie utilise ces informations pour répondre à ma demande.{' '}
            <a href="/donnees-personnelles/">En savoir plus sur vos données</a>
          </span>
        </label>
        {errors.consent && (
          <p id="champ-consent-erreur" className="text-sm font-bold text-urgence">
            {errors.consent}
          </p>
        )}
      </div>
      <Turnstile siteKey={siteKey} onToken={onToken} />
      {errors.turnstileToken && (
        <p className="text-sm font-bold text-urgence">{errors.turnstileToken}</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn" disabled={state.status === 'sending'}>
          {state.status === 'sending' ? 'Envoi en cours…' : 'Envoyer le message'}
        </button>
        <p className="text-sm text-muted">Vous pouvez aussi appeler la mairie au {phone}.</p>
      </div>
    </form>
  );
}
