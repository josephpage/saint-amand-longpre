export type PageKind =
  | 'home'
  | 'information'
  | 'news'
  | 'news-list'
  | 'event'
  | 'meetings-list'
  | 'meeting'
  | 'council'
  | 'profile'
  | 'rooms-list'
  | 'room'
  | 'associations-list'
  | 'association'
  | 'business-list'
  | 'numbers-list'
  | 'links'
  | 'album'
  | 'room-gallery'
  | 'association-news'
  | 'association-news-gallery'
  | 'generic'
  | 'other';

const RULES: [RegExp, PageKind][] = [
  [/^\/$/, 'home'],
  [/^\/fr\/information\/\d+\//, 'information'],
  [/^\/fr\/actualite\/\d+/, 'news'],
  [/^\/fr\/actualites(\/\d+)?$/, 'news-list'],
  [/^\/fr\/evenement\/\d+/, 'event'],
  [/^\/fr\/comptes-rendus(\/\d+)?$/, 'meetings-list'],
  [/^\/fr\/municipalreport\/index\/page\/\d+$/, 'meetings-list'],
  [/^\/fr\/compte-rendu\/\d+/, 'meeting'],
  [/^\/fr\/conseil-municipal$/, 'council'],
  [/^\/fr\/conseil-municipal-profil\/\d+/, 'profile'],
  [/^\/fr\/salles-municipales(\/\d+)?$/, 'rooms-list'],
  [/^\/fr\/salle-municipale\/\d+/, 'room'],
  [/^\/fr\/associations(\/\d+|\/1\/\d+\/[^/]+)?$/, 'associations-list'],
  [/^\/fr\/association\/1\/\d+/, 'association'],
  [/^\/fr\/(commerces|artisans|entreprises)(\/\d+)?$/, 'business-list'],
  [/^\/fr\/numeros-utiles(\/\d+|\/1\/\d+\/[^/]+)?$/, 'numbers-list'],
  [/^\/fr\/usefulnumber\/index\/page\/\d+$/, 'numbers-list'],
  [/^\/fr\/en-images-diaporama\/\d+\/[^/]+$/, 'album'],
  [/^\/fr\/salle-municipale-diaporama\/\d+(\/[^/]+)?$/, 'room-gallery'],
  [/^\/fr\/association-actualite\/\d+\/\d+\/[^/]+$/, 'association-news'],
  [/^\/fr\/association-actualite-diaporama\/\d+$/, 'association-news-gallery'],
  [/^\/fr\/liens-externes$/, 'links'],
  [/^\/fr\/(intercommunalite|demarches-en-ligne|marches-publics|en-images)$/, 'generic'],
];

export function classify(path: string): PageKind {
  for (const [re, kind] of RULES) if (re.test(path)) return kind;
  return 'other';
}

/** Dernier segment « lisible » d'une URL de l'ancien site. */
export function oldSlug(path: string): string {
  const parts = decodeURIComponent(path).split('/').filter(Boolean);
  const last = parts.at(-1) ?? '';
  return /^\d+$/.test(last) ? (parts.at(-2) ?? last) : last;
}
