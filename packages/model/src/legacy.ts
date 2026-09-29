/**
 * Correspondance de secours entre les rubriques de l'ancien site et le nouveau.
 *
 * Les pages connues ont chacune leur redirection exacte (générée par le
 * scraper). Cette table sert pour tout le reste : pagination, filtres,
 * variantes d'adresse, anciennes pages jamais explorées. L'ordre compte : la
 * première règle dont le préfixe correspond l'emporte.
 */
export const LEGACY_FALLBACKS: readonly (readonly [prefix: string, to: string])[] = [
  ['/fr/actualite/', '/actualites/'],
  ['/fr/actualites/', '/actualites/'],
  ['/fr/association-actualite/', '/actualites/'],
  ['/fr/association-actualite-diaporama/', '/actualites/'],
  ['/fr/association-les-actualites/', '/vivre-ici/associations/'],
  ['/fr/association-diaporama/', '/vivre-ici/associations/'],
  ['/fr/association-contact/', '/vivre-ici/associations/'],
  ['/fr/association/', '/vivre-ici/associations/'],
  ['/fr/associations/', '/vivre-ici/associations/'],
  ['/fr/evenement/', '/agenda/'],
  ['/fr/evenements/', '/agenda/'],
  ['/fr/compte-rendu/', '/mairie/conseil-municipal/comptes-rendus/'],
  ['/fr/comptes-rendus/', '/mairie/conseil-municipal/comptes-rendus/'],
  ['/fr/municipalreport/', '/mairie/conseil-municipal/comptes-rendus/'],
  ['/fr/conseil-municipal-profil/', '/mairie/conseil-municipal/elus/'],
  ['/fr/conseil-municipal/', '/mairie/conseil-municipal/elus/'],
  ['/fr/salle-municipale-reservation/', '/demarches/louer-une-salle/'],
  ['/fr/salle-municipale-diaporama/', '/demarches/louer-une-salle/'],
  ['/fr/salle-municipale/', '/demarches/louer-une-salle/'],
  ['/fr/salles-municipales/', '/demarches/louer-une-salle/'],
  ['/fr/numeros-utiles/', '/demarches/numeros-utiles/'],
  ['/fr/usefulnumber/', '/demarches/numeros-utiles/'],
  ['/fr/commerce-contact/', '/vivre-ici/commerces-et-entreprises/'],
  ['/fr/commerces/', '/vivre-ici/commerces-et-entreprises/'],
  ['/fr/artisans/', '/vivre-ici/commerces-et-entreprises/'],
  ['/fr/entreprises/', '/vivre-ici/commerces-et-entreprises/'],
  ['/fr/en-images-diaporama/', '/decouvrir/photos/'],
  ['/fr/en-images/', '/decouvrir/photos/'],
  ['/fr/en-videos/', '/decouvrir/photos/'],
  ['/fr/marche-public/', '/mairie/marches-publics/'],
  ['/fr/marches-publics/', '/mairie/marches-publics/'],
  ['/fr/demarches-en-ligne/', '/demarches/en-ligne/'],
  ['/fr/online_procedures/', '/demarches/en-ligne/'],
  ['/fr/onlineprocedures/', '/demarches/en-ligne/'],
  ['/fr/liens-externes/', '/'],
  ['/fr/petite-annonce/', '/'],
  ['/fr/petites-annonces/', '/'],
  ['/fr/information/', '/plan-du-site/'],
  ['/fr/', '/'],
  ['/mobile/', '/'],
];

/** Nouvelle adresse de secours pour un ancien chemin (sans barre finale ni requête). */
export function legacyFallback(path: string): string {
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return LEGACY_FALLBACKS.find(([prefix]) => normalized.startsWith(prefix))?.[1] ?? '/';
}
