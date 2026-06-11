/**
 * Fun facts des 48 équipes de la Coupe du Monde 2026
 * Source: docs/zbre-team-facts.md
 *
 * Les clés correspondent EXACTEMENT aux noms d'équipe dans matches.json
 */

export interface TeamFacts {
  funny: string;  // 😂 Marrante
  smart: string;  // 🧠 Intelligente
  football: string; // ⚽ Footballistique
}

export const TEAM_FACTS: Record<string, TeamFacts> = {
  // === HÔTES ===
  'Canada': {
    funny: "Lors de son échange scolaire au Canada, Sacha a débaar au moins 5 meufs.",
    smart: "Le Canada contient environ 60 % des lacs de la planète — plus que tous les autres pays réunis.",
    football: "Présent en 1986 sans marquer un seul but : le tout premier but canadien en Coupe du Monde date de 2022 (Alphonso Davies).",
  },
  'USA': {
    funny: "Marek Korkoc, et non Marek Hamšík, a habité aux États-Unis dans sa jeunesse.",
    smart: "Les USA ont acheté l'Alaska à la Russie en 1867 pour 7,2 millions de dollars — environ 2 cents l'hectare.",
    football: "Leur meilleur résultat en Coupe du Monde reste... la toute première, en 1930 : demi-finale.",
  },
  'Mexique': {
    funny: "La tequila n'a légalement le droit de s'appeler tequila que si l'agave vient de régions précises — sinon c'est de la contrefaçon de cactus.",
    smart: "Mexico est construite sur un ancien lac et s'enfonce de plusieurs dizaines de centimètres par an.",
    football: "L'Estadio Azteca est le seul stade au monde à avoir accueilli deux finales de Coupe du Monde (1970, 1986) — et il ouvre celle-ci avec Mexique–Afrique du Sud.",
  },

  // === EUROPE ===
  'Allemagne': {
    funny: "Le mot allemand le plus long (63 lettres, une loi sur l'étiquetage de la viande bovine) a été supprimé du dictionnaire quand la loi a été abrogée.",
    smart: "L'Allemagne compte environ 25 000 châteaux.",
    football: "Auteur de la plus grande humiliation de l'histoire moderne : 7-1 contre le Brésil, chez lui, en demi-finale 2014.",
  },
  'Angleterre': {
    funny: "Le monarque britannique possède légalement tous les cygnes non marqués de la Tamise.",
    smart: "Le Royaume-Uni n'a pas de constitution écrite codifiée — tout repose sur des textes éparpillés et des traditions.",
    football: "Inventeurs du football, un seul titre (1966, à domicile) — et 60 ans de « It's coming home » depuis.",
  },
  'Autriche': {
    funny: "Un village autrichien au nom très célèbre sur internet a fini par se rebaptiser « Fugging » en 2021, lassé des vols de panneaux.",
    smart: "Vienne est régulièrement élue ville la plus agréable à vivre du monde.",
    football: "Le « Miracle de Cordoue » (1978) : l'Autriche bat l'Allemagne 3-2, événement quasi férié dans la mémoire nationale.",
  },
  'Belgique': {
    funny: "La Belgique a inventé les frites et passe le reste de son existence à devoir le prouver aux Français.",
    smart: "Record du monde : 541 jours sans gouvernement fédéral (2010-2011), et le pays a continué à tourner.",
    football: "La génération dorée est partie sans trophée — 3e place en 2018, meilleur résultat de l'histoire. À cette génération de faire mieux.",
  },
  'Bosnie-Herzégovine': {
    funny: "Mostar a érigé une statue de Bruce Lee comme symbole d'unité nationale — seule figure sur laquelle tout le monde était d'accord.",
    smart: "Le pays a trois présidents en même temps (présidence tripartite tournante).",
    football: "Qualifiée en éliminant l'Italie aux tirs au but en barrage — l'Italie manque ainsi sa 3e CDM consécutive.",
  },
  'Croatie': {
    funny: "Le dalmatien vient de Dalmatie, et la cravate vient des cavaliers croates (« hrvat » → cravate). Pays de 3,8 M d'habitants, influence mondiale.",
    smart: "La plage de Zlatni Rat change littéralement de forme selon le vent et les courants.",
    football: "Finale 2018 + demi-finale 2022 avec moins d'habitants que la Wallonie. Modrić, Ballon d'Or 2018, encore là à 40 ans.",
  },
  'Écosse': {
    funny: "L'animal national officiel de l'Écosse est la licorne. Vraiment.",
    smart: "L'Écosse compte environ 790 îles.",
    football: "Première qualification depuis 1998 — et c'est l'Écosse qui a disputé le tout premier match international de l'histoire (0-0 contre l'Angleterre, 1872).",
  },
  'Espagne': {
    funny: "Pays où notre chère Alba a été conçue, et où Saco a zbré dans le musée Picasso.",
    smart: "Chaque année à Buñol, 20 000 personnes se battent à coups de tomates (La Tomatina) — c'est organisé par la mairie.",
    football: "Championne d'Europe 2024 et seule nation à avoir gagné trois grands tournois d'affilée (Euro 2008, CDM 2010, Euro 2012). Favorite avec Yamal.",
  },
  'France': {
    funny: "Plus de 1 200 variétés de fromages, et toujours un seul Mbappé.",
    smart: "La France est le pays avec le plus de fuseaux horaires au monde (12, grâce aux territoires d'outre-mer).",
    football: "Championne 2018, finaliste 2022 à un cheveu — vise une 3e étoile en trois éditions.",
  },
  'Norvège': {
    funny: "Greg et Ramzi sont partis il y a quelques années en Norvège juste pour 2 filles norvégiennes qu'ils avaient rencontrées en Espagne.",
    smart: "La Garde royale norvégienne a fait chevalier un manchot du zoo d'Édimbourg : Sir Nils Olav, colonel en chef.",
    football: "La Norvège n'a JAMAIS perdu contre le Brésil. Et c'est la première CDM de Haaland.",
  },
  'Pays-Bas': {
    funny: "Les Néerlandais sont le peuple le plus grand du monde (~1m84 en moyenne chez les hommes).",
    smart: "Un tiers du pays est sous le niveau de la mer — l'aéroport de Schiphol aussi.",
    football: "Trois finales de Coupe du Monde (1974, 1978, 2010), trois défaites : la meilleure équipe à n'avoir jamais été championne.",
  },
  'Portugal': {
    funny: "Cristiano Ronaldo a un musée entièrement dédié à sa gloire, ouvert de son vivant, par lui-même.",
    smart: "La frontière Portugal-Espagne est la plus vieille frontière quasi inchangée d'Europe (traité de 1297).",
    football: "Ronaldo, 41 ans, devient le premier joueur de l'histoire à disputer 6 Coupes du Monde.",
  },
  'Suède': {
    funny: "En 2016, la Suède a créé un numéro de téléphone national : on appelait, et on tombait sur un Suédois au hasard qui devait répondre à vos questions.",
    smart: "La Suède n'a plus fait la guerre depuis 1814.",
    football: "Qualifiée en barrage grâce à Gyökeres — pendant que l'Italie regardera encore la CDM à la télé.",
  },
  'Suisse': {
    funny: "Le pays de Max Piquet, tout simplement.",
    smart: "La Suisse a assez d'abris antiatomiques pour toute sa population.",
    football: "12 participations, jamais une demi-finale. Mais l'élimination de la France à l'Euro 2021 (penalty de Mbappé sorti) reste un classique.",
  },
  'République tchèque': {
    funny: "La Tchéquie a refusé d'admettre que Jan Vomacka vient de ce pays. (Et sinon : les Tchèques sont les plus gros buveurs de bière au monde, ~180 L/an par habitant.)",
    smart: "Le château de Prague est le plus grand ensemble castral ancien du monde.",
    football: "La panenka s'appelle panenka parce qu'Antonín Panenka, tchèque, l'a inventée en finale de l'Euro 1976.",
  },
  'Turquie': {
    funny: "Benjamin Oyowe a récemment daté une jolie femme turque, il a débaar mais malheureusement pas zbré.",
    smart: "Istanbul est la seule grande ville au monde à cheval sur deux continents.",
    football: "But le plus rapide de l'histoire de la Coupe du Monde : Hakan Şükür, 10,8 secondes (2002) — l'année de leur 3e place.",
  },

  // === AMÉRIQUE DU SUD ===
  'Argentine': {
    funny: "L'Église Maradonienne existe vraiment : des milliers de fidèles, leur propre calendrier (l'an 1 = naissance de Diego), et des mariages célébrés.",
    smart: "En décembre 2001, l'Argentine a eu 5 présidents en moins de deux semaines.",
    football: "Championne en titre. Messi, 39 ans, pour la der des ders.",
  },
  'Brésil': {
    funny: "Une île brésilienne (Ilha da Queimada Grande) est interdite aux humains : jusqu'à un serpent venimeux par mètre carré.",
    smart: "Le Brésil partage une frontière avec tous les pays d'Amérique du Sud sauf deux (Chili et Équateur).",
    football: "Seul pays présent à TOUTES les Coupes du Monde, 5 étoiles — et désormais un sélectionneur italien, Ancelotti.",
  },
  'Colombie': {
    funny: "Les hippopotames échappés du zoo de Pablo Escobar prolifèrent toujours dans les rivières colombiennes — plus de 150 aujourd'hui.",
    smart: "La Colombie est le pays avec le plus d'espèces d'oiseaux au monde.",
    football: "James Rodríguez, meilleur buteur de la CDM 2014 avec LE but volé de plein fouet contre l'Uruguay.",
  },
  'Équateur': {
    funny: "Le pays s'appelle littéralement « la ligne imaginaire » (l'équateur), et il a construit un monument dessus... légèrement au mauvais endroit (240 m à côté).",
    smart: "Le sommet du Chimborazo est le point de la Terre le plus éloigné de son centre — plus que l'Everest.",
    football: "En 2022, l'Équateur est devenu la première équipe de l'histoire à battre le pays hôte en match d'ouverture (2-0 contre le Qatar).",
  },
  'Paraguay': {
    funny: "Le drapeau du Paraguay est le seul drapeau national au monde avec un recto et un verso différents.",
    smart: "Le barrage d'Itaipú fournit environ 90 % de l'électricité du pays.",
    football: "José Luis Chilavert, gardien de but légendaire, tirait les coups francs et penaltys : 8 buts en sélection.",
  },
  'Uruguay': {
    funny: "L'ex-président Mujica donnait 90 % de son salaire à des œuvres et venait au palais présidentiel dans sa vieille Coccinelle.",
    smart: "Premier pays au monde à avoir légalisé entièrement le cannabis (2013).",
    football: "3,4 millions d'habitants, premier champion du monde (1930), auteur du Maracanazo (1950) — et ils revendiquent 4 étoiles sur le maillot.",
  },

  // === AFRIQUE ===
  'Afrique du Sud': {
    funny: "Des manchots vivent sur les plages du Cap, entre les serviettes des touristes (Boulders Beach).",
    smart: "Le pays a trois capitales : Pretoria (exécutif), Le Cap (législatif), Bloemfontein (judiciaire).",
    football: "Premier hôte africain de l'histoire (2010)... et premier hôte éliminé dès le 1er tour. Elle ouvre cette CDM contre le Mexique à l'Azteca.",
  },
  'Algérie': {
    funny: "Vu les origines de la moitié des Bleus historiques (Zidane, Benzema...), l'Algérie aurait pu aligner deux équipes de France.",
    smart: "Plus grand pays d'Afrique — plus de 80 % de son territoire est dans le Sahara.",
    football: "La « honte de Gijón » (1982) : l'arrangement Allemagne-Autriche qui élimina l'Algérie a forcé la FIFA à inventer les matchs simultanés en fin de poule.",
  },
  'Cap-Vert': {
    funny: "Il y a plus de Cap-Verdiens vivant à l'étranger que dans le pays lui-même.",
    smart: "Archipel volcanique totalement inhabité avant l'arrivée des Portugais au XVe siècle.",
    football: "Première Coupe du Monde de son histoire — ~525 000 habitants, deuxième plus petite nation qualifiée de tous les temps.",
  },
  "Côte d'Ivoire": {
    funny: "Lionel y a habité pendant 4 mois.",
    smart: "Premier producteur mondial de cacao : environ 40 % du chocolat de la planète commence ici.",
    football: "En 2005, l'appel de Didier Drogba à genoux après la qualification a contribué à un cessez-le-feu dans la guerre civile.",
  },
  'Égypte': {
    funny: "Les Égyptiens anciens vénéraient les chats. Les Égyptiens modernes vénèrent Salah. Le progrès est discutable.",
    smart: "La grande pyramide de Gizeh a été le plus haut bâtiment du monde pendant 3 800 ans.",
    football: "Adversaire de la Belgique en poules ! Salah pour sa 2e CDM — la première s'était finie en larmes d'épaule (Ramos, 2018).",
  },
  'Ghana': {
    funny: "Au Ghana, on enterre les gens dans des cercueils fantaisie : en forme de poisson, d'avion, de bouteille de Coca — selon la passion du défunt.",
    smart: "Le lac Volta est le plus grand lac artificiel du monde en superficie.",
    football: "La main de Suárez sur la ligne (2010) a privé le Ghana d'une demi-finale historique. La vengeance de 2022 a raté aussi. La rancune est éternelle.",
  },
  'Maroc': {
    funny: "Ian y habite pour le moment.",
    smart: "L'université Al Quaraouiyine de Fès (fondée en 859) est la plus ancienne université du monde encore en activité.",
    football: "Premier pays africain de l'histoire en demi-finale de Coupe du Monde (2022).",
  },
  'RD Congo': {
    funny: "Lionel devait naître à Kinshasa mais a dû ziar à cause de la guerre.",
    smart: "Le fleuve Congo est le plus profond du monde : plus de 220 mètres par endroits.",
    football: "Le plus grand club du pays est le TP Mazembe. Le Zaïre de 1974 reste célèbre pour Mwepu Ilunga sortant du mur dégager un coup franc avant le coup de sifflet — retour en CDM après 52 ans d'absence.",
  },
  'Sénégal': {
    funny: "Le Monument de la Renaissance africaine à Dakar est plus haut que la statue de la Liberté.",
    smart: "L'île de Gorée, au large de Dakar, est l'un des lieux de mémoire de la traite atlantique les plus visités au monde.",
    football: "2002 : pour son premier match de CDM, le Sénégal bat la France championne du monde en titre. Et devinez qui est dans son groupe cette année ? La France.",
  },
  'Tunisie': {
    funny: "Ramzi Lahouegues est né sur une plage de ce pays.",
    smart: "Tatooine, la planète de Star Wars, tire son nom de la vraie ville tunisienne de Tataouine, où des scènes ont été tournées.",
    football: "Première équipe africaine à gagner un match de Coupe du Monde (3-1 contre le Mexique, 1978).",
  },

  // === ASIE ===
  'Arabie Saoudite': {
    funny: "Le pays construit une ville en ligne droite de 170 km de long (The Line). Personne ne sait si c'est génial ou complètement fou.",
    smart: "L'Arabie saoudite n'a aucune rivière permanente sur tout son territoire.",
    football: "Auteure du plus gros choc de 2022 : victoire contre l'Argentine — la seule défaite des futurs champions.",
  },
  'Australie': {
    funny: "L'Australie a officiellement perdu une guerre contre des émeus (la « Grande Guerre des Émeus », 1932 — les émeus ont gagné).",
    smart: "Il y a plus de kangourous que d'habitants en Australie.",
    football: "Record mondial de la plus large victoire internationale : Australie 31-0 Samoa américaines (2001), 13 buts pour Archie Thompson.",
  },
  'Corée du Sud': {
    funny: "Jusqu'en 2023, les bébés coréens naissaient avec « 1 an » : le pays a aboli son système d'âge et tout le monde a rajeuni d'un coup.",
    smart: "L'alphabet coréen (hangul) a été inventé au XVe siècle par un roi pour que le peuple puisse apprendre à lire en quelques jours.",
    football: "Demi-finale 2002 à domicile : toujours le meilleur résultat asiatique de l'histoire. Son Heung-min en capitaine crépusculaire.",
  },
  'Irak': {
    funny: "Pour son barrage décisif au Mexique, l'équipe a voyagé TROIS JOURS depuis Bagdad, en commençant par la route jusqu'en Jordanie. Et elle a gagné.",
    smart: "La Mésopotamie, c'est ici : l'écriture est née sur ce territoire il y a 5 000 ans.",
    football: "Retour en Coupe du Monde 40 ans après 1986 — et un groupe avec la France et la Norvège. Bon courage.",
  },
  'Iran': {
    funny: "En Iran, le week-end c'est jeudi-vendredi. Le dimanche est un jour de travail comme un autre.",
    smart: "Les échecs et le polo trouvent leurs origines dans la Perse antique.",
    football: "Adversaire de la Belgique en poules ! Six CDM, jamais un 2e tour — mais une victoire mythique contre les USA en 1998, le match le plus politique de l'histoire.",
  },
  'Japon': {
    funny: "Le Japon compte environ un distributeur automatique pour 25 habitants. On y vend à peu près tout.",
    smart: "Le retard moyen du Shinkansen se compte en secondes — et la compagnie s'excuse publiquement au-delà d'une minute.",
    football: "A battu l'Allemagne ET l'Espagne en 2022. Et ses supporters nettoient les tribunes après chaque match, victoire ou défaite.",
  },
  'Jordanie': {
    funny: "Dans la mer Morte, il est physiquement impossible de couler. Le selfie en lisant le journal est obligatoire.",
    smart: "Pétra, la cité taillée dans la roche, est l'une des sept nouvelles merveilles du monde.",
    football: "Première Coupe du Monde de l'histoire du pays.",
  },
  'Ouzbékistan': {
    funny: "Ian est le seul type de la Zbreteam à avoir débaar une Ouzbek.",
    smart: "L'Ouzbékistan est l'un des deux seuls pays au monde « doublement enclavés » : il faut traverser au moins deux pays pour atteindre la mer (l'autre, c'est le Liechtenstein).",
    football: "Première Coupe du Monde de l'histoire du pays — et un groupe relevé avec le Portugal et la Colombie.",
  },
  'Qatar': {
    funny: "Le Qatar a dépensé environ 220 milliards pour sa CDM 2022... et a perdu ses trois matchs.",
    smart: "Près de 90 % de la population du pays est étrangère.",
    football: "Pire performance d'un pays hôte de l'histoire (2022, 0 point) — mais cette fois, il s'est qualifié sur le terrain.",
  },

  // === AMÉRIQUE DU NORD & CARAÏBES ===
  'Curaçao': {
    funny: "Oui, la liqueur bleue de vos pires cocktails vient bien de là. Un pays-cocktail en Coupe du Monde.",
    smart: "~150 000 habitants : la plus petite nation jamais qualifiée pour une Coupe du Monde.",
    football: "Qualifiée sous Dick Advocaat, doyen des sélectionneurs du tournoi — et première CDM de son histoire.",
  },
  'Haïti': {
    funny: "Haïti et le Liechtenstein ont découvert aux JO de 1936 qu'ils avaient exactement le même drapeau, sans le savoir. Les deux ont ajouté un emblème depuis.",
    smart: "Première république noire indépendante de l'histoire (1804).",
    football: "Retour 52 ans après 1974 — qualifiée sans pouvoir jouer un seul match à domicile pendant les éliminatoires.",
  },
  'Panama': {
    funny: "Le canal de Panama fait gagner ~13 000 km aux bateaux — et le pays encaisse un péage qui peut dépasser le million de dollars par passage.",
    smart: "Le Panama est le seul endroit au monde où l'on peut voir le soleil se lever sur le Pacifique et se coucher sur l'Atlantique (grâce à la forme en S de l'isthme).",
    football: "Son premier but en CDM (2018, contre l'Angleterre à 6-0) a été fêté comme un titre mondial : jour quasi férié.",
  },

  // === OCÉANIE ===
  'Nouvelle-Zélande': {
    funny: "Le pays a employé un sorcier officiel (\"Wizard of New Zealand\"), payé par l'État, jusqu'en 2021.",
    smart: "Premier pays au monde à accorder le droit de vote aux femmes (1893).",
    football: "Seule équipe INVAINCUE de la CDM 2010 (3 nuls)... éliminée quand même au 1er tour. Adversaire de la Belgique en poules !",
  },
};

/**
 * Get facts for a team by name
 */
export function getTeamFacts(teamName: string): TeamFacts | null {
  return TEAM_FACTS[teamName] || null;
}

/**
 * Get all team names that have facts
 */
export function getTeamsWithFacts(): string[] {
  return Object.keys(TEAM_FACTS);
}
