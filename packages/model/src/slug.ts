/**
 * Transforme un libellé en identifiant d'URL : minuscules, sans accents, tirets.
 * WordPress refuse les identifiants purement numériques (ils entrent en conflit
 * avec ses archives par date) : « 2025 » devient « annee-2025 ».
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!/^\d+$/.test(slug)) return slug;
  return slug.length === 4 ? `annee-${slug}` : `numero-${slug}`;
}

/** Retourne un slug unique en suffixant -2, -3… si nécessaire. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  let candidate = base || 'sans-titre';
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}
