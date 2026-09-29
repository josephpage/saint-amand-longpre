import { expect, test } from '@playwright/test';

test.describe('Redirections et erreurs', () => {
  test('redirige les anciennes adresses de façon permanente', async ({ request }) => {
    for (const [from, to] of [
      ['/fr/information/3512/etat-civil', '/demarches/etat-civil/'],
      ['/fr/actualites', '/actualites/'],
      ['/fr/salles-municipales', '/demarches/louer-une-salle/'],
      ['/fr/nous-contacter', '/contact/'],
    ]) {
      const res = await request.get(from!, { maxRedirects: 0 });
      expect(res.status(), from).toBe(301);
      expect(new URL(res.headers().location!, 'http://x').pathname).toBe(to);
    }
  });

  test('affiche une page 404 utile', async ({ page }) => {
    const res = await page.goto('/cette-page-n-existe-pas/');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Cette page est introuvable' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Rechercher sur le site' })).toBeVisible();
  });

  test('refuse une prévisualisation sans signature valide', async ({ page }) => {
    const res = await page.goto('/preview/?type=post&id=1&exp=9999999999&sig=faux');
    expect(res?.status()).toBe(403);
    await expect(page.getByText('Ce lien de prévisualisation n’est pas valide.')).toBeVisible();
  });

  test('refuse un envoi de formulaire venant d’un autre site', async ({ request }) => {
    const res = await request.post('/api/contact/', {
      multipart: { name: 'x' },
      headers: { origin: 'https://pirate.example' },
    });
    expect(res.status()).toBe(403);
  });

  test('refuse un envoi de formulaire incomplet', async ({ request }) => {
    // Astro refuse les envois sans en-tête Origin (protection CSRF), comme un navigateur l'enverrait.
    const res = await request.post('/api/contact/', {
      multipart: { name: 'x' },
      headers: { origin: 'http://localhost:4390' },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).errors.email).toBe('E-mail : ce champ est obligatoire.');
  });
});

test.describe('Référencement', () => {
  test('publie le plan du site et les données structurées', async ({ page, request }) => {
    expect((await request.get('/sitemap-index.xml')).status()).toBe(200);
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
    await page.goto('/');
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    );
    expect(jsonLd['@type']).toBe('GovernmentOffice');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.saintamandlongpre.fr/',
    );
  });
});

test.describe('Blason', () => {
  test('figure dans l’en-tête et le pied de page', async ({ page }) => {
    await page.goto('/');
    const src = '/images/blason-saint-amand-longpre.svg';
    await expect(page.locator(`header img[src="${src}"]`)).toBeVisible();
    await expect(page.locator(`footer img[src="${src}"]`)).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', src);
  });

  test('est crédité conformément à sa licence', async ({ page }) => {
    await page.goto('/mentions-legales/');
    const credits = page.locator('p', { hasText: 'Blason de Saint-Amand-Longpré' });
    await expect(credits.getByRole('link', { name: 'Spedona' })).toHaveAttribute(
      'href',
      /User:Spedona/,
    );
    await expect(credits.getByRole('link', { name: /CC BY-SA 3\.0/ })).toHaveAttribute(
      'href',
      /licenses\/by-sa\/3\.0/,
    );
    await expect(credits).toContainText('sans modification');
  });
});
