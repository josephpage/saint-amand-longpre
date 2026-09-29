/**
 * Couleurs thématiques de la charte : chaque catégorie d'actualité prend la couleur de son
 * univers (rouge : vie locale et évènements ; vert sauge : nature ; bleu rivière : travaux et
 * informations pratiques ; or : enfance ; bleu nuit : institution). Classes Tailwind complètes,
 * pour que Tailwind les détecte.
 */
export type Tone = 'rouge' | 'sauge' | 'riviere' | 'jaune' | 'nuit';

const CATEGORY_TONES: Record<string, Tone> = {
  'Vie locale': 'rouge',
  'Vie associative': 'rouge',
  Solidarité: 'rouge',
  Environnement: 'sauge',
  Urbanisme: 'riviere',
  Éducation: 'jaune',
  Élections: 'nuit',
  'Vie municipale': 'nuit',
};

export const categoryTone = (category: string): Tone => CATEGORY_TONES[category] ?? 'nuit';

/** Étiquette pleine : texte blanc (ou bleu nuit sur l'or), contraste ≥ 4,5:1. */
export const CHIP: Record<Tone, string> = {
  rouge: 'bg-rouge text-white',
  sauge: 'bg-sauge-text text-white',
  riviere: 'bg-riviere-text text-white',
  jaune: 'bg-jaune text-nuit',
  nuit: 'bg-nuit text-white',
};

/** Pastille d'icône : fond clair et pictogramme coloré. */
export const BADGE: Record<Tone, string> = {
  rouge: 'bg-rouge-soft text-rouge',
  sauge: 'bg-sauge-soft text-sauge-text',
  riviere: 'bg-riviere-soft text-riviere-text',
  jaune: 'bg-jaune-soft text-nuit',
  nuit: 'bg-sable-dark text-nuit',
};

/** Aplat sombre des tuiles sans photo. */
export const SURFACE: Record<Tone, string> = {
  rouge: 'bg-rouge',
  sauge: 'bg-sauge-text',
  riviere: 'bg-riviere-text',
  jaune: 'bg-[#8a6a00]',
  nuit: 'bg-nuit',
};
