import { expect, test } from '@playwright/test';

test.describe('Accueil', () => {
  test('présente la commune et les accès principaux', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Mairie de Saint-Amand-Longpré (Loir-et-Cher)');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Saint-Amand-Longpré, au quotidien',
    );
    for (const name of [
      'Faire une démarche',
      'École et enfance',
      'Urbanisme',
      'Signaler un problème',
    ]) {
      await expect(
        page.locator('main').getByRole('link', { name, exact: true }).first(),
      ).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Actualités de la commune' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Vos démarches les plus demandées' }),
    ).toBeVisible();
  });

  test('affiche l’alerte en cours une seule fois, dans « À la une »', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('À la une')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Informations importantes' })).toHaveCount(0);
  });

  test('calcule le statut d’ouverture de la mairie', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-opening-status]').first()).toHaveText(
      /Mairie (ouverte|fermée)/,
    );
  });

  test('liste les prochains rendez-vous', async ({ page }) => {
    await page.goto('/');
    const agenda = page.locator('section', {
      has: page.getByRole('heading', { name: 'Prochains rendez-vous' }),
    });
    await expect(agenda.getByRole('article')).not.toHaveCount(0);
  });

  test('ne déborde pas horizontalement', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
