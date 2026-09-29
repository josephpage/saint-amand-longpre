import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { parseEventHeading, parseNumericDate, type EventTiming } from './dates.ts';

/** Pièce jointe ou image repérée dans une page, URL absolue. */
export interface RawFile {
  url: string;
  title: string;
}

export interface RawPage {
  title: string;
  html: string;
  attachments: RawFile[];
  gallery: RawFile[];
  children: { path: string; title: string }[];
}

const text = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function load(html: string): CheerioAPI {
  return cheerio.load(html);
}

export function pageTitle($: CheerioAPI): string {
  return text($('#col_center h1').first().text());
}

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function files($: CheerioAPI, base: string): RawFile[] {
  const out: RawFile[] = [];
  $('#file-attachments a.file').each((_, el) => {
    const url = absolute($(el).attr('href'), base);
    const title = text($(el).find('b').text()) || text($(el).attr('title'));
    if (url) out.push({ url, title });
  });
  return out;
}

function gallery($: CheerioAPI, base: string): RawFile[] {
  const out: RawFile[] = [];
  $('#picture_attachments a.lightbox, #thumbs a.thumb').each((_, el) => {
    const url = absolute($(el).attr('href'), base);
    if (url) out.push({ url, title: text($(el).attr('title')) });
  });
  return out;
}

/**
 * Contenu éditorial d'une page : tout ce qui suit l'en-tête dans la colonne
 * centrale, sans les blocs techniques (listes de sous-rubriques, pièces
 * jointes, diaporamas, formulaires, pagination).
 */
function mainHtml($: CheerioAPI): string {
  const main = $('#col_center').clone();
  main
    .find(
      '#head, #subcategories, #file-attachments, #diapo-attachments, .attachments, form, select, .filter_search, #paginator, script, style, .read_more, .clear, #controls, #slideshow, #caption, #thumbs',
    )
    .remove();
  return main.html() ?? '';
}

export function extractPage($: CheerioAPI, base: string): RawPage {
  const children: RawPage['children'] = [];
  $('#subcategories a').each((_, el) => {
    const href = $(el).attr('href');
    if (href) children.push({ path: href.replace(/\/+$/, ''), title: text($(el).text()) });
  });
  return {
    title: pageTitle($),
    html: mainHtml($),
    attachments: files($, base),
    gallery: gallery($, base),
    children,
  };
}

export interface RawNewsListItem {
  path: string;
  thumb?: string;
}

export function extractNewsList($: CheerioAPI, base: string): RawNewsListItem[] {
  const items: RawNewsListItem[] = [];
  $('#actus .info').each((_, el) => {
    const href = $(el).find('a[href*="/fr/actualite/"]').first().attr('href');
    if (!href) return;
    const thumb = absolute($(el).find('img').attr('src'), base) ?? undefined;
    items.push({ path: href, ...(thumb ? { thumb } : {}) });
  });
  return items;
}

export interface RawEvent extends RawPage {
  timing: EventTiming | null;
  location?: string;
  address?: string;
}

function infoPairs($: CheerioAPI, scope: string): Map<string, string> {
  const pairs = new Map<string, string>();
  $(`${scope} td.intitule`).each((_, el) => {
    const key = text($(el).text()).toLowerCase();
    const value = text($(el).next('td').text());
    if (key && value) pairs.set(key, value);
  });
  return pairs;
}

export function extractEvent($: CheerioAPI, base: string): RawEvent {
  const heading = text($('#event_details h2.titre2').first().text());
  const pairs = infoPairs($, '#event_details');
  const location = pairs.get('lieu');
  const address = pairs.get('adresse');
  return {
    title: pageTitle($),
    html: $('#event_desc').html() ?? '',
    attachments: files($, base),
    gallery: gallery($, base),
    children: [],
    timing: parseEventHeading(heading),
    ...(location ? { location } : {}),
    ...(address ? { address } : {}),
  };
}

export interface RawMeetingRow {
  date: string;
  title: string;
  detailPath?: string;
  reportUrl?: string;
}

export function extractMeetingRows($: CheerioAPI, base: string): RawMeetingRow[] {
  const rows: RawMeetingRow[] = [];
  $('table.lastreports tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    const date = parseNumericDate(text(cells.eq(0).text()));
    if (!date) return;
    const link = cells.eq(1).find('a').first();
    const report = absolute(cells.eq(2).find('a').attr('href'), base);
    rows.push({
      date,
      title: text(link.text()) || text(cells.eq(1).text()),
      ...(link.attr('href') ? { detailPath: link.attr('href')! } : {}),
      ...(report ? { reportUrl: report } : {}),
    });
  });
  return rows;
}

export interface RawCouncilMember {
  profilePath: string;
  name: string;
  role: 'maire' | 'adjoint' | 'conseiller';
}

export function extractCouncil($: CheerioAPI): RawCouncilMember[] {
  const members: RawCouncilMember[] = [];
  const seen = new Set<string>();
  $('#conseilmunicipal a[href*="conseil-municipal-profil"]').each((_, el) => {
    const href = $(el).attr('href')!.replace(/\/+$/, '');
    const name = text($(el).text());
    if (!name || seen.has(href)) return;
    seen.add(href);
    const container = $(el).closest('#maire, #adjoints, .categorie, div[id]');
    const id = (container.attr('id') ?? '').toLowerCase();
    const heading = text(container.find('h2').first().text()).toLowerCase();
    const role =
      id === 'maire'
        ? 'maire'
        : id === 'adjoints' || heading.includes('adjoint')
          ? 'adjoint'
          : 'conseiller';
    members.push({ profilePath: href, name, role });
  });
  return members;
}

export interface RawProfile {
  title: string;
  delegations: string;
  photo?: string;
}

export function extractProfile($: CheerioAPI, base: string): RawProfile {
  const photo = absolute($('#profil .photo img').attr('src'), base);
  return {
    title: text($('#profil .descr').text()),
    delegations: text($('#profil .titre').text()),
    ...(photo ? { photo } : {}),
  };
}

export interface RawRoom extends RawPage {
  photos: RawFile[];
}

export function extractRoom($: CheerioAPI, base: string): RawRoom {
  const photos: RawFile[] = [];
  $('#details a.lightbox, #details .diaporama a, #picture_attachments a').each((_, el) => {
    const url = absolute($(el).attr('href'), base);
    if (url && /\.(jpe?g|png|gif|webp)$/i.test(url))
      photos.push({ url, title: text($(el).attr('title')) });
  });
  const details = $('#details').clone();
  details.find('#file-attachments, .attachments, script').remove();
  return {
    title: pageTitle($),
    html: details.html() ?? '',
    attachments: files($, base),
    gallery: [],
    children: [],
    photos,
  };
}

/** Lit les capacités d'accueil écrites dans la description d'une salle. */
export function parseCapacity(description: string): { capacity?: number; seated?: number } {
  const t = description.replace(/\s+/g, ' ');
  const seated = /(\d+)\s*personnes?\s*assises/i.exec(t)?.[1];
  const standing = /(\d+)\s*(?:personnes?\s*)?debouts?/i.exec(t)?.[1];
  const upTo = /jusqu['’]à\s*(\d+)\s*personnes/i.exec(t)?.[1];
  const values = [seated, standing, upTo].filter(Boolean).map(Number);
  return {
    ...(values.length ? { capacity: Math.max(...values) } : {}),
    ...(seated ? { seated: Number(seated) } : {}),
  };
}

export interface RawDirectoryEntry {
  title: string;
  category?: string;
  html: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  logo?: string;
  detailPath?: string;
}

/**
 * Libellé de la catégorie d'une page de liste filtrée, lu dans la liste
 * déroulante (« Médecins (3 numéros) » → « Médecins »).
 */
export function categoryLabel($: CheerioAPI, path: string): string | undefined {
  let label: string | undefined;
  $('select.categories option').each((_, o) => {
    if (($(o).attr('value') ?? '').replace(/\/+$/, '') === path) label = text($(o).text());
  });
  const clean = label?.replace(/\s*\(\d+[^)]*\)$/, '').trim();
  return clean && !/^tou(te)?s\b/i.test(clean) ? clean : undefined;
}

export function extractAssociationLinks($: CheerioAPI): string[] {
  const out = new Set<string>();
  $('a[href*="/fr/association/1/"]').each((_, el) => {
    out.add($(el).attr('href')!.replace(/\/+$/, ''));
  });
  return [...out];
}

export function extractAssociation($: CheerioAPI, base: string): RawDirectoryEntry {
  const main = $('#associations').clone();
  const logo = absolute(main.find('.right img').attr('src'), base);
  main.find('.right, .infos, script, #file-attachments').remove();
  const pairs = infoPairs($, '#associations');
  const pick = (re: RegExp) => [...pairs.entries()].find(([k]) => re.test(k))?.[1];
  const website = pick(/site/);
  const phone = pick(/t[ée]l[ée]phone|portable/);
  const email = pick(/mail/);
  const address = pick(/adresse/);
  return {
    title: pageTitle($),
    html: main.html() ?? '',
    ...(logo ? { logo } : {}),
    ...(website ? { website } : {}),
    ...(phone ? { phone } : {}),
    ...(email && email.includes('@') ? { email } : {}),
    ...(address ? { address } : {}),
  };
}

export function extractBusinesses($: CheerioAPI): RawDirectoryEntry[] {
  const entries: RawDirectoryEntry[] = [];
  $('#company td').each((_, td) => {
    const name = text($(td).find('p.nom').first().text());
    if (!name) return;
    const cell = $(td).clone();
    const category = text(cell.find('p.activity').text());
    const address = text(cell.find('.icon-address').text());
    const phone = text(cell.find('.icon-phone').text());
    cell.find('p.nom, p.activity, span, a').remove();
    entries.push({
      title: name,
      html: cell.html() ?? '',
      ...(category ? { category } : {}),
      ...(address ? { address } : {}),
      ...(phone ? { phone } : {}),
    });
  });
  return entries;
}

export function extractNumbers($: CheerioAPI, category?: string): RawDirectoryEntry[] {
  const entries: RawDirectoryEntry[] = [];
  $('#usefulnum .content').each((_, el) => {
    const title = text($(el).find('.main_nom').text());
    if (!title) return;
    const subtitle = text($(el).find('p.nom').text());
    const phone = text($(el).find('.icon-phone').text());
    const html = $(el).find('.activity').html() ?? '';
    entries.push({
      title: subtitle ? `${title} – ${subtitle}` : title,
      html,
      ...(phone ? { phone } : {}),
      ...(category ? { category } : {}),
    });
  });
  return entries;
}

export function extractLinks($: CheerioAPI): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  $('#links a[href]').each((_, el) => {
    out.push({
      title: text($(el).find('span').first().text()) || text($(el).attr('title')),
      url: $(el).attr('href')!,
    });
  });
  return out;
}

export interface RawSettings {
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  hoursText: string;
  facebook?: string;
}

export function extractSettings($: CheerioAPI): RawSettings | null {
  const rows = $('#infospratiques_txt .infos tr');
  if (rows.length === 0) return null;
  const cellLines = (i: number) =>
    ($(rows.eq(i).find('td').eq(1)).html() ?? '')
      .split(/<br\s*\/?>/)
      .map((l) => text(cheerio.load(l).text()))
      .filter(Boolean);
  const address = cellLines(0);
  const phones = cellLines(1);
  const hoursText = cellLines(3).join('\n');
  const cityLine = address[1] ?? '';
  const m = /(\d[\d\s]{3,5})\s+(.+)/.exec(cityLine);
  const facebook = $('a[href*="facebook.com/"]').first().attr('href');
  return {
    street: address[0] ?? '',
    postalCode: (m?.[1] ?? '').replace(/\s/g, ''),
    city: m?.[2] ?? cityLine,
    phone: phones.find((p) => !/fax/i.test(p)) ?? '',
    hoursText,
    ...(facebook ? { facebook } : {}),
  };
}
