import { COMMUNE, LEGAL } from '../site.config.ts';
import type { Elected, Room, Settings } from './content/types.ts';
import { summarizeHours } from './hours.ts';
import type { Question } from './seo.ts';

export interface FaqInput {
  settings: Settings;
  elected: Elected[];
  rooms: Room[];
  siteUrl: string;
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;

/**
 * Questions fréquentes sur la commune, rédigées à partir des données du site :
 * les réponses restent justes quand la mairie modifie ses réglages.
 * Formulées comme les habitants et les assistants IA posent la question.
 */
export function buildFaq({ settings, elected, rooms, siteUrl }: FaqInput): Question[] {
  const url = (path: string) => new URL(path, siteUrl).toString();
  const hours = summarizeHours(settings.hours)
    .map((line) => `${line.days.toLowerCase()} : ${line.hours}`)
    .join(' ; ');
  const DAYS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const closed = [1, 2, 3, 4, 5, 6, 7]
    .filter((d) => !settings.hours.some((h) => h.day === d))
    .map((d) => DAYS[d]!);
  const closedText = closed.length ? ` Elle est fermée le ${list(closed)}.` : '';
  const mayor = elected.find((e) => e.role === 'maire');
  const deputies = elected.filter((e) => e.role === 'adjoint');
  const address = `${settings.street}, ${settings.postalCode} ${settings.city}`;
  const faq: Question[] = [
    {
      question: `Quels sont les horaires d’ouverture de la mairie de ${COMMUNE.name} ?`,
      answer: `La mairie de ${COMMUNE.name} est ouverte ${hours}.${closedText}`,
    },
    {
      question: `Comment contacter la mairie de ${COMMUNE.name} ?`,
      answer: `Par téléphone au ${settings.phone}, par e-mail à ${LEGAL.email}, par le formulaire de contact (${url('/contact/')}) ou sur place au ${address}.`,
    },
    {
      question: `Où se trouve la mairie de ${COMMUNE.name} ?`,
      answer: `La mairie est située ${address}, dans le département de ${COMMUNE.department.name} (${COMMUNE.department.code}).`,
    },
  ];
  if (mayor) {
    faq.push({
      question: `Qui est le maire de ${COMMUNE.name} ?`,
      answer: `${mayor.name} est maire de ${COMMUNE.name}.${
        deputies.length ? ` Adjoints : ${list(deputies.map((d) => d.name))}.` : ''
      } La composition complète du conseil municipal est publiée sur ${url('/mairie/conseil-municipal/elus/')}.`,
    });
  }
  faq.push(
    {
      question: `Combien d’habitants compte ${COMMUNE.name} ?`,
      answer: `${COMMUNE.name} compte ${COMMUNE.population.toLocaleString('fr-FR').replace(/\s/g, ' ')} habitants (population légale publiée par l’Insee), sur une superficie de ${COMMUNE.areaKm2.toLocaleString('fr-FR')} km².`,
    },
    {
      question: `Quels sont le code postal et le code Insee de ${COMMUNE.name} ?`,
      answer: `Le code postal est ${COMMUNE.postalCode} et le code officiel géographique (code Insee) est ${COMMUNE.inseeCode}.`,
    },
    {
      question: `À quelle intercommunalité appartient ${COMMUNE.name} ?`,
      answer: `${COMMUNE.name} fait partie de la ${COMMUNE.intercommunality.name}, dont le siège est à Vendôme.`,
    },
    {
      question: `D’où vient le nom de ${COMMUNE.name} ?`,
      answer: `La commune est née en ${COMMUNE.mergedIn} de la fusion de Saint-Amand-de-Vendôme et de Longpré.`,
    },
  );
  if (rooms.length) {
    faq.push({
      question: `Comment louer une salle communale à ${COMMUNE.name} ?`,
      answer: `La commune loue ${list(
        rooms.map((r) =>
          r.capacity
            ? `la ${r.title.toLowerCase()} (jusqu’à ${r.capacity} personnes)`
            : `la ${r.title.toLowerCase()}`,
        ),
      )}. Les tarifs et le règlement sont sur ${url('/demarches/louer-une-salle/')} ; la réservation se fait auprès de la mairie au ${settings.phone}.`,
    });
  }
  faq.push(
    {
      question: `Où consulter les comptes rendus du conseil municipal de ${COMMUNE.name} ?`,
      answer: `Les comptes rendus des séances sont publiés en PDF sur ${url('/mairie/conseil-municipal/comptes-rendus/')}.`,
    },
    {
      question: `Comment signaler un problème sur la voie publique à ${COMMUNE.name} ?`,
      answer: `Utilisez le formulaire ${url('/signaler-un-probleme/')} (voirie, éclairage, espaces verts, propreté), en joignant une photo si possible. En cas de danger immédiat, appelez le 112.`,
    },
  );
  return faq;
}
