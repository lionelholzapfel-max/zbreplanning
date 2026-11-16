// Static configuration of the FPL mini-league: who is who, colours, stars, lore.
// Everything that is NOT derivable from the FPL API lives here.

export const FPL_LEAGUE_ID = 1774059;
export const FPL_LEAGUE_NAME = 'Ziarclays Zbremiership';
export const FPL_SEASON = '2026/27';

export type ManagerSlug = 'ramzi' | 'lionel' | 'greg' | 'edu';

export interface FplManager {
  slug: ManagerSlug;
  entryId: number;
  firstName: string;
  fullName: string;
  /** slug of the matching ZbrePlanning account (src/data/members.ts) */
  memberSlug: string;
  /** identity colour, reused everywhere (borders, chart lines, rings) */
  color: string;
  /** historical league titles */
  stars: number;
  ringName: string;
  tagline: string;
  bio: string[];
  /** one line per star, oldest first */
  starNotes: string[];
}

export const MANAGERS: FplManager[] = [
  {
    slug: 'ramzi',
    entryId: 111567,
    firstName: 'Ramzi',
    fullName: 'Ramzi Lahouegue',
    memberSlug: 'ramzi-lahouegue',
    color: '#28c060',
    stars: 5,
    ringName: 'Le Real Madrid de la FPL',
    tagline: 'Écossais-tunisien. Supporter du Celtic. Collectionneur de titres.',
    bio: [
      "Historiquement, c'est le Real Madrid de la FPL : cinq titres, des saisons propres, et cette manie agaçante de finir devant.",
      "Écossais-tunisien, il supporte le Celtic avec une loyauté qu'on ne peut qu'admirer, vu le niveau du Celtic.",
      'Quand Ramzi est derrière au classement, ce n’est pas une crise : c’est une remontada en préparation.',
    ],
    starNotes: [
      'Cinq titres : plus que les trois autres réunis',
      'Des résultats au sommet, saison après saison',
    ],
  },
  {
    slug: 'lionel',
    entryId: 8021863,
    firstName: 'Lionel',
    fullName: 'Lionel Holzapfel',
    memberSlug: 'lionel-holzapfel',
    color: '#2f6dff',
    stars: 2,
    ringName: 'L’Étoile Contestée',
    tagline: 'Deux étoiles. Une contestée. Zéro remords.',
    bio: [
      "Première étoile contestée : selon les autres, il n'y avait pas assez de bons joueurs. On était trois, dont Ramzi et Grégory. Question honnête : les Coupes du monde de l'Uruguay, elles sont contestées aussi ?",
      'Deuxième étoile : le Covid a failli la lui voler, mais il est revenu et a battu Grégory. Celle-là, personne ne la conteste.',
    ],
    starNotes: [
      'Étoile n°1 — contestée (trois joueurs, dont Ramzi et Grégory)',
      'Étoile n°2 — failli être volée par le Covid, Grégory battu quand même',
    ],
  },
  {
    slug: 'greg',
    entryId: 5108576,
    firstName: 'Greg',
    fullName: 'Grégory Longueville',
    memberSlug: 'gregory-longueville',
    color: '#f0743a',
    stars: 1,
    ringName: 'Le Dominateur d’une Saison',
    tagline: 'Toujours dans le haut du panier. Une année, il a tout écrasé.',
    bio: [
      'Grégory est souvent dans les meilleurs. Le genre de manager qu’on ne voit jamais couler.',
      'Une saison, il a dominé de bout en bout et a pris son étoile. Depuis, il cherche la deuxième.',
    ],
    starNotes: ['Étoile n°1 — une saison de domination totale'],
  },
  {
    slug: 'edu',
    entryId: 8210953,
    firstName: 'Edu',
    fullName: 'Edu Rodger Martinez',
    memberSlug: 'edu-rodger-martinez',
    color: '#f4c430',
    stars: 1,
    ringName: 'Le Miracle de Leicester',
    tagline: 'A choqué son monde l’année où Leicester a été champion.',
    bio: [
      "La saison où Leicester a gagné la Premier League, Edu a fait pareil en FPL : personne ne l'avait vu venir, il a tout dominé.",
      'Cette année, il est bien parti pour faire une très grosse saison. Les trois autres ont compris le danger.',
    ],
    starNotes: ['Étoile n°1 — la saison Leicester, le choc total'],
  },
];

export const MANAGER_BY_SLUG = Object.fromEntries(MANAGERS.map((m) => [m.slug, m])) as Record<
  ManagerSlug,
  FplManager
>;

export const MANAGER_BY_ENTRY = new Map(MANAGERS.map((m) => [m.entryId, m]));

export function managerForMember(memberSlug: string | undefined | null): FplManager | undefined {
  if (!memberSlug) return undefined;
  return MANAGERS.find((m) => m.memberSlug === memberSlug);
}

export function photoUrl(slug: ManagerSlug, variant: 'face' | 'full'): string {
  return `/api/fpl/photo/${slug}?v=${variant}`;
}

/** Rotating "the leader already gets the money" jokes ({name} = leader first name). */
export const IBAN_JOKES = [
  '{name}, je peux avoir ton IBAN ?',
  '{name}, envoie ton IBAN, on fait le virement maintenant, ça ira plus vite.',
  'Virement programmé pour {name}. Communication : « merci patron ».',
  '{name}, tu préfères le virement instantané ou on attend mai ?',
  'Quelqu’un a le RIB de {name} ? Demande pour un ami.',
  '{name}, on t’ajoute en bénéficiaire de confiance ?',
];

export function ibanJoke(name: string, seed: number): string {
  const tpl = IBAN_JOKES[Math.abs(seed) % IBAN_JOKES.length];
  return tpl.replaceAll('{name}', name);
}
