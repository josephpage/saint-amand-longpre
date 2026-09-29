import { slugify } from '@sal/model';
import { PAGE_PATHS } from './config.ts';

/** Mots entiers, insensible à la casse, compatible avec les lettres accentuées. */
const words = (pattern: string) => new RegExp(`(?<!\\p{L})(?:${pattern})(?!\\p{L})`, 'iu');

const CATEGORY_RULES: [RegExp, string][] = [
  [words('plu|pluih?|urbanisme|permis|cadastre|travaux|voirie'), 'Urbanisme'],
  [
    words('s[ée]cheresse|eau|d[ée]chets?|environnement|arbres?|nature|brûlage|incendie'),
    'Environnement',
  ],
  [words('[ée]lections?|scrutin|vote|bureau de vote|listes? [ée]lectorales?'), 'Élections'],
  [words('canicule|ccas|s[ée]niors?|solidarit[ée]|vaccination|sant[ée]'), 'Solidarité'],
  [words('[ée]coles?|scolaire|cantine|p[ée]riscolaire|centre de loisirs|enfants?'), 'Éducation'],
  [
    words('conseil municipal|budget|d[ée]lib[ée]rations?|recensement de la population'),
    'Vie municipale',
  ],
];

/** Déduit la catégorie d'une actualité à partir de son titre et de son texte. */
export function categorizeNews(title: string, body: string): string {
  for (const [re, label] of CATEGORY_RULES) if (re.test(title)) return label;
  for (const [re, label] of CATEGORY_RULES) if (re.test(body)) return label;
  return 'Vie locale';
}

/**
 * Calcule le chemin d'une page d'information dans la nouvelle arborescence :
 * chemin imposé par la table de correspondance, sinon chemin du parent suivi
 * du slug du titre, sinon rubrique « Vivre ici » par défaut.
 */
export function resolvePagePath(
  oldPath: string,
  titleOf: (oldPath: string) => string,
  parentOf: (oldPath: string) => string | undefined,
  seen: Set<string> = new Set(),
): string {
  const mapped = PAGE_PATHS[oldPath];
  if (mapped) return mapped;
  if (seen.has(oldPath)) return `/vivre-ici/${slugify(titleOf(oldPath))}/`;
  seen.add(oldPath);
  const parent = parentOf(oldPath);
  const slug = slugify(titleOf(oldPath)) || 'page';
  if (parent) return `${resolvePagePath(parent, titleOf, parentOf, seen)}${slug}/`;
  return `/vivre-ici/${slug}/`;
}

/** Première ligne d'un chemin : la rubrique. */
export function sectionOf(path: string): string {
  return path.split('/').filter(Boolean)[0] ?? 'vivre-ici';
}

const FRENCH_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 2026-09-07 » → « 7 septembre 2026 ». */
export function formatFrenchDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${FRENCH_MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Normalise un numéro de téléphone français : « 0254735800 » → « 02 54 73 58 00 ». */
export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return input.trim();
}
