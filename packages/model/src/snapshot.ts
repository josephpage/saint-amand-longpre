import { z } from 'zod';

/**
 * Format d'échange du contenu du site.
 *
 * Le scraper produit un « snapshot » dans ce format, le jeu de données de test
 * (data/fixtures) l'utilise aussi, l'importeur WordPress le consomme et le site
 * Astro sait le lire directement (source « fixtures »).
 */

export const SECTIONS = ['mairie', 'demarches', 'vivre-ici', 'decouvrir'] as const;
export const sectionSchema = z.enum(SECTIONS);
export type Section = z.infer<typeof sectionSchema>;

export const SECTION_LABELS: Record<Section, string> = {
  mairie: 'Ma mairie',
  demarches: 'Démarches',
  'vivre-ici': 'Vivre ici',
  decouvrir: 'Découvrir',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const isoLocalDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Date et heure attendues au format AAAA-MM-JJTHH:MM');
const path = z.string().regex(/^\/([a-z0-9-]+\/)*$/, 'Chemin attendu de la forme /a/b/');

export const mediaSchema = z.object({
  /** Identifiant stable dérivé du contenu du fichier. */
  id: z.string().min(1),
  sourceUrl: z.string(),
  /** Chemin relatif au dossier `media/` du snapshot. */
  file: z.string(),
  mime: z.string(),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  title: z.string().optional(),
  alt: z.string().optional(),
  credit: z.string().optional(),
});
export type SnapshotMedia = z.infer<typeof mediaSchema>;

export const attachmentSchema = z.object({
  mediaId: z.string(),
  title: z.string(),
});
export type SnapshotAttachment = z.infer<typeof attachmentSchema>;

export const pageSchema = z.object({
  sourceUrl: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  section: sectionSchema,
  path,
  parentPath: path.optional(),
  html: z.string(),
  excerpt: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
  gallery: z.array(z.string()).default([]),
  order: z.number().int().default(0),
});
export type SnapshotPage = z.infer<typeof pageSchema>;

export const newsSchema = z.object({
  sourceUrl: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  date: isoDate,
  /** Vrai quand la date n'a pas pu être lue dans la source et a été estimée. */
  dateEstimated: z.boolean().default(false),
  category: z.string().default('Vie locale'),
  html: z.string(),
  excerpt: z.string().optional(),
  imageId: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
  gallery: z.array(z.string()).default([]),
});
export type SnapshotNews = z.infer<typeof newsSchema>;

export const eventSchema = z.object({
  sourceUrl: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  start: isoLocalDateTime,
  end: isoLocalDateTime.optional(),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
  address: z.string().optional(),
  html: z.string(),
  excerpt: z.string().optional(),
  imageId: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
});
export type SnapshotEvent = z.infer<typeof eventSchema>;

export const meetingSchema = z.object({
  sourceUrl: z.string().optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  date: isoDate,
  reportId: z.string().optional(),
  html: z.string().default(''),
});
export type SnapshotMeeting = z.infer<typeof meetingSchema>;

export const electedSchema = z.object({
  sourceUrl: z.string().optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['maire', 'adjoint', 'conseiller']),
  /** Libellé affiché, par exemple « 1er adjoint ». */
  title: z.string(),
  delegations: z.string().optional(),
  photoId: z.string().optional(),
  order: z.number().int().default(0),
});
export type SnapshotElected = z.infer<typeof electedSchema>;

export const roomSchema = z.object({
  sourceUrl: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  html: z.string(),
  excerpt: z.string().optional(),
  /** Nombre maximal de personnes accueillies. */
  capacity: z.number().int().positive().optional(),
  /** Nombre de places assises, quand il est précisé. */
  seated: z.number().int().positive().optional(),
  photoIds: z.array(z.string()).default([]),
  attachments: z.array(attachmentSchema).default([]),
});
export type SnapshotRoom = z.infer<typeof roomSchema>;

export const DIRECTORY_KINDS = [
  'association',
  'commerce',
  'artisan',
  'entreprise',
  'numero-utile',
] as const;
export const directoryKindSchema = z.enum(DIRECTORY_KINDS);
export type DirectoryKind = z.infer<typeof directoryKindSchema>;

export const directorySchema = z.object({
  sourceUrl: z.string().optional(),
  kind: directoryKindSchema,
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().optional(),
  html: z.string().default(''),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  contact: z.string().optional(),
  logoId: z.string().optional(),
});
export type SnapshotDirectoryEntry = z.infer<typeof directorySchema>;

export const linkSchema = z.object({
  title: z.string().min(1),
  url: z.string(),
  category: z.string().optional(),
});
export type SnapshotLink = z.infer<typeof linkSchema>;

export const alertSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  level: z.enum(['info', 'vigilance', 'urgence']).default('info'),
  link: z.string().optional(),
  expires: isoDate,
});
export type SnapshotAlert = z.infer<typeof alertSchema>;

export const openingSlotSchema = z.object({
  /** Jour ISO : 1 = lundi … 7 = dimanche. */
  day: z.number().int().min(1).max(7),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});
export type OpeningSlot = z.infer<typeof openingSlotSchema>;

export const settingsSchema = z.object({
  name: z.string(),
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  phone: z.string(),
  hours: z.array(openingSlotSchema),
  facebook: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  heroImageId: z.string().optional(),
  /** Nombre d'habitants affiché sur l'accueil (source INSEE). */
  population: z.number().int().positive().optional(),
});
export type SnapshotSettings = z.infer<typeof settingsSchema>;

export const redirectSchema = z.object({
  from: z.string().startsWith('/'),
  to: z.string().startsWith('/'),
});
export type SnapshotRedirect = z.infer<typeof redirectSchema>;

export const snapshotSchema = z.object({
  version: z.literal(1),
  scrapedAt: z.string(),
  source: z.string(),
  settings: settingsSchema,
  pages: z.array(pageSchema),
  news: z.array(newsSchema),
  events: z.array(eventSchema),
  meetings: z.array(meetingSchema),
  elected: z.array(electedSchema),
  rooms: z.array(roomSchema),
  directory: z.array(directorySchema),
  links: z.array(linkSchema),
  alerts: z.array(alertSchema).default([]),
  media: z.array(mediaSchema),
  redirects: z.array(redirectSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
