import { expect, test, type Page } from '@playwright/test';

/** Attend que le formulaire React soit hydraté (Astro retire alors l'attribut ssr). */
async function openForm(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

test.describe('Formulaire de contact', () => {
  test('signale les erreurs de saisie et place le focus sur le récapitulatif', async ({ page }) => {
    await openForm(page, '/contact/');
    await page.getByRole('button', { name: 'Envoyer le message' }).click();
    const summary = page.getByRole('alert').filter({ hasText: 'à corriger' });
    await expect(summary).toBeFocused();
    await expect(page.getByLabel(/E-mail/)).toHaveAttribute('aria-invalid', 'true');
    await summary.getByRole('link', { name: /Nom/ }).click();
    await expect(page.getByLabel(/Nom et prénom/)).toBeFocused();
  });

  test('envoie un message valide', async ({ page }) => {
    await openForm(page, '/contact/');
    await page.getByLabel(/Nom et prénom/).fill('Camille Martin');
    await page.getByLabel(/E-mail/).fill('camille@example.fr');
    await page.getByLabel(/Objet/).selectOption('Location de salle');
    await page
      .getByLabel(/Message/)
      .fill('Bonjour, la salle des fêtes est-elle disponible le 12 décembre ?');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Envoyer le message' }).click();
    await expect(page.getByRole('heading', { name: 'Message envoyé' })).toBeVisible();
  });
});

test.describe('Signaler un problème', () => {
  test('refuse un fichier qui n’est pas une image', async ({ page }) => {
    await openForm(page, '/signaler-un-probleme/');
    await page.getByLabel(/Photo/).setInputFiles({
      name: 'doc.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(
      page.getByText('Photo : formats acceptés JPEG, PNG, WebP ou HEIC.').first(),
    ).toBeVisible();
  });

  test('transmet un signalement avec photo', async ({ page }) => {
    await openForm(page, '/signaler-un-probleme/');
    await page.getByLabel(/Type de problème/).selectOption('Éclairage public');
    await page.getByLabel(/Lieu/).fill('Devant le 12 rue Jules Ferry');
    await page.getByLabel(/Description/).fill('Le lampadaire ne s’allume plus depuis trois jours.');
    await page.getByLabel(/Photo/).setInputFiles({
      name: 'lampadaire.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    });
    await page.getByLabel(/Nom et prénom/).fill('Camille Martin');
    await page.getByLabel(/E-mail/).fill('camille@example.fr');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(page.getByRole('heading', { name: 'Signalement transmis' })).toBeVisible();
  });
});
