# PIPELINE — ZbrePlanning

Source de vérité des tâches. On ne supprime jamais une ligne : on la coche avec sa date.

## FPL (home, saison 2026/27)

- [x] 16 nov 2026 — Home FPL, stats, managers, reviews en prod (PR #34)
- [x] 16 nov 2026 — Review GW10 générée par Claude (0,082 $)
- [x] 16 nov 2026 — Chanson test GW10 (seul test Suno autorisé), copie privée dans `fpl-private/songs/` (PR #35)
- [x] 16 nov 2026 — Célébration GW qui ne s'empile plus sur l'annonce champion CDM (PR #35)
- [x] 16 nov 2026 — Lore Lionel : « les Coupes du monde de l'Uruguay » (PR #36)
- [ ] Mesurer le coût réel d'une chanson Suno : solde avant/après la chanson de la GW11 (solde au 16 nov : 942 crédits)
- [ ] Vérifier le premier passage automatique du cron (review GW11 + chanson du Drère) : ligne `ready`, coût, chanson `completed` + `song_storage_path`
- [ ] Commit orphelin ed660be (captures avec photos) visible par SHA sur le repo public — Lionel : « pas grave », laissé tel quel (16 nov)
- [ ] Ménage : supprimer les branches déjà fusionnées (local + GitHub)
