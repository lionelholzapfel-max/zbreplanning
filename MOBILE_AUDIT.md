# Audit mobile — ZbrePlanning (390 × 844)

Lecture seule, aucun fix. Branche `redesign/dark-premium`. Viewport réel iPhone
**390 × 844 @3x, isMobile + touch**. Captures : `design-shots/m-*.png`
(`npm run design:shots -- mobile`). Analyse = code (classes Tailwind → px) +
lecture des captures. 3 agents parallèles (home/login/worldcup · leaderboard/
predictions · games/activities/calendar/admin).

> **Artefact de capture** : les `m-*` fullPage neutralisent la navbar sticky du
> haut (`nav[class*="sticky"] → static`) pour éviter le re-paint mid-page. La
> **bottom tab bar reste fixe**. Sur un vrai téléphone le nav du haut = wordmark +
> avatar uniquement (liens `hidden md:flex`), la bottom bar gère la navigation.

---

## Point spécifique — bottom tab bar mobile ✅ EXISTE et est v2
`Navbar.tsx:123-141` : `<nav className="md:hidden fixed bottom-0 inset-x-0 z-50 …
pb-[env(safe-area-inset-bottom)]">`, tokens v2 (`--bg`/90 + blur, `--hairline`),
labels texte 11px, **actif = accent**. C'est bien LE pattern de navigation mobile,
préservé dans la refonte. Le `body` a `padding-bottom: calc(4rem + safe-area)`
sur mobile (`globals.css:104`) — mais plusieurs pages ajoutent une section
`pb-8`/`pb-12` insuffisante par-dessus (voir DÉGRADÉ ci-dessous).

## Bons points confirmés (ne pas toucher)
- **Aucun débordement horizontal de PAGE** nulle part (les blocs larges sont
  `overflow-x-auto` ou `truncate`/`overflow-hidden` — le scroll reste confiné).
- **Saisie de score world-cup = excellente au pouce** : inputs `w-14 h-14` (56px)
  + Valider `h-14` → grosses cibles, tient large sur 390px (`m-worldcup-match-open`).
- **Collapse du leaderboard exemplaire** : les 5 colonnes secondaires ET leur
  en-tête sont `hidden sm:flex` → masqués ensemble, zéro orphelin, il reste
  rang+avatar+nom+Pts.
- **Champs PIN login** `w-14 h-14` (56px) — bonnes cibles.
- **Aucun élément hover-only bloquant** : tous les `group-hover`/`hover:` ont une
  couleur de base lisible et sont enveloppés dans des `Link`/cibles tappables.
- Podium contenu (272px < 358px), pas d'overflow.

---

## 🔴 BLOQUANT (inutilisable au pouce)

1. **World-cup — étoiles favoris ~14px sans padding.** `world-cup/page.tsx:1011-1018`
   & `1030-1037` : le `<button>` ne contient qu'un `<Star className="w-3.5 h-3.5">`
   (14px), zéro padding → zone de tap ≈ 14px. Impossible à viser.
2. **Admin/results — l'édition inline écrase le contexte du match.** `results/page.tsx:241-271`
   & `302-321` : en édition, le cluster `shrink-0` (2 inputs + `:` + Valider +
   Annuler ≈ 240px) pousse les deux noms d'équipe (`flex-1 min-w-0`) à l'ellipse
   → **on ne voit plus quel match on saisit** au moment critique.

## 🟠 DÉGRADÉ (utilisable mais gênant — à corriger avant prod mobile)

**Cibles tactiles < 44px, généralisées** (pattern `h-8`=32px / `py-1.5`≈32px) :
| Zone | Taille | Réf |
|---|---|---|
| Segmented Général/Semaine/Live | ~32px | `leaderboard/page.tsx:427` |
| Segmented phases + participation world-cup | ~30px | `world-cup:826, 1165` |
| Chips filtres sticky world-cup | `h-8` 32px | `world-cup:786` |
| Chips groupes A-L | `w-9 h-9` 36px | `world-cup:842` |
| Boutons hero home | `h-9` 36px | `page.tsx:250,256` |
| Chips catégories activities | `h-8` 32px | `activities:163` |
| Segmented participation activities | ~32px | `activities:229` |
| Lien « Modifier » activities/predictions | ~20px (texte nu) | `activities:218`, `predictions:578` |
| Chips « Aller à » + flèches mois calendar | 32/36px | `calendar:135,151` |
| Cases jour calendar | ~38px | `calendar:175,194` |
| « + Jeu »/« + Partie » + segmented période games | 36/32px | `games:341,364` |
| Chips participants modale games | ~26px | `games:794,937` |
| Inputs score admin/results (section « avec résultat ») | `w-10 h-10` 40px | `results:309,317` |
| « Reset PIN » (destructif) | `h-8` 32px | `members:154` |
| Bouton fermeture modale activities | `w-8 h-8` 32px | `activities:285` |
| « Configurer mon PIN » login | `h-10` 40px | `login:335` |

**Contenu masqué par la bottom tab bar** (~72px) : sections en `pb-8`/`pb-12`
insuffisant → dernier élément partiellement caché sur **activities** (`:171`),
**calendar** (stats bas), **admin/results** (`py-8`), **admin/members** (`:113`,
Sam Spinnael). Seul **games** est correct (`pb-24` = 96px).

**Autres DÉGRADÉ :**
- **Home — countdown héros rogné à droite.** `page.tsx:303-315` : 4×`.score 56px`
  + 3 séparateurs `40px` dépassent 390px, l'unité SEC est coupée (`overflow-hidden`
  → pas de scroll page mais chiffre amputé). → `flex-col` ou réduire sur mobile.
- **Predictions — tableau « Les pronos du groupe ».** `predictions/page.tsx:633-684` :
  `table w-full` sans `nowrap` → wrapping agressif (« Bono (Yassine Bounou) » sur
  3 lignes) **+** 3 colonnes sur 7 hors écran au chargement (Gardien déjà coupé),
  sans affordance de scroll. Piste : `white-space:nowrap` + largeurs min, ou
  cartes empilées sur mobile.
- **Troncature de noms d'équipes** trop agressive : home « Prochains matchs »
  (`page.tsx:351` — « Argentine — Cap… »), world-cup (`:1010/1038` — « Afriqu… »),
  admin/results (~89px par nom → « Bosnie-Her… », « Nouvelle-Z… »).
- **Activities — « Créer une activité » casse sur 2 lignes** dans un `h-9` fixe
  (`activities:152`) → texte à l'étroit (le PageHeader comprime l'action).
- **Login — card `p-10`** (`login:225`) : ~278px internes pour une grille
  `grid-cols-4` d'avatars 72px → avatars compressés à ~53px. Réduire à `p-6` mobile.
- **Games — table ELO `min-w-[600px]`** (`games:418`) : colonnes de droite
  (Étoiles/Ratio/Parties) invisibles sans scroll horizontal interne.
- **Admin/results — ~105 lignes sans pagination** (`results:291`, capture ~16000px
  de haut) : scroll interminable + coût de rendu.

## ⚪ COSMÉTIQUE
- **Calendar — chiffres stats rognés** en haut du glyphe (`.score text-[40px]`
  interligne serré, `calendar:329`) — visible « 104 »/« 1 ».
- **Leaderboard Live — en-tête `Δ` légèrement désaligné** de sa colonne (pas de
  width fixe, `leaderboard:472` vs `508`).
- **Members — nom sans `truncate`** (`members:132`) : risque latent si nom long +
  badge ADMIN (pas de casse observée, Lionel = seul admin sans bouton Reset).
- **Calendar — panneau détail `sticky top-24`** en layout 1 colonne : flotte un peu
  au scroll.
- **Chrome hors-DA visible** : footers home/login (`❤️🇧🇪`), écran de chargement
  world-cup (spinner violet `#6366f1` + `text-gray-400` + `bg-[#0a0a0f]` codé en
  dur, `world-cup:772-800`), état vide world-cup (emoji 🔍), countdown lock 🔒.

---

## Synthèse & priorités
- **2 BLOQUANT** : étoiles favoris world-cup (14px) ; édition inline admin/results
  qui masque le match. → à régler avant tout usage mobile réel.
- **Le chantier DÉGRADÉ dominant est transverse** : un **pass "touch target 44px"**
  (agrandir `h-8`→`h-9`/`h-10`, ajouter padding aux étoiles/liens « Modifier », zones
  de tap sur les cases calendrier) réglerait la majorité des points d'un coup.
- **Un pass "padding-bottom mobile"** (`pb-24` comme games sur les 4 pages
  concernées) règle le masquage par la tab bar.
- **2 refontes ciblées** : le tableau predictions (nowrap/scroll ou cartes) et
  l'édition inline admin/results (garder le contexte du match).
- Le reste (troncatures, countdown home, card login, table ELO) = ajustements
  responsive ponctuels.

Rien à faire côté navigation : la bottom tab bar est en place et v2.
