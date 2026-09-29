import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test('ouvre et ferme un sous-menu au clavier', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Menu déroulant réservé aux grands écrans');
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Afficher le sous-menu Démarches' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.locator('#sous-menu-demarches').getByRole('link', { name: /[ÉE]tat civil/ }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('ouvre le menu mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Menu mobile');
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('#menu-mobile');
    await menu.getByText('Démarches', { exact: true }).click();
    await menu.getByRole('link', { name: /^[ÉE]tat civil$/ }).click();
    await expect(page).toHaveURL(/\/demarches\/etat-civil\/$/);
  });

  test('affiche le fil d’Ariane et les pages sœurs', async ({ page }) => {
    await page.goto('/demarches/etat-civil/passeport/');
    const crumbs = page.getByRole('navigation', { name: 'Fil d’Ariane' });
    await expect(crumbs.getByRole('link', { name: 'Démarches' })).toHaveAttribute(
      'href',
      '/demarches/',
    );
    await expect(crumbs.getByRole('link', { name: /[ÉE]tat civil/ })).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Dans cette rubrique' })
        .getByRole('link', { name: 'Passeport' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('propose un lien d’évitement vers le contenu', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page).toHaveURL(/#contenu$/);
  });

  test('chaque rubrique liste ses pages', async ({ page }) => {
    for (const [path, title] of [
      ['/mairie/', 'Ma mairie'],
      ['/demarches/', 'Démarches'],
      ['/vivre-ici/', 'Vivre ici'],
      ['/decouvrir/', 'Découvrir'],
    ]) {
      await page.goto(path!);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!);
      await expect(page.locator('main').getByRole('listitem').first()).toBeVisible();
    }
  });
});
