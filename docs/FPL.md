# FPL — Ziarclays Zbremiership

Accueil du site (`/`) depuis le 16 nov 2026 : la mini-ligue FPL des 4 (ligue 1774059).
La Coupe du Monde vit sous `/cdm` (+ `/world-cup`, `/leaderboard`, `/predictions`).

## Qui fait quoi

| Étape | Qui | Où |
|---|---|---|
| Récupérer classement, équipes, transferts, points | code (API publique FPL, sans clé) | `src/lib/fpl/snapshot.ts`, cache 5 min (`data.ts`) |
| Tous les chiffres (Drère, Mzi, capitaines, banc, chips, transferts, H2H) | code, déterministe | `src/lib/fpl/stats.ts` (testé : `stats.test.ts`) |
| Texte drôle de la review | Claude (`claude-opus-5-5`), à partir des chiffres du code uniquement | `src/lib/fpl/review.ts` |
| Chanson du Drère | Suno (sunoapi.org), retour par `/api/fpl/song/callback` | `review.ts` → `launchSong` |
| Son du Mzi | fichier fixe `/sounds/mzi.m4a` | — |

## Mise à jour automatique

- Les pages lisent l'API FPL à chaque visite (cache 5 min) : classement et GW en cours toujours à jour.
- Cron Vercel `0 10 * * *` → `/api/fpl/cron` (Bearer `CRON_SECRET`). Il écrit la review de la dernière GW
  **validée par FPL** (`finished && data_checked`, vers 9h UK le lendemain du dernier match), une seule fois.
  Une GW ratée (cron en panne) est rattrapée au passage suivant ; jamais de rattrapage avant la 1re review.
- Relance manuelle (admin connecté) : `POST /api/fpl/cron` `{ "gw": 10, "withSong": true }`.
- En local : `npx tsx --conditions=react-server --env-file=.env.local --env-file=~/.secrets/zbreplanning.env scripts/fpl-run-review.mts 10 [--song]`.

## Garde-fous argent

- Une ligne par GW (`fpl_gw_reviews`, clé primaire `season, gw`) = verrou : jamais deux reviews payées pour la même GW.
- Au plus 3 tentatives par GW ; chaque tentative, même ratée, est comptée dans `cost_usd`.
- Plafond saison : 5 $ de reviews Claude (≈ 0,08 $ par GW mesuré → ≈ 3 $ sur la saison). Au-delà : plus de review, log `BUDGET CAP`.
- Pas de retry caché du SDK (`maxRetries: 0`).
- La chanson ne part que si la review est bien enregistrée. Coût Suno : **hors** de ce plafond (crédits Suno).

## Confidentialité

- Les photos « fat » ne sont **pas** dans le repo (public) : bucket Supabase privé `fpl-private/portraits/`,
  servies seulement à un membre connecté par `/api/fpl/photo/[slug]` (cache navigateur privé, jamais CDN).
- Pour changer une photo : remplacer `portraits/<slug>-face.webp` (256×256) ou `<slug>-full.webp` (3:4) dans le bucket.

## Règles FPL appliquées

Voir `docs/FPL-RULES.md`. Points clés : 2 jeux de chips (GW1-19, GW20-38, non reportables), hits déduits
(`points − event_transfers_cost`), Bench Boost valorisé par les points réels du banc, Free Hit = transferts
d'une seule GW, Drère/Mzi seulement sur une GW terminée.

## Rollback

- Code : revert du merge sur `main` (Vercel redéploie).
- Base : `DROP TABLE public.fpl_gw_reviews;` (table neuve, aucune donnée existante touchée).
- Photos : supprimer le bucket `fpl-private`.
