import { fileURLToPath } from 'node:url';

export const ORIGIN = 'http://www.saintamandlongpre.fr';
export const HOST = 'www.saintamandlongpre.fr';
export const USER_AGENT =
  'SaintAmandLongpre-Migration/1.0 (+refonte du site communal ; contact via mairie)';

/** Délai minimal entre deux requêtes vers l'ancien serveur, en millisecondes. */
export const REQUEST_DELAY_MS = 300;

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const SCRAPE_DIR = `${root}data/scrape`;
export const CACHE_DIR = `${SCRAPE_DIR}/cache`;
export const MEDIA_DIR = `${SCRAPE_DIR}/media`;
export const FIXTURES_DIR = `${root}data/fixtures`;

/** Points d'entrée de l'exploration. */
export const SEEDS = [
  '/',
  '/fr/plan-du-site',
  '/fr/actualites',
  '/fr/evenements',
  '/fr/comptes-rendus',
  '/fr/conseil-municipal',
  '/fr/associations',
  '/fr/commerces',
  '/fr/artisans',
  '/fr/entreprises',
  '/fr/numeros-utiles',
  '/fr/salles-municipales',
  '/fr/en-images',
  '/fr/marches-publics',
  '/fr/liens-externes',
];

/**
 * Chemins ignorés : fonctionnalités abandonnées, pages techniques ou contenus
 * personnels (les petites annonces contiennent des coordonnées de particuliers).
 */
export const EXCLUDED_PATHS: RegExp[] = [
  /^\/(rdcadmin|admin|cron|mobile|default)\b/,
  /^\/fr\/(previsions-meteo|en-videos|sondages|mises-a-jour|questions-publiques|conditions-utilisation|focus)\b/,
  /^\/fr\/(petites-annonces|petite-annonce)\b/,
  /^\/fr\/(online_?procedures|espace-membre|recherche)\b/,
  // Filtres par catégorie des listes : les fiches y sont déjà listées ailleurs.
  // Ceux des associations et numéros utiles sont gardés pour connaître la catégorie.
  /^\/fr\/(commerces|artisans|entreprises|liens-externes)\/1\//,
  /\/action\/profil$/,
  /^\/fr\/association-diaporama\//,
  // Calendriers de disponibilité des salles (navigation mois par mois sans fin) et réservation.
  /^\/fr\/salle-municipale\/\d+\/[^/]+\/.+/,
  /^\/fr\/salle-municipale-reservation\//,
  /^\/fr\/(commerce|artisan|entreprise|association)-contact\//,
  // Liens relatifs cassés de l'ancien site (« fr/mises-a-jour » accolé à un chemin, domaines collés).
  /.\/fr\/mises-a-jour$/,
  /%20|\/www\./,
  /^\/fr\/(ajouter|modifier)-/,
  /^\/fr\/(municipalreport|usefulnumber)\/index\/?$/,
  /^\/fr\/(municipalreport|usefulnumber)\/?$/,
  /^\/fr\/association-les-actualites\//,
];

/**
 * Correspondance entre les rubriques de l'ancien site et l'arborescence du
 * nouveau. Les sous-rubriques héritent du chemin de leur parent.
 */
export const PAGE_PATHS: Record<string, string> = {
  '/fr/information/97641/le-conseil-municipal': '/mairie/conseil-municipal/',
  '/fr/information/6298/convocations-conseils-municipaux':
    '/mairie/conseil-municipal/convocations/',
  '/fr/information/97642/publication-deliberations-arretes':
    '/mairie/conseil-municipal/deliberations-et-arretes/',
  '/fr/information/61450/commissions-communales-syndicats-communaux':
    '/mairie/conseil-municipal/commissions-et-syndicats/',
  '/fr/information/5064/le-personnel-communal': '/mairie/personnel-communal/',
  '/fr/information/3497/autres-missions-communales': '/mairie/missions-communales/',
  '/fr/information/5397/communaute-agglomeration-territoires-vendomois':
    '/mairie/intercommunalite/territoires-vendomois/',
  '/fr/intercommunalite': '/mairie/intercommunalite/',
  '/fr/marches-publics': '/mairie/marches-publics/',
  '/fr/information/3512/etat-civil': '/demarches/etat-civil/',
  '/fr/information/3499/urbanisme': '/demarches/urbanisme/',
  '/fr/information/13824/les-autorisations-urbanisme': '/demarches/urbanisme/autorisations/',
  '/fr/demarches-en-ligne': '/demarches/en-ligne/',
  '/fr/information/83506/agriculture': '/vivre-ici/agriculture/',
  '/fr/information/86330/assainissement-collectif': '/vivre-ici/assainissement/',
  '/fr/information/6339/enfance-syndicat-scolaire-amandinois': '/vivre-ici/ecole-et-enfance/',
  '/fr/information/87934/transports': '/vivre-ici/transports/',
  '/fr/information/89102/animations-communaute-agglomerations':
    '/vivre-ici/animations-intercommunales/',
  '/fr/en-images': '/decouvrir/photos/',
};

/** Rubriques de l'ancien site remplacées par des pages dédiées du nouveau. */
export const LIST_REDIRECTS: Record<string, string> = {
  '/': '/',
  '/fr': '/',
  '/fr/actualites': '/actualites/',
  '/fr/evenements': '/agenda/',
  '/fr/conseil-municipal': '/mairie/conseil-municipal/elus/',
  '/fr/comptes-rendus': '/mairie/conseil-municipal/comptes-rendus/',
  '/fr/salles-municipales': '/demarches/louer-une-salle/',
  '/fr/associations': '/vivre-ici/associations/',
  '/fr/commerces': '/vivre-ici/commerces-et-entreprises/',
  '/fr/artisans': '/vivre-ici/commerces-et-entreprises/',
  '/fr/entreprises': '/vivre-ici/commerces-et-entreprises/',
  '/fr/numeros-utiles': '/demarches/numeros-utiles/',
  '/fr/liens-externes': '/',
  '/fr/contact': '/contact/',
  '/fr/nous-contacter': '/contact/',
  '/fr/mentions-legales': '/mentions-legales/',
  '/fr/politique-confidentialite': '/donnees-personnelles/',
  '/fr/accessibilite': '/accessibilite/',
  '/fr/plan-du-site': '/plan-du-site/',
  '/fr/petites-annonces': '/',
  '/fr/questions-publiques': '/contact/',
  '/fr/focus': '/actualites/',
  '/fr/previsions-meteo': '/',
  '/fr/en-videos': '/decouvrir/photos/',
  '/fr/mises-a-jour': '/actualites/',
  '/fr/sondages': '/',
  '/mobile': '/',
};

/** Population municipale (INSEE, recensement 2023). */
export const POPULATION = 1218;

/**
 * Photo d'ouverture de l'accueil : l'église, dans la meilleure résolution que
 * fournit l'ancien site. À remplacer par une photo du futur reportage.
 */
export const HERO_IMAGE_URL =
  'http://thumbs.reseaudescommunes.fr/thumbs/166/1200x800/y86hg64y9kqrb5i.jpg';
export const HERO_IMAGE_ALT =
  "L'église de Saint-Amand-Longpré, son clocher de pierre et sa flèche d'ardoise";
