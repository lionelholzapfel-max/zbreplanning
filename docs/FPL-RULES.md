# FPL 2026/27 : brief des règles pour le site de stats (état au 16 nov 2026, GW10 terminée)

Légende : [API] = vérifié sur l'API publique ce jour ; [PL] = article officiel premierleague.com ; [FFS] = Fantasy Football Scout ; [CONN] = connaissance générale des règles FPL, recoupée par une recherche mais PAS relue sur la page officielle des règles (la page fantasy.premierleague.com/help/rules est rendue en JS, WebFetch n'en a rien tiré) ; [?] = non vérifié.

## 1. Chips
- 8 chips au total : 2 jeux de 4 (wildcard, freehit, bboost, 3xc). [API chips + PL]
- Noms API : `wildcard`, `freehit`, `bboost` (Bench Boost), `3xc` (Triple Captain). Aucun chip `manager` / Assistant Manager dans `bootstrap-static.chips` : il est SUPPRIMÉ cette saison. [API + recherche web ; l'article PL sur les chips ne le mentionne pas]
- Fenêtres (champs `start_event` / `stop_event` de `chips`) [API] :
  - 1re moitié : wildcard et freehit GW2 à GW19 ; bboost et 3xc GW1 à GW19.
  - 2e moitié : les 4 chips GW20 à GW38.
  - Wildcard et Free Hit INTERDITS en GW1 (Bench Boost et Triple Captain autorisés en GW1 : 814 606 bboost et 250 816 3xc joués en GW1 dans `chip_plays`).
- Le 2e jeu se débloque au GW20. Les chips de la 1re moitié non utilisés avant la deadline du GW19 sont PERDUS, pas de report. [PL]
- Un seul chip actif par GW. Si Free Hit en GW19, pas de 2e Free Hit en GW20 (règle PL). [PL]
- Changement vs 2025/26 : aucun sur les chips (même structure à 2 jeux). Seule différence : Assistant Manager retiré (il avait été ajouté en 2025/26 pour quelques GW, usage unique ; à ne PAS modéliser). [PL pour le reste ; AM = recoupement web]
- Historique perso : `/api/entry/{id}/history/` -> `chips: [{name, time, event}]` (ex. `freehit` event 3, `wildcard` event 5, `3xc` event 7). `time` = moment d'activation, `event` = GW. Pas d'indicateur "jeu 1 / jeu 2" : le déduire de `event <= 19`.

## 2. Transferts
- 1 transfert gratuit par GW, cumulable jusqu'à 5 en banque. [PL + API `max_extra_free_transfers: 4`]
- Chaque transfert supplémentaire coûte 4 points (hit), déduits du total. [PL via recherche ; `transfers_cap: 20` dans game_config = limite technique]
- Pas de transferts gratuits supplémentaires en décembre cette saison (c'était la compensation AFCON 2025/26 ; pas d'AFCON en 2026/27). [PL + FFS]
- Wildcard : transferts illimités, permanents, sans hit. Free Hit : illimités pour 1 GW, l'équipe revient à l'état précédent au deadline suivant. [PL]
- Interaction avec la banque (non vérifiée mot pour mot sur la page officielle) [CONN] : wildcard et free hit ne consomment pas les transferts gratuits en banque et ne les font pas non plus augmenter ; la banque est conservée.
- Prix de vente : `element_sell_at_purchase_price: false`, `transfers_sell_on_fee: 0.5` (vente = achat + moitié du gain, arrondi vers le bas). [API]
- Dans l'API history : `event_transfers` (nb), `event_transfers_cost` (points de hit). ANOMALIE observée sur le compte 8021863 : GW3 (freehit) et GW5 (wildcard) montrent `event_transfers: 0`. Donc le compte de transferts d'un GW de chip n'est pas fiable : ne pas l'utiliser pour des stats "transferts joués" sans traiter les GW de chip à part. Aucun hit dans cet échantillon (tous à 0), donc forme du hit non observée.

## 3. Barème, bonus, finalisation
- Barème (extrait `game_config.scoring`) [API] : minutes 1 pt (<60) / 2 pts (60+) ; but GKP 10, DEF 6, MID 5, FWD 4 ; passe 3 ; clean sheet GKP/DEF 4, MID 1 ; 1 pt par 3 arrêts (`saves: 1` = par 3, confirmer côté stats) [?] ; penalty arrêté 5 ; penalty raté -2 ; jaune -1 ; rouge -3 ; csc -2 ; 2 buts encaissés = -1 pour GKP/DEF ; bonus 1 à 3.
- Defensive contribution (DefCon) : +2 pts, DEF 10 CBIT, MID/FWD 12 (CBIT + récupérations), GKP 0. [API `defensive_contribution` + PL]
- Bonus : top 3 BPS du match reçoit 3/2/1, égalités partagées (deux ex aequo 1res = 3 et 3, le 3e prend 1). [PL]
- Changement BPS 2026/27 : -1 BPS sur tacle subi supprimé ; CBI = 1 BPS par 3 (au lieu de par 2) ; arrêt hors surface (2 BPS) supprimé, arrêts normaux 2 BPS, arrêt de grosse occasion +1. [FFS]
- Nouveauté live : bonus PROJETÉ affiché dès la 20e minute de chaque match, et classements de mini-ligue/rang global mis à jour en direct. [PL + FFS]
- Quand le bonus est officiellement ajouté : [?] non trouvé noir sur blanc cette saison ; historiquement le bonus est confirmé peu après le coup de sifflet final de CHAQUE match (le `bonus` de `event/{gw}/live` reste 0 ou projeté avant). Pour le site : ne pas figer le score d'un joueur tant que le GW n'est pas `finished`.
- `finished` vs `data_checked` sur un event [API + PL] :
  - `finished` = tous les matchs joués, points calculés ; `data_checked` = vérification de fin de GW terminée, scores verrouillés (le "lockdown").
  - Nouveauté 2026/27 : le verrouillage passe de "1 h après le dernier coup de sifflet" à 09:00 heure UK le lendemain du dernier match du GW. [PL + FFS] Donc délai typique après le dernier match : de ~9 h à ~1 jour.
  - Attendre `data_checked: true` avant de publier un classement "officiel" / des blagues sur le vainqueur de la GW. Après data_checked les points peuvent encore bouger rarement (corrections de statistiques par Opta, un jour ou deux, très rare) [CONN, non chiffré].
- État actuel (16 nov) : GW1 à GW10 ont `finished: true` ET `data_checked: true` ; GW10 est `is_current: true`, GW11 `is_next: true` (deadline 21 nov 11:00 UTC). [API]

## 4. Capitaine, vice, auto-subs, chips dans les picks
- Capitaine x2, vice prend le brassard s'il/elle ne joue pas du tout (aucune minute et aucun carton) ; si capitaine ET vice ne jouent pas, personne n'est doublé. `sys_vice_captain_enabled: true`. [API + PL]
- Auto-subs : traités en fin de GW, par ordre de banc, uniquement si le titulaire n'a pas joué ; le gardien de banc ne remplace que le gardien ; formation minimale respectée (min 1 GKP, 3 DEF, 2 MID, 1 FWD : `squad_min_play` dans element_types). Un joueur "a joué" s'il est entré sur le terrain ou a reçu un carton. [PL]
- Triple Captain : capitaine x3. Si le capitaine ne joue pas, le x3 passe au vice ; si lui non plus, le chip est perdu sans être rendu. [PL]
- Bench Boost : les 4 remplaçants comptent (pas d'auto-sub utile). Free Hit / Wildcard : ne changent ni scoring ni multiplicateurs. [PL]
- Endpoint `/api/entry/{id}/event/{gw}/picks/` [API, vérifié GW10] : `active_chip` (null, ou "wildcard"/"freehit"/"bboost"/"3xc"), `automatic_subs` (liste), `entry_history` (points, total_points, rank, bank, value, event_transfers, event_transfers_cost, points_on_bench), `picks[]` avec `position` (1-11 titulaires, 12-15 banc), `multiplier` (0 banc, 1 normal, 2 capitaine, 3 capitaine en 3xc), `is_captain`, `is_vice_captain`. En Bench Boost les picks 12-15 ont multiplier 1. Dans picks, le multiplier reflète l'état APRES vice/auto-sub une fois le GW fini ; pendant le GW, recalculer soi-même.
- Pour les points d'un joueur : `/api/event/{gw}/live/` -> `elements[].stats.total_points` et `explain[]` (détail par fixture, utile pour DGW).

## 5. Deadlines, DGW/BGW
- Deadline = 90 min avant le premier match du GW (pas de champ dédié ; `deadline_time` UTC, ex. GW11 = 2026-11-21 11:00 UTC). [CONN + API `deadline_time`] Elles varient fortement d'un GW à l'autre (11:00, 12:30, 13:30, 17:30, 18:00, 18:30 UTC) : toujours lire `events[].deadline_time`.
- Deadline GW19 (fin du 1er jeu de chips) : l'API affiche 2027-01-01 18:30 UTC (vendredi), alors que l'article PL de juillet annonce samedi 2 janvier 13:30 GMT. L'API a la priorité (calendrier réaménagé depuis) ; à revérifier dans les semaines qui précèdent. [API vs PL, contradiction]
- Deadlines à venir [API] : GW11 21 nov, GW12 27 nov, GW13 1 déc, GW14 5 déc, GW15 12 déc, GW16 19 déc, GW17 26 déc, GW18 29 déc, GW19 1 jan, GW20 5 jan.
- Blank / double GW : `/api/fixtures/` ce jour = 10 matchs par GW de 1 à 38, AUCUN double ni blank pour l'instant. [API] Les prévisions (Ben Crellin via Fantasy Football Hub : blank GW30 finale de la Carabao Cup, double GW32, blank GW33 demi-finales FA Cup, double GW35/36) sont spéculatives ; FFS (9 nov) dit qu'aucun blank/double avant mi-mars. Traiter comme [?] et lire les fixtures en direct plutôt que coder des dates en dur. Le code doit gérer `explain[]` à plusieurs fixtures et les joueurs sans match.

## 6. Pièges pour des stats équitables entre amis
- Hits : `entry_history.points` = points BRUTS du GW (les 4 pts de hit ne sont pas retirés) ; `total_points` est NET (les hits y sont retirés). Vérifié sur 8021863 : total_points = cumul(points - event_transfers_cost) sur GW1-10 (aucun hit encore, mais l'identité tient). Pour un "score du GW" équitable, utiliser points - event_transfers_cost.
- Un GW avec chip (bboost) gonfle le score brut : proposer les stats "avec / sans" ou taguer le GW par `active_chip`. Free Hit : l'équipe de ce GW n'est pas l'équipe "réelle" ; ne pas la comparer avec les transferts.
- `rank` dans history = rang du GW, `overall_rank` = rang cumulé ; ce sont des rangs mondiaux, pas dans la ligue. Pour le classement de la ligue, calculer à partir de `total_points`.
- Classique : classement de ligue par total_points ; égalités : ordre par rang global (règle FPL classique, [CONN] non vérifiée).
- `points_on_bench` = points laissés sur le banc (stat de blague utile : GW10 du compte test = 28).
- Mois (`phases`) : 11 phases (Août GW1-2, Sept 3-5, Oct 6-9, Nov 10-12, Déc 13-18, Jan 19-23, Fév 24-27, Mars 28-30, Avr 31-33, Mai 34-38) pour des classements mensuels. [API]
- Prix : changements chaque nuit (`price_change_deadlines`), `value` = valeur d'équipe en dixièmes de £m (1019 = £101.9m), `bank` pareil. [API]
- Donnée GW en cours : ne pas publier de blague "vainqueur de la GW" avant `data_checked`. Avec le nouveau verrou à 09:00 UK le lendemain, attendre ce signal.
- Positions : 11 joueurs ont été reclassés cette saison (liste non récupérée) : utiliser `element_type` actuel de bootstrap-static, ne jamais mettre en cache d'une saison à l'autre. [PL]

## Sources
- https://www.premierleague.com/en/news/4679873/all-you-need-to-know-about-changes-to-fpl-for-202627
- https://www.premierleague.com/en/news/4679879/whats-happening-with-fpl-chips-in-202627
- https://www.fantasyfootballscout.co.uk/2026/07/20/fpl-2026-27-5-rule-changes-new-features-announced
- https://www.premierleague.com/en/news/2174909/fantasy-premier-league-how-to-play-the-rules
- https://www.premierleague.com/en/news/2174900/fpl-basics-explained-how-to-use-your-chips
- https://www.fantasyfootballscout.co.uk/2026/11/09/when-are-the-fpl-blank-and-double-gameweeks-in-2026-27
- API : bootstrap-static, fixtures, entry/8021863/history, entry/8021863/event/10/picks (consultés le 16 nov 2026)

## Non vérifié
Forme exacte d'un hit dans history ; moment exact d'ajout du bonus ; corrections après data_checked ; règle de départage des égalités de ligue ; interaction précise banque de transferts / wildcard / free hit ; liste des 11 reclassements ; dates des futurs blank/double ; valeur exacte du barème des arrêts.
