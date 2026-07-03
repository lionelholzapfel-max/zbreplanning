# ZbrePlanning — Audit design & données (cartographie complète)

Branche `redesign/dark-premium`. Lecture seule (aucune logique modifiée).
Référentiel : `DESIGN_DIRECTION.md` v2 « Tableau d'affichage » (noir teinté vert
`--canvas`/`--surface-1..4`, accent vert `#34D399`, or `#E8B93E` réservé
Drère/1ᵉ place, Space Grotesk `.score`/`.display`, interdits : emojis/exclamations/
violet/gradients/bordures-par-défaut dans le chrome).

## Captures (design-shots/, gitignoré — `npm run design:shots`)
`01-home` · `02-login` · `03-worldcup-default` · `04-worldcup-groups` ·
`05-worldcup-knockout` · `06-predictions` · `07-leaderboard` · `08-games` ·
`09-activities` · `10-calendar` · `11-admin-results` · `12-admin-members`
(+ crops home : `home-hero/stats/next-match/matches`). Viewport 1440×900 @2x, dark.

---

## Verdict global

| État | Pages |
|---|---|
| ✅ **v2 conforme** | `/` (home) — 1 emoji résiduel au footer |
| 🟡 **v2 partiel** | `/login` — tokens couleur OK, mais pas de `.display`, card bordée, emoji footer |
| 🔴 **Legacy v1** | world-cup, predictions, **leaderboard**, games, games/[id], activities, calendar, admin/results, admin/members |

**Signaux transverses du legacy v1** : canvas `#0a0a0f` (au lieu de `--canvas`),
**violet `#6366f1`/`#a855f7`** comme couleur de marque, **or en hex bruts**
(`#fbbf24`/`#FFD700`/`#f59e0b`) utilisé comme accent général au lieu du token
`--gold` réservé Drère/1er, gradient-text, emojis dans le chrome, exclamations,
`border-white/10` partout, vert `#22c55e` au lieu de `#34D399`, et **absence
totale de `.score`/`.display`** (les chiffres héros restent en `font-black`).

> ⚠️ **Finding infra** : les tables `games`, `game_sessions`, `game_participants`
> **n'existent pas en prod** (migration `20260626_game_tracker.sql` jamais
> appliquée). Zbrétoile (`/games`, `/games/[id]`) est **non déployée** — la page
> tourne à vide/erreur en prod. Décision requise (voir Synthèse).

---

## LIVRABLE 3 (le crucial) — Sources de données matchs / équipes / scores

### Tableau par page

| Page | Noms d'équipes | Source | Applique `match_team_overrides` ? | État knockout |
|---|---|---|---|---|
| **Home** `/` | prochains matchs | `matches.json` **brut** (`parseMatch`) | ❌ **NON** | 🔴 périmé (placeholders) |
| **World-Cup** | tous les matchs | `matches.json` **+ overrides** (`getTeamNames`) | ✅ OUI | 🟢 à jour (vrais noms) |
| **Calendar** | matchs du jour | `matches.json` **brut** (`parseMatch`) | ❌ **NON** | 🔴 périmé (placeholders) |
| **Predictions** | — (pronos globaux) | liste `TEAMS` statique | N/A | 🟢 N/A |
| **Leaderboard** | — (joueurs/points) | Supabase `points_log`/`match_results` | N/A | 🟢 N/A |
| **Activities** | — (social) | — | N/A | 🟢 N/A |

### La divergence « Vainqueur M73 / 2e Groupe D » (home) vs « Portugal / Croatie » (world-cup)

**Cause racine** : les overrides ne sont **jamais** appliqués côté serveur.
`getMatchById()` / `parseMatchTeams()` (`src/lib/matches.ts:38-40`, `:198-204`)
lisent **uniquement** `matches.json`. Les vrais noms knockout n'existent QUE dans
la table `match_team_overrides` (peuplée par `/api/knockout/sync` depuis
football-data.org). **Le seul pont vers cette table est le hook client
`useTeamOverrides`.** Une page voit les vrais noms **ssi elle appelle ce hook**.

- **Chemin HOME (→ placeholders)** : `page.tsx:284,332` `parseMatch(match.match)`
  → affiche la chaîne brute `"Vainqueur M73 - Vainqueur M75"`. `page.tsx`
  n'importe jamais `useTeamOverrides`.
- **Chemin WORLD-CUP (→ vrais noms)** : `world-cup/page.tsx:9,133` importe/instancie
  `useTeamOverrides`, `:1085-1088` `getTeamNames(match.id, defHome, defAway)` →
  remplace le placeholder par l'override → `"Portugal"`. Le hook lit
  `GET /api/knockout/teams` → `teams/route.ts:16` `from('match_team_overrides')`.

**La donnée à jour existe déjà** ; home + calendar la court-circuitent. Fix minimal
(non appliqué) : importer `useTeamOverrides` + `getTeamNames` dans home & calendar,
exactement comme world-cup. **Surfaces périmées** : `page.tsx` (`:284-378`),
`calendar/page.tsx` (`:285,304-308`).

> Note serveur : plusieurs routes calculent `home_team/away_team` via
> `parseMatchTeams(match.match)` sur le JSON brut (`results/route.ts:52,146,245`,
> `predictions/score/route.ts:117,156,294`) → les **notifications** de résultat
> knockout affichent aussi des placeholders (« Vainqueur M73 2-1 … »). Le scoring
> travaille sur les scores numériques, donc pas d'impact points.

---

## Composants partagés & rayon d'impact

### Design system `src/components/ui/` — tous ✅ v2
Button, Card, ListRow, Badge, Avatar, Spinner : 100 % tokens, conformes.
**`PageHeader` et `EmptyState` sont prêts mais JAMAIS importés** — les pages
monstres réimplémentent des heros/empty-states custom legacy à la place (dette).

### Composants métier `src/components/`

| Composant | Utilisé par | Rayon d'impact | État DA |
|---|---|---|---|
| **Navbar** | 10 pages | global | ✅ v2 |
| **FunFactCard** | home | home | ✅ v2 |
| **CountUp** | home | (réutilisable) | ✅ neutre |
| **DrereCelebration** | **global** (Providers→layout) | **toutes** | 🔴 legacy lourd : confetti or/violet, emojis 🏆👑, « Champion! » (exclamation), `DrereCelebration.tsx:35,357-388,393-411` |
| **EvolutionChart** | leaderboard | leaderboard | 🔴 legacy : **n'utilise PAS `chart-theme.ts`**, palette 16 couleurs dont violet `#8b5cf6`/`#a855f7`, grille/axes/tooltip en dur (`EvolutionChart.tsx:27-44,96,153-164`) |
| **DrereWeekSong** | leaderboard | leaderboard | 🔴 **violet/rose partout** (interdit) : `from-purple-900 to-pink-900`, `ring-purple-500` (`DrereWeekSong.tsx:89,104,129,139,165`) |
| **DrereSpeech** | leaderboard | leaderboard | 🔴 or en dur `#fbbf24`, emoji 👑 (`DrereSpeech.tsx:215,257,261,297`) |
| **WallOfShame** | leaderboard | leaderboard | 🔴 gradient rouge + surface dure, emoji 🏆 (`WallOfShame.tsx:21,66`) |
| **TeamFactsSheet** | world-cup | world-cup | 🔴 gris **neutres** (interdit), emoji ⚽ (`TeamFactsSheet.tsx:127,145,154`) |
| **Providers** | global | toutes | 🟡 Toaster codé `background:#1e1e2e` → devrait être `--surface-2` (`Providers.tsx:16`) |

**`chart-theme.ts` existe mais n'est branché nulle part** → à connecter dans EvolutionChart.

---

## Inventaire par page (sections + état DA)

### `/` home — ✅ v2 (12 sections)
Loading `180-188` · Navbar · Hero (photo grayscale + scrim) `209-253` · Stats nues
`256-267` · FunFact `270-272` · **Pilote Prochain match** `275-310` · Prochains
matchs (ListRow) `313-357` · Mes événements `360-434` · Cards nav `437-469` · La
team `472-489` · Stats perso `492-518` · Footer `521-528`.
Violation résiduelle : **emoji footer** `page.tsx:525` (❤️🇧🇪).

### `/login` — 🟡 v2 partiel
Wordmark `219-222` (⚠️ pas `.display`) · Card bordée `225` · Sélection membres
`226-262` · Écran PIN `264-347` · Footer `350-354`. Emoji footer `:352`.

### `/world-cup` (1804 l.) — 🔴 legacy v1
Hero `812-851` · **Phase filters** `853-898` · **Sticky filter bar** `900-1069` ·
Liste matchs (jour, carte, équipes+drapeaux, **saisie prono score = héros** `1292-1441`,
Auvio, participation, tous les pronos, « Qui/Où regarder ») `1071-1803`.
Emojis massifs, violet `#6366f1`, or `#fbbf24` en accent, exclamations
(« Fais ton prono ! »), gradients. Vrais noms d'équipes (overrides) ✅.

### `/predictions` (734 l.) — 🔴 legacy v1
Hero (gradient-text `:452`) · CommunityStats `234-299` · Grille 6 pronos globaux
`478-664` · Tableau membre×catégorie `671-731`. Or hors règle, violet, emojis
🎰🔮💰, orange chrome.

### `/leaderboard` (1543 l.) — 🔴 legacy v1 — **détail complet**
| # | Section | Lignes |
|---|---|---|
| 1 | Skeleton | 234-266 |
| 2 | Hero (gradient-text + 🏆) | 280-298 |
| 3 | Drère du jour / Type mzi (💀 + citation de honte) | 300-394 |
| 4 | Drère of the Week + hymne | 396-436 |
| 5 | **Podium top 3** (or 1er) | 439-468 |
| 6 | **Table principale** (rank/membre/points/pronos/exacts/couronnes) | 470-591 |
| 7 | Joueurs inactifs (😴) | 594-621 |
| 8 | Classement Live (poll 30s) | 623-730 |
| 9 | Week race + countdown lundi | 732-831 |
| 10 | Classement K/D (⚔️, « ratio ! ») | 833-935 |
| 11 | Hall of Fame Drère-of-week | 937-1015 |
| 12 | Evolution Chart | 1017-1020 |
| 13 | Wall of Shame | 1022-1025 |
| 14 | **Records — 11 cartes** (quotidien, hebdo, séries, most-drère, most-mzi, exacts, visionnaire, moyenne, sans-mzi, honte…) | 1027-1472 |
| 15 | Fun Stats (🌈🔮🐑) | 1474-1512 |
| 16 | Barème des points | 1513-1540 |
Cumule **tous** les interdits. Or en hex bruts (jamais `--gold`). Chiffres héros
en `font-black` (pas `.score`). Seuls usages or **légitimes** : podium 1er,
Drère du jour, ring `is_drere_today` — le reste (records, week-race, live) abuse l'or.

### `/games` (1017 l.) + `/games/[id]` (285 l.) — 🔴 legacy v1 + **non déployé en prod**
Header Zbrétoile, ELO leaderboard, Kings, Activity feed, sessions, modals. Violet
`#6366f1`, purple ELO `#a855f7`, or hors règle. **Tables absentes en prod.**

### `/activities` (409 l.) — 🔴 legacy v1
Hero, quick pills types, liste activités (barres réponses, Oui/Peut-être/Non,
avatars), empty state, modal. Violet, or, gradients, emojis, exclamations
(« Confirmé ! », « Sois le premier… ! »).

### `/calendar` (396 l.) — 🔴 legacy v1
Hero + boutons mois, grille calendrier, panneau jour, 4 tuiles stats. Violet, or
(« Finale 1 » en or), emojis 🗓️⚽📌, **placeholders knockout** (voir données).

### `/admin/results` (574 l.) — 🔴 legacy v1
Hero (gradient-text `:226`), matchs sans/avec résultat + éditeur inline, tournament
results. Violet, or, emojis, « enregistré ! ».

### `/admin/members` (211 l.) — 🔴 legacy v1
Hero (gradient-text `:120`), liste membres + reset PIN. Violet spinner, or (user
courant), emoji 👥.

---

## Découpage en vagues (pages monstres)

### `/leaderboard` (1543 l.) — 3 vagues
- **A · Sommet** (`235-468`) : skeleton, hero→`PageHeader`+`.score`, Drère/Mzi du
  jour, Drère-of-week, **podium or**. Embarque **DrereSpeech** + **DrereWeekSong**
  (à refondre, violet).
- **B · Classements & live** (`470-1014`) : **table principale**→`ListRow`, inactifs,
  **live**→`Badge variant="live"`, week-race→`.score` count-up, K/D, hall of fame.
- **C · Data-viz & records** (`1017-1540`) : **EvolutionChart**→brancher
  `chart-theme.ts`, **WallOfShame**, **11 cartes records** (→ 1 composant réutilisable),
  fun stats, barème.

### `/world-cup` (1804 l.) — 3 vagues
- **A · Hero & filtres** (`808-1069`) : hero, phase filters, sticky bar → segmented v2.
- **B · Matchs & pronostic** (`1071-~1500`) : liste, **saisie score = `.score` héros**,
  badge confirmé (retirer confetti déjà fait).
- **C · Participation & annexes** (`~1500-1801`) : barres réponses, participation,
  tous les pronos, « Qui/Où regarder », **TeamFactsSheet** (gris neutres).

---

## SYNTHÈSE — les 3 décisions à prendre

### Décision 1 — Source unique des noms d'équipes knockout
Home & calendar affichent des placeholders (« Vainqueur M73 ») car ils
n'appliquent pas `match_team_overrides` ; seul world-cup le fait via
`useTeamOverrides`. **Choisir :**
- **(a) Recommandé** — adopter `useTeamOverrides` + `getTeamNames` sur home &
  calendar (aligne 3 surfaces, la donnée existe déjà, ~10 lignes/page, zéro API).
- (b) Résoudre côté serveur : `getMatchById` fusionne les overrides (nécessite un
  accès DB dans `lib/matches.ts` aujourd'hui pur/statique — plus lourd, mais
  corrige aussi les notifications serveur).
- (c) Statu quo (placeholders sur home/calendar) — non recommandé.
→ **Quelle option ?**

### Décision 2 — Réduire vs refondre (leaderboard + Zbrétoile)
Le leaderboard empile **16 sections** dont beaucoup redondantes (Live, Week-race,
K/D, Hall of Fame, **11 cartes records**, Fun Stats, Wall of Shame). Refondre tout
= des jours. **Choisir ce qu'on SUPPRIME/FUSIONNE plutôt que refondre** — ex.
garder podium + table + Drère/Mzi + 1 chart + records **condensés** (3-4 max),
supprimer les doublons de classement (K/D et Live font presque doublon avec la
table). Et **Zbrétoile** : déployer la migration `game_tracker` en prod **ou**
retirer l'onglet de la nav (aujourd'hui cassé). → **Quelles sections dégager ?
Zbrétoile : déployer ou retirer ?**

### Décision 3 — Ordre des vagues
Recommandation par impact décroissant :
1. **Composants globaux d'abord** (touchent toutes les pages) : **DrereCelebration**
   (overlay global legacy), **Toaster** (Providers), puis **EvolutionChart +
   chart-theme** et **DrereWeekSong** (violet interdit).
2. **Leaderboard vague A** (podium or + table) — la vitrine, plus fort ROI visuel.
3. **World-cup vague A/B** (hero + saisie score `.score`) — page la plus utilisée
   pendant les matchs.
4. Le reste (predictions, activities, calendar, admin) par lots homogènes.
→ **On valide cet ordre, ou une page prioritaire ?**
