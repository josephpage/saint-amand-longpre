import { z } from 'zod';

const required = (label: string) => `${label} : ce champ est obligatoire.`;

export const CONTACT_SUBJECTS = [
  'État civil',
  'Urbanisme',
  'Location de salle',
  'École et enfance',
  'Conseil municipal',
  'Autre demande',
] as const;

export const REPORT_CATEGORIES = [
  'Voirie et trottoirs',
  'Éclairage public',
  'Espaces verts',
  'Propreté et dépôts sauvages',
  'Eau et assainissement',
  'Autre',
] as const;

/** Taille maximale d'une photo jointe à un signalement : 5 Mo. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const name = z
  .string({ error: required('Nom') })
  .trim()
  .min(2, 'Nom : indiquez au moins 2 caractères.')
  .max(100, 'Nom : 100 caractères au maximum.');
const email = z
  .email({
    error: (issue) =>
      issue.input === undefined
        ? required('E-mail')
        : 'E-mail : l’adresse n’est pas valide, par exemple prenom.nom@exemple.fr.',
  })
  .trim()
  .max(200);
const phone = z
  .string()
  .trim()
  .max(20)
  .regex(
    /^[\d\s.+()-]*$/,
    'Téléphone : utilisez uniquement des chiffres, espaces, points ou le signe +.',
  )
  .optional()
  .or(z.literal(''));

/** Champs communs : consentement et protection contre les robots. */
const common = {
  consent: z.literal(true, {
    error: 'Cochez la case pour accepter le traitement de votre demande.',
  }),
  // Champ piège invisible : un humain le laisse vide.
  website: z.string().max(0).optional().or(z.literal('')),
  turnstileToken: z
    .string({ error: 'La vérification anti-robot a échoué, rechargez la page.' })
    .min(1, 'La vérification anti-robot a échoué, rechargez la page.'),
};

export const contactSchema = z.object({
  name,
  email,
  phone,
  subject: z.enum(CONTACT_SUBJECTS, { error: required('Objet') }),
  message: z
    .string({ error: required('Message') })
    .trim()
    .min(10, 'Message : écrivez au moins 10 caractères.')
    .max(5000, 'Message : 5 000 caractères au maximum.'),
  ...common,
});

export const reportSchema = z.object({
  name,
  email,
  phone,
  category: z.enum(REPORT_CATEGORIES, { error: required('Type de problème') }),
  location: z
    .string({ error: required('Lieu') })
    .trim()
    .min(3, 'Lieu : précisez l’adresse ou un repère, par exemple « devant le 12 rue Jules Ferry ».')
    .max(300),
  description: z
    .string({ error: required('Description') })
    .trim()
    .min(10, 'Description : écrivez au moins 10 caractères.')
    .max(3000, 'Description : 3 000 caractères au maximum.'),
  ...common,
});

/** Erreurs de validation indexées par champ, prêtes à afficher. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export function validatePhoto(file: { size: number; type: string } | null): string | null {
  if (!file || file.size === 0) return null;
  if (!PHOTO_TYPES.includes(file.type)) return 'Photo : formats acceptés JPEG, PNG, WebP ou HEIC.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo : la taille maximale est de 5 Mo.';
  return null;
}
