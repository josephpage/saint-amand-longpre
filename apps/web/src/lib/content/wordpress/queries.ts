const IMAGE = `sourceUrl altText mediaDetails { width height }`;
const PAGE_INFO = `pageInfo { hasNextPage endCursor }`;

const PAGE_FIELDS = `databaseId title uri content menuOrder excerpt modified`;
const POST_FIELDS = `databaseId slug title date modified content excerpt
  categories { nodes { name } }
  featuredImage { node { ${IMAGE} } }`;
const EVENT_FIELDS = `databaseId slug title modified content excerpt
  featuredImage { node { ${IMAGE} } }
  infosEvenement { debut fin journeeEntiere lieu adresse }`;
const ROOM_FIELDS = `databaseId slug title modified content excerpt
  featuredImage { node { ${IMAGE} } }
  infosSalle { capacite placesAssises }`;

export const SETTINGS_QUERY = `query Reglages {
  reglagesMairie {
    adresse codePostal commune telephone facebook latitude longitude population
    photoAccueil { ${IMAGE} }
    horaires { jour ouverture fermeture }
  }
  redirections { de vers }
}`;

export const PAGES_QUERY = `query Pages($after: String) {
  pages(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes { ${PAGE_FIELDS} }
  }
}`;

export const POSTS_QUERY = `query Actualites($after: String) {
  posts(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes { ${POST_FIELDS} }
  }
}`;

export const EVENTS_QUERY = `query Evenements($after: String) {
  evenements(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes { ${EVENT_FIELDS} }
  }
}`;

export const MEETINGS_QUERY = `query Seances($after: String) {
  seances(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes { databaseId title content infosSeance { date compteRendu { node { mediaItemUrl title } } } }
  }
}`;

export const ELECTED_QUERY = `query Elus($after: String) {
  elus(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes { databaseId title menuOrder featuredImage { node { ${IMAGE} } } infosElu { role fonction delegations } }
  }
}`;

export const ROOMS_QUERY = `query Salles($after: String) {
  salles(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes { ${ROOM_FIELDS} }
  }
}`;

export const DIRECTORY_QUERY = `query Annuaire($after: String) {
  fichesAnnuaire(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes {
      databaseId slug title content
      featuredImage { node { ${IMAGE} } }
      typesAnnuaire { nodes { slug } }
      categoriesAnnuaire { nodes { name } }
      infosAnnuaire { telephone email site adresse }
    }
  }
}`;

export const ALERTS_QUERY = `query Alertes($after: String) {
  alertes(first: 100, after: $after, where: { status: PUBLISH }) {
    ${PAGE_INFO}
    nodes { databaseId title content infosAlerte { niveau lien expiration } }
  }
}`;

export const PREVIEW_QUERY = `query Previsualisation($id: ID!, $asPreview: Boolean) {
  contentNode(id: $id, idType: DATABASE_ID, asPreview: $asPreview) {
    __typename
    ... on Page { ${PAGE_FIELDS} }
    ... on Post { ${POST_FIELDS} }
    ... on Evenement { ${EVENT_FIELDS} }
    ... on Salle { ${ROOM_FIELDS} }
  }
}`;
