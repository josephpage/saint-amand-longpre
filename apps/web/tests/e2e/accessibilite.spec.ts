import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/demarches/',
  '/demarches/etat-civil/carte-nationale-d-identite/',
  '/actualites/',
  '/agenda/',
  '/mairie/conseil-municipal/elus/',
  '/mairie/conseil-municipal/comptes-rendus/',
  '/demarches/louer-une-salle/',
  '/vivre-ici/associations/',
  '/contact/',
  '/signaler-un-probleme/',
  '/recherche/',
  '/accessibilite/',
];

for (const path of PAGES) {
  test(`aucune erreur d’accessibilité automatique sur ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
}
