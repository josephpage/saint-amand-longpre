import { expect, test } from '@playwright/test';

test.describe('Contenus', () => {
  test('liste les actualités avec pagination', async ({ page }) => {
    await page.goto('/actualites/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Actualités');
    await expect(page.locator('main article')).toHaveCount(12);
    await page.getByRole('link', { name: 'Plus anciennes' }).click();
    await expect(page).toHaveURL(/\/actualites\/2\/$/);
  });

  test('ouvre une actualité', async ({ page }) => {
    await page.goto('/actualites/');
    const first = page.locator('main article').first().getByRole('link');
    const title = await first.innerText();
    await first.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByText(/Publiée le/)).toBeVisible();
  });

  test('présente les élus et les comptes rendus', async ({ page }) => {
    await page.goto('/mairie/conseil-municipal/elus/');
    await expect(page.getByRole('heading', { name: 'Le maire' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Les adjoints' })).toBeVisible();
    await page.goto('/mairie/conseil-municipal/comptes-rendus/');
    await expect(page.getByRole('link', { name: /Compte rendu \(PDF\)/ }).first()).toBeVisible();
  });

  test('présente les salles avec leur capacité', async ({ page }) => {
    await page.goto('/demarches/louer-une-salle/');
    await expect(page.getByText(/Jusqu’à \d+ personnes/).first()).toBeVisible();
    await page.getByRole('link', { name: 'Salle des fêtes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Salle des fêtes');
  });

  test('regroupe l’annuaire par catégorie', async ({ page }) => {
    await page.goto('/demarches/numeros-utiles/');
    await expect(page.getByRole('heading', { name: 'Numéros d’urgence' })).toBeVisible();
    await page.goto('/vivre-ici/commerces-et-entreprises/');
    await expect(page.getByRole('heading', { name: 'Commerces', level: 2 })).toBeVisible();
  });

  test('fournit l’agenda au format iCalendar', async ({ request }) => {
    const res = await request.get('/agenda.ics');
    expect(res.headers()['content-type']).toContain('text/calendar');
    expect(await res.text()).toContain('BEGIN:VCALENDAR');
  });
});
