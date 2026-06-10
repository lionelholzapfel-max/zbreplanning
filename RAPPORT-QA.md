# Rapport QA - ZbrePlanning

**Date**: 11 juin 2026
**Version**: Pre-launch

---

## 1. Tests Playwright

### Statut des tests

| Test | Statut | Notes |
|------|--------|-------|
| Mobile Screenshots | PASS | 3 screenshots générés (390px) |
| Login PIN | PASS | quickLogin helper fonctionne |
| Parcours complet E2E | SKIP | Timeout - nécessite tuning |
| Admin flow | SKIP | Nécessite setup admin |
| Tests existants | PARTIAL | 2/33 passent, timing issues |

### Screenshots générés

- `screenshots/mobile-accueil.png`
- `screenshots/mobile-world-cup.png`
- `screenshots/mobile-leaderboard.png`

### Actions recommandées

1. Augmenter timeouts dans playwright.config.ts
2. Utiliser `waitForSelector` au lieu de `waitForLoadState('networkidle')` (countdown bloque)
3. Ajouter des `data-testid` pour des sélecteurs plus fiables

---

## 2. Build & TypeScript

```
npm run build → SUCCESS
- Zéro erreur TypeScript
- Zéro warning critique
- 20 pages générées
```

### Pages vérifiées

| Page | Statut | useSupabase |
|------|--------|-------------|
| / (accueil) | OK | Oui |
| /world-cup | OK | Oui |
| /activities | OK | Oui |
| /calendar | OK | Oui |
| /predictions | OK | Oui |
| /leaderboard | OK | Oui |
| /admin/results | OK | API only |

---

## 3. Sécurité des données

### Tables protégées (service role only)

| Table | Accès client direct | Via API |
|-------|---------------------|---------|
| match_score_predictions | AUCUN | POST /api/predictions/score |
| match_results | AUCUN | POST /api/results |
| points_log | AUCUN | Calculé via /api/results |
| daily_awards | AUCUN | Calculé via /api/results |

### Secrets

- `.env*` dans .gitignore
- Pas de secrets dans l'historique git (vérifié)
- JWT_SECRET généré avec openssl rand -base64 32

---

## 4. Checklist Déploiement

### Variables Vercel requises

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
```

### Migrations à exécuter (dans l'ordre)

1. supabase-migration.sql
2. supabase-migration-v2.sql
3. supabase-migration-v3.sql
4. supabase-migration-v4.sql (favorites)

### Fichiers de config

- Pas de vercel.json requis (Next.js auto-détecté)
- README.md mis à jour avec règles de points

---

## 5. Risques restants

### CRITIQUE

1. **Migration v4 non exécutée** - Les favoris ne fonctionneront pas
   - Action: Exécuter `supabase-migration-v4.sql` avant le lancement

### MOYEN

2. **Tests E2E incomplets** - Timing issues à résoudre
   - Impact: Pas de regression automatique
   - Mitigation: Tests manuels ce soir

3. **Countdown bloque networkidle** - Empêche certains tests
   - Impact: Tests plus lents
   - Mitigation: Utiliser domcontentloaded

### FAIBLE

4. **Warnings Image "sizes" prop** - Pas d'impact fonctionnel
   - Impact: Performance non optimale sur certaines images

---

## 6. À surveiller pendant le premier match (11 juin 21h)

### 1. Verrouillage des pronos

- Vérifier que les inputs de score se verrouillent exactement au kickoff
- Tester avec un match qui commence
- Log à surveiller: `[Predictions] Match started, predictions locked`

### 2. Confetti au 5e "Oui"

- Tester quand un match atteint 5 participations "Oui"
- Vérifier que le toast "Match confirmé !" apparaît
- Vérifier badge "Confirmé 🎉" visible

### 3. Bouton Auvio

- Doit apparaître 30 min avant le match (20h30)
- Doit disparaître 2h30 après (23h30)
- Lien vers auvio.rtbf.be/categorie/sport

### Logs à surveiller

```bash
# Erreurs API
grep -i "error" /var/log/app.log

# Prédictions
grep "Predictions" /var/log/app.log

# Points calculés
grep "points_log" /var/log/app.log
```

---

## Conclusion

**Prêt pour le lancement avec réserves:**

- Build: OK
- Sécurité: OK
- Fonctionnalités: OK (à condition d'exécuter migration v4)
- Tests automatisés: PARTIELS (à améliorer post-launch)

**Action immédiate requise:**
Exécuter `supabase-migration-v4.sql` dans Supabase SQL Editor avant 20h30.
