import { expect, test } from '@playwright/test';

test('trouve une démarche par la recherche', async ({ page }) => {
  await page.goto('/recherche/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Rechercher sur le site' }).fill('passeport');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByText(/résultats? pour « passeport »/)).toBeVisible();
  await expect(page.locator('main ol a[href="/demarches/etat-civil/passeport/"]')).toBeVisible();
});

test('reprend la recherche passée dans l’adresse', async ({ page }) => {
  await page.goto('/recherche/?q=salle%20des%20f%C3%AAtes');
  await expect(page.getByRole('searchbox', { name: 'Rechercher sur le site' })).toHaveValue(
    'salle des fêtes',
  );
  await expect(page.getByText(/résultats? pour/)).toBeVisible();
});
