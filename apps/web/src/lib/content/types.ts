import type { DirectoryKind, OpeningSlot, Section } from '@sal/model';

export type { DirectoryKind, OpeningSlot };

/** Modèle de contenu utilisé par les pages, quelle que soit la source. */

export interface Image {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface Document {
  url: string;
  title: string;
}

export interface Page {
  id: string;
  /** Date de dernière modification, AAAA-MM-JJ. */
  modified?: string;
  title: string;
  /** Chemin public, par exemple « /demarches/etat-civil/passeport/ ». */
  path: string;
  parentPath?: string;
  section: Section;
  html: string;
  excerpt?: string;
  order: number;
}

export interface News {
  id: string;
  /** Date de dernière modification, AAAA-MM-JJ. */
  modified?: string;
  slug: string;
  title: string;
  /** Date de publication, AAAA-MM-JJ. */
  date: string;
  category: string;
  excerpt: string;
  html: string;
  image?: Image;
}

export interface Event {
  id: string;
  /** Date de dernière modification, AAAA-MM-JJ. */
  modified?: string;
  slug: string;
  title: string;
  /** Date et heure locales (Europe/Paris), AAAA-MM-JJTHH:MM. */
  start: string;
  end?: string;
  allDay: boolean;
  location?: string;
  address?: string;
  excerpt?: string;
  html: string;
  image?: Image;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  report?: Document;
  html: string;
}

export interface Elected {
  id: string;
  name: string;
  role: 'maire' | 'adjoint' | 'conseiller';
  title: string;
  delegations?: string;
  photo?: Image;
  order: number;
}

export interface Room {
  id: string;
  /** Date de dernière modification, AAAA-MM-JJ. */
  modified?: string;
  slug: string;
  title: string;
  excerpt?: string;
  html: string;
  capacity?: number;
  seated?: number;
  photos: Image[];
}

export interface DirectoryEntry {
  id: string;
  kind: DirectoryKind;
  slug: string;
  title: string;
  category?: string;
  html: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  logo?: Image;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'vigilance' | 'urgence';
  link?: string;
  /** Dernier jour d'affichage, AAAA-MM-JJ. */
  expires: string;
}

export interface Settings {
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  hours: OpeningSlot[];
  facebook?: string;
  latitude?: number;
  longitude?: number;
  heroImage?: Image;
  population?: number;
}

export interface Redirect {
  from: string;
  to: string;
}

export interface SiteContent {
  settings: Settings;
  pages: Page[];
  news: News[];
  events: Event[];
  meetings: Meeting[];
  elected: Elected[];
  rooms: Room[];
  directory: DirectoryEntry[];
  alerts: Alert[];
  redirects: Redirect[];
}

/** Élément affiché par la route de prévisualisation. */
export type PreviewItem =
  | { kind: 'page'; item: Page }
  | { kind: 'news'; item: News }
  | { kind: 'event'; item: Event }
  | { kind: 'room'; item: Room };
