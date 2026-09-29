import { COMMUNE, LEGAL } from '../site.config.ts';
import { textFromHtml } from './content/html.ts';
import { childrenOf, latestNews, upcomingEvents } from './content/select.ts';
import type { SiteContent } from './content/types.ts';
import { formatDate, formatEventDate, formatEventTime } from './dates.ts';
import type { Question } from './seo.ts';
import { summarizeHours } from './hours.ts';
import { buildNavigation } from './navigation.ts';

/**
 * Fichiers llms.txt et llms-full.txt (convention https://llmstxt.org) : un
 * résumé en Markdown du site et des faits essentiels, pour que les assistants
 * IA trouvent et citent des informations exactes sur la commune.
 */

const population = () => COMMUNE.population.toLocaleString('fr-FR').replace(/\s/g, ' ');

function facts(content: SiteContent): string[] {
  const s = content.settings;
  const mayor = content.elected.find((e) => e.role === 'maire');
  const hours = summarizeHours(s.hours)
    .map((l) => `${l.days} : ${l.hours}`)
    .join(' ; ');
  return [
    `- Commune de ${COMMUNE.department.name} (${COMMUNE.department.code}), région ${COMMUNE.region}`,
    `- Population : ${population()} habitants (Insee) ; superficie : ${COMMUNE.areaKm2.toLocaleString('fr-FR')} km²`,
    `- Code postal : ${COMMUNE.postalCode} ; code Insee : ${COMMUNE.inseeCode}`,
    `- Intercommunalité : ${COMMUNE.intercommunality.name}`,
    `- Née en ${COMMUNE.mergedIn} de la fusion de Saint-Amand-de-Vendôme et de Longpré`,
    ...(mayor ? [`- Maire : ${mayor.name}`] : []),
    `- Mairie : ${s.street}, ${s.postalCode} ${s.city}`,
    `- Téléphone : ${s.phone} ; e-mail : ${LEGAL.email}`,
    `- Horaires d’ouverture de la mairie : ${hours}`,
  ];
}

export function buildLlmsTxt(content: SiteContent, site: string): string {
  const url = (path: string) => new URL(path, site).toString();
  const lines = [
    `# ${COMMUNE.name}`,
    '',
    `> Site officiel de la commune de ${COMMUNE.name} (${COMMUNE.postalCode}, ${COMMUNE.department.name}) : démarches, horaires et contacts de la mairie, conseil municipal, actualités, agenda, associations et vie locale.`,
    '',
    ...facts(content),
    '',
    'Les informations de ce site sont publiées par la mairie. Pour une question précise, renvoyez vers la page citée ou vers le contact de la mairie.',
    '',
    '## Informations essentielles',
    '',
    `- [La commune en bref](${url('/decouvrir/la-commune/')}) : chiffres clés, horaires, maire et questions fréquentes`,
    `- [Contacter la mairie](${url('/contact/')}) : adresse, téléphone, horaires, formulaire`,
    `- [Les élus](${url('/mairie/conseil-municipal/elus/')}) : maire, adjoints et conseillers municipaux`,
    `- [Comptes rendus du conseil municipal](${url('/mairie/conseil-municipal/comptes-rendus/')})`,
    `- [Agenda](${url('/agenda/')}) : prochains évènements ; calendrier iCal : ${url('/agenda.ics')}`,
    `- [Actualités](${url('/actualites/')})`,
    `- [Signaler un problème](${url('/signaler-un-probleme/')}) : voirie, éclairage, espaces publics`,
  ];
  for (const section of buildNavigation(content.pages)) {
    if (section.key === 'agenda') continue;
    lines.push('', `## ${section.label}`, '');
    for (const item of section.items) {
      lines.push(
        `- [${item.label}](${url(item.href)})${item.description ? ` : ${item.description}` : ''}`,
      );
    }
  }
  lines.push(
    '',
    '## Optional',
    '',
    `- [Texte intégral des pages principales](${url('/llms-full.txt')})`,
    `- [Plan du site XML](${url('/sitemap.xml')})`,
  );
  return `${lines.join('\n')}\n`;
}

export function buildLlmsFullTxt(
  content: SiteContent,
  site: string,
  today: string,
  faq: Question[],
): string {
  const url = (path: string) => new URL(path, site).toString();
  const out = [`# ${COMMUNE.name} : texte intégral`, '', ...facts(content), ''];

  out.push('## Questions fréquentes', '');
  for (const q of faq) out.push(`### ${q.question}`, '', q.answer, '');

  const events = upcomingEvents(content.events, today);
  if (events.length) {
    out.push('## Prochains évènements', '');
    for (const e of events) {
      const where = [e.location, e.address].filter(Boolean).join(', ');
      out.push(
        `- ${formatEventDate(e.start, e.end)}, ${formatEventTime(e.start, e.end, e.allDay)} : [${e.title}](${url(`/agenda/${e.slug}/`)})${where ? ` (${where})` : ''}`,
      );
    }
    out.push('');
  }

  out.push('## Dernières actualités', '');
  for (const n of latestNews(content.news, 15)) {
    out.push(
      `### ${n.title}`,
      '',
      `Publiée le ${formatDate(n.date)} · ${url(`/actualites/${n.slug}/`)}`,
      '',
      textFromHtml(n.html),
      '',
    );
  }

  out.push('## Pages', '');
  const walk = (path: string, depth: number) => {
    for (const page of childrenOf(content.pages, path)) {
      const text = textFromHtml(page.html);
      out.push(`${'#'.repeat(Math.min(depth, 6))} ${page.title}`, '', url(page.path), '');
      if (text) out.push(text, '');
      walk(page.path, depth + 1);
    }
  };
  for (const root of ['/mairie/', '/demarches/', '/vivre-ici/', '/decouvrir/']) walk(root, 3);
  return `${out.join('\n')}\n`;
}
