/** Informations légales et de contact affichées sur le site. */
export const LEGAL = {
  publisher: 'Commune de Saint-Amand-Longpré',
  /** Adresse publique de la mairie (reçoit aussi les formulaires, voir MAIL_TO). */
  email: 'secretariat@saintamandlongpre.fr',
  host: {
    name: 'Cloudflare, Inc.',
    address: '101 Townsend Street, San Francisco, CA 94107, États-Unis',
    url: 'https://www.cloudflare.com/',
  },
  /** Date de la déclaration d'accessibilité : à mettre à jour après l'audit RGAA. */
  accessibilityStatementDate: '28 septembre 2026',
};

/** Logo officiel de la commune (charte graphique 2026) : propriété de la commune. */
export const LOGO = {
  /** Logo complet : monogramme « SA » et « Ville de Saint-Amand-Longpré ». */
  src: '/images/logo-saint-amand-longpre.svg',
  /** Monogramme seul (favicon, petits formats). */
  monogram: '/images/logo-monogramme.svg',
};

/** Blason historique, source du logo, et conditions de réutilisation (CC BY-SA 3.0). */
export const BLASON = {
  src: '/images/blason-saint-amand-longpre.svg',
  title: 'Blason ville fr Saint-Amand-Longpré (Loir-et-Cher).svg',
  blazon: 'foliolé d’or et de gueules',
  author: 'Spedona',
  authorUrl: 'https://commons.wikimedia.org/wiki/User:Spedona',
  sourceUrl:
    'https://commons.wikimedia.org/wiki/File:Blason_ville_fr_Saint-Amand-Longpr%C3%A9_(Loir-et-Cher).svg',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.fr',
};

/**
 * Données officielles de la commune (API Découpage administratif,
 * geo.api.gouv.fr, consultée le 29 septembre 2026) et identifiants publics.
 * Elles alimentent les données structurées, la page « La commune en bref » et llms.txt.
 */
export const COMMUNE = {
  name: 'Saint-Amand-Longpré',
  inseeCode: '41199',
  siren: '214101990',
  postalCode: '41310',
  /** Population légale publiée par l'Insee. */
  population: 1218,
  /** Superficie en km² (2 145,5 ha). */
  areaKm2: 21.46,
  department: { name: 'Loir-et-Cher', code: '41' },
  region: 'Centre-Val de Loire',
  intercommunality: {
    name: 'Communauté d’agglomération Territoires Vendômois',
    url: 'https://www.territoiresvendomois.fr/',
  },
  /** Fusion de Saint-Amand-de-Vendôme et Longpré. */
  mergedIn: 1965,
  wikidata: 'https://www.wikidata.org/wiki/Q1424723',
  wikipedia: 'https://fr.wikipedia.org/wiki/Saint-Amand-Longpr%C3%A9',
  servicePublic:
    'https://lannuaire.service-public.gouv.fr/centre-val-de-loire/loir-et-cher/f1da08a7-79ea-4936-bb6f-13c664bd657d',
  insee: 'https://www.insee.fr/fr/statistiques/2011101?geo=COM-41199',
};
