import { useCallback, useRef, useState, type SubmitEvent } from 'react';
import {
  fieldErrors,
  PHOTO_TYPES,
  REPORT_CATEGORIES,
  reportSchema,
  validatePhoto,
} from '~/lib/forms/schemas.ts';
import {
  ErrorSummary,
  Field,
  inputClass,
  submitForm,
  Turnstile,
  type SubmitState,
} from './form-kit.tsx';

const LABELS: Record<string, string> = {
  category: 'Type de problème',
  location: 'Lieu',
  description: 'Description',
  photo: 'Photo',
  name: 'Nom et prénom',
  email: 'E-mail',
  phone: 'Téléphone',
  consent: 'Consentement',
};

export default function ReportForm({ siteKey }: { siteKey: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [token, setToken] = useState('');
  const doneRef = useRef<HTMLDivElement>(null);
  const onToken = useCallback((t: string) => setToken(t), []);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === 'string'));
    const parsed = reportSchema.safeParse({
      ...values,
      consent: data.get('consent') === 'on',
      turnstileToken: token,
    });
    const photo = data.get('photo');
    const photoError = validatePhoto(photo instanceof File ? photo : null);
    const next = {
      ...(parsed.success ? {} : fieldErrors(parsed.error)),
      ...(photoError ? { photo: photoError } : {}),
    };
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    setState({ status: 'sending' });
    data.set('turnstileToken', token);
    const result = await submitForm('/api/signalement/', data);
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
        <h2 className="text-2xl">Signalement transmis</h2>
        <p>
          Merci. Les services techniques de la mairie ont reçu votre signalement et interviendront
          dès que possible.
        </p>
        <p className="text-sm text-muted">En cas de danger immédiat, appelez le 112.</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5" encType="multipart/form-data">
      <ErrorSummary errors={errors} labels={LABELS} />
      {state.status === 'failed' && (
        <p role="alert" className="rounded-card bg-urgence-soft p-4 font-bold">
          {state.message}
        </p>
      )}
      <fieldset className="grid gap-5">
        <legend className="mb-1 font-display text-xl font-semibold">Le problème</legend>
        <Field name="category" label={LABELS.category!} error={errors.category} required>
          {(p) => (
            <select {...p} defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choisissez un type
              </option>
              {REPORT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field
          name="location"
          label={LABELS.location!}
          error={errors.location}
          hint="Adresse ou repère, par exemple « devant le 12 rue Jules Ferry »."
          required
        >
          {(p) => <input {...p} type="text" className={inputClass} />}
        </Field>
        <Field name="description" label={LABELS.description!} error={errors.description} required>
          {(p) => <textarea {...p} rows={5} className={inputClass} />}
        </Field>
        <Field
          name="photo"
          label={LABELS.photo!}
          error={errors.photo}
          hint="JPEG, PNG, WebP ou HEIC, 5 Mo au maximum."
        >
          {(p) => <input {...p} type="file" accept={PHOTO_TYPES.join(',')} className="text-base" />}
        </Field>
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-1 font-display text-xl font-semibold sm:col-span-2">
          Vos coordonnées
        </legend>
        <Field name="name" label={LABELS.name!} error={errors.name} required>
          {(p) => <input {...p} type="text" autoComplete="name" className={inputClass} />}
        </Field>
        <Field
          name="email"
          label={LABELS.email!}
          error={errors.email}
          hint="Pour vous tenir informé."
          required
        >
          {(p) => <input {...p} type="email" autoComplete="email" className={inputClass} />}
        </Field>
        <Field name="phone" label={LABELS.phone!} error={errors.phone}>
          {(p) => <input {...p} type="tel" autoComplete="tel" className={inputClass} />}
        </Field>
      </fieldset>
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
            J’accepte que la mairie utilise ces informations pour traiter mon signalement.{' '}
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
      <button
        type="submit"
        className="btn justify-self-start"
        disabled={state.status === 'sending'}
      >
        {state.status === 'sending' ? 'Envoi en cours…' : 'Envoyer le signalement'}
      </button>
    </form>
  );
}
