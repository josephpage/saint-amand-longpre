import { SECTIONS, type Section } from '@sal/model';
import { textFromHtml, truncate } from '../html.ts';
import type {
  Alert,
  DirectoryEntry,
  DirectoryKind,
  Elected,
  Event,
  Image,
  Meeting,
  News,
  Page,
  Redirect,
  Room,
  Settings,
} from '../types.ts';

/** Formes des réponses GraphQL de WordPress (WPGraphQL + WPGraphQL for ACF). */
interface WpImage {
  sourceUrl: string;
  altText?: string | null;
  mediaDetails?: { width?: number | null; height?: number | null } | null;
}
type Featured = { featuredImage?: { node: WpImage } | null };

export interface WpPage {
  databaseId: number;
  title: string;
  uri: string | null;
  content: string | null;
  menuOrder?: number | null;
  excerpt?: string | null;
}
export interface WpPost extends Featured {
  databaseId: number;
  slug: string;
  title: string;
  date: string;
  content: string | null;
  excerpt?: string | null;
  categories?: { nodes: { name: string }[] } | null;
}
export interface WpEvent extends Featured {
  databaseId: number;
  slug: string;
  title: string;
  content: string | null;
  excerpt?: string | null;
  infosEvenement?: {
    debut?: string | null;
    fin?: string | null;
    journeeEntiere?: boolean | null;
    lieu?: string | null;
    adresse?: string | null;
  } | null;
}
export interface WpMeeting {
  databaseId: number;
  title: string;
  content: string | null;
  infosSeance?: {
    date?: string | null;
    compteRendu?: { node: { mediaItemUrl: string; title?: string | null } } | null;
  } | null;
}
export interface WpElected extends Featured {
  databaseId: number;
  title: string;
  menuOrder?: number | null;
  infosElu?: {
    role?: string | string[] | null;
    fonction?: string | null;
    delegations?: string | null;
  } | null;
}
export interface WpRoom extends Featured {
  databaseId: number;
  slug: string;
  title: string;
  content: string | null;
  excerpt?: string | null;
  infosSalle?: { capacite?: number | null; placesAssises?: number | null } | null;
}
export interface WpDirectoryEntry extends Featured {
  databaseId: number;
  slug: string;
  title: string;
  content: string | null;
  typesAnnuaire?: { nodes: { slug: string }[] } | null;
  categoriesAnnuaire?: { nodes: { name: string }[] } | null;
  infosAnnuaire?: {
    telephone?: string | null;
    email?: string | null;
    site?: string | null;
    adresse?: string | null;
  } | null;
}
export interface WpAlert {
  databaseId: number;
  title: string;
  content: string | null;
  infosAlerte?: {
    niveau?: string | string[] | null;
    lien?: string | null;
    expiration?: string | null;
  } | null;
}
export interface WpSettings {
  adresse?: string | null;
  codePostal?: string | null;
  commune?: string | null;
  telephone?: string | null;
  facebook?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  population?: number | null;
  photoAccueil?: WpImage | null;
  horaires?: { jour: number; ouverture: string; fermeture: string }[] | null;
}

const decode = (s: string) =>
  s
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8211;/g, '–')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');

/** Premier élément d'une valeur ACF de type liste (les champs select peuvent être des tableaux). */
const first = (v: string | string[] | null | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? undefined;

function mapImage(img: WpImage | null | undefined, fallbackAlt = ''): Image | undefined {
  if (!img?.sourceUrl) return undefined;
  return {
    src: img.sourceUrl,
    alt: img.altText?.trim() || fallbackAlt,
    ...(img.mediaDetails?.width ? { width: img.mediaDetails.width } : {}),
    ...(img.mediaDetails?.height ? { height: img.mediaDetails.height } : {}),
  };
}

const excerptOf = (excerpt: string | null | undefined, content: string | null | undefined) =>
  truncate(decode(textFromHtml(excerpt || content || '')), 180);

/**
 * Convertit une date ACF en date locale AAAA-MM-JJTHH:MM. Accepte les formats
 * « 2026-10-10 09:00:00 », « 10/10/2026 9:00 am » et ISO.
 */
export function normalizeDateTime(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const iso = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (iso) return `${iso[1]}T${iso[2]}:${iso[3]}`;
  const day = /^(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (day) return `${day[1]}T00:00`;
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(value);
  if (fr) {
    let h = Number(fr[4]);
    if (fr[6]?.toLowerCase() === 'pm' && h < 12) h += 12;
    if (fr[6]?.toLowerCase() === 'am' && h === 12) h = 0;
    return `${fr[3]}-${fr[2]}-${fr[1]}T${String(h).padStart(2, '0')}:${fr[5]}`;
  }
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}T00:00`;
  return undefined;
}

const normalizeDate = (value: string | null | undefined) => normalizeDateTime(value)?.slice(0, 10);

export function mapPage(p: WpPage): Page | null {
  if (!p.uri || !p.uri.startsWith('/')) return null;
  const path = p.uri.endsWith('/') ? p.uri : `${p.uri}/`;
  const parts = path.split('/').filter(Boolean);
  const section = (SECTIONS as readonly string[]).includes(parts[0] ?? '')
    ? (parts[0] as Section)
    : 'vivre-ici';
  const parentPath = parts.length > 1 ? `/${parts.slice(0, -1).join('/')}/` : undefined;
  const excerpt = excerptOf(p.excerpt, p.content);
  return {
    id: `wp:${p.databaseId}`,
    title: decode(p.title),
    path,
    ...(parentPath ? { parentPath } : {}),
    section,
    html: p.content ?? '',
    ...(excerpt ? { excerpt } : {}),
    order: p.menuOrder ?? 0,
  };
}

export function mapPost(p: WpPost): News {
  const image = mapImage(p.featuredImage?.node);
  return {
    id: `wp:${p.databaseId}`,
    slug: p.slug,
    title: decode(p.title),
    date: p.date.slice(0, 10),
    category: decode(p.categories?.nodes[0]?.name ?? 'Vie locale'),
    excerpt: excerptOf(p.excerpt, p.content),
    html: p.content ?? '',
    ...(image ? { image } : {}),
  };
}

export function mapEvent(e: WpEvent): Event | null {
  const info = e.infosEvenement ?? {};
  const start = normalizeDateTime(info.debut);
  if (!start) return null;
  const end = normalizeDateTime(info.fin);
  const image = mapImage(e.featuredImage?.node);
  const excerpt = excerptOf(e.excerpt, e.content);
  return {
    id: `wp:${e.databaseId}`,
    slug: e.slug,
    title: decode(e.title),
    start,
    ...(end ? { end } : {}),
    allDay: Boolean(info.journeeEntiere),
    ...(info.lieu ? { location: info.lieu } : {}),
    ...(info.adresse ? { address: info.adresse } : {}),
    ...(excerpt ? { excerpt } : {}),
    html: e.content ?? '',
    ...(image ? { image } : {}),
  };
}

export function mapMeeting(m: WpMeeting): Meeting | null {
  const date = normalizeDate(m.infosSeance?.date);
  if (!date) return null;
  const file = m.infosSeance?.compteRendu?.node;
  return {
    id: `wp:${m.databaseId}`,
    title: decode(m.title),
    date,
    ...(file
      ? {
          report: {
            url: file.mediaItemUrl,
            title: decode(file.title ?? `Compte rendu – ${m.title}`),
          },
        }
      : {}),
    html: m.content ?? '',
  };
}

export function mapElected(e: WpElected): Elected {
  const role = first(e.infosElu?.role);
  const photo = mapImage(e.featuredImage?.node, decode(e.title));
  return {
    id: `wp:${e.databaseId}`,
    name: decode(e.title),
    role: role === 'maire' || role === 'adjoint' ? role : 'conseiller',
    title:
      e.infosElu?.fonction ||
      (role === 'maire' ? 'Maire' : role === 'adjoint' ? 'Adjoint' : 'Conseiller municipal'),
    ...(e.infosElu?.delegations ? { delegations: e.infosElu.delegations } : {}),
    ...(photo ? { photo } : {}),
    order: e.menuOrder ?? 0,
  };
}

export function mapRoom(r: WpRoom): Room {
  const photo = mapImage(r.featuredImage?.node, decode(r.title));
  const excerpt = excerptOf(r.excerpt, r.content);
  return {
    id: `wp:${r.databaseId}`,
    slug: r.slug,
    title: decode(r.title),
    ...(excerpt ? { excerpt } : {}),
    html: r.content ?? '',
    ...(r.infosSalle?.capacite ? { capacity: r.infosSalle.capacite } : {}),
    ...(r.infosSalle?.placesAssises ? { seated: r.infosSalle.placesAssises } : {}),
    photos: photo ? [photo] : [],
  };
}

const KINDS: DirectoryKind[] = ['association', 'commerce', 'artisan', 'entreprise', 'numero-utile'];

export function mapDirectoryEntry(d: WpDirectoryEntry): DirectoryEntry | null {
  const kind = KINDS.find((k) => d.typesAnnuaire?.nodes.some((n) => n.slug === k));
  if (!kind) return null;
  const info = d.infosAnnuaire ?? {};
  const logo = mapImage(d.featuredImage?.node, `Logo ${decode(d.title)}`);
  const category = d.categoriesAnnuaire?.nodes[0]?.name;
  return {
    id: `wp:${d.databaseId}`,
    kind,
    slug: d.slug,
    title: decode(d.title),
    ...(category ? { category: decode(category) } : {}),
    html: d.content ?? '',
    ...(info.telephone ? { phone: info.telephone } : {}),
    ...(info.email ? { email: info.email } : {}),
    ...(info.site ? { website: info.site } : {}),
    ...(info.adresse ? { address: info.adresse } : {}),
    ...(logo ? { logo } : {}),
  };
}

export function mapAlert(a: WpAlert): Alert | null {
  const expires = normalizeDate(a.infosAlerte?.expiration);
  if (!expires) return null;
  const level = first(a.infosAlerte?.niveau);
  return {
    id: `wp:${a.databaseId}`,
    title: decode(a.title),
    message: decode(textFromHtml(a.content ?? '')),
    level: level === 'vigilance' || level === 'urgence' ? level : 'info',
    ...(a.infosAlerte?.lien ? { link: a.infosAlerte.lien } : {}),
    expires,
  };
}

export function mapSettings(s: WpSettings | null | undefined): Settings {
  const hero = mapImage(s?.photoAccueil, 'Saint-Amand-Longpré');
  return {
    street: s?.adresse ?? '',
    postalCode: s?.codePostal ?? '',
    city: s?.commune ?? '',
    phone: s?.telephone ?? '',
    hours: (s?.horaires ?? []).map((h) => ({ day: h.jour, open: h.ouverture, close: h.fermeture })),
    ...(s?.facebook ? { facebook: s.facebook } : {}),
    ...(s?.latitude != null ? { latitude: s.latitude } : {}),
    ...(s?.longitude != null ? { longitude: s.longitude } : {}),
    ...(hero ? { heroImage: hero } : {}),
    ...(s?.population ? { population: s.population } : {}),
  };
}

export const mapRedirects = (list: { de: string; vers: string }[] | null | undefined): Redirect[] =>
  (list ?? []).map((r) => ({ from: r.de, to: r.vers }));
