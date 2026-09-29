/** Transforme un libellé en identifiant d'URL : minuscules, sans accents, tirets. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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
