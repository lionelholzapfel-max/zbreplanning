# ZbrePlanning - Coupe du Monde 2026

Plateforme pour la Zbre Team (14 amis) pour regarder la Coupe du Monde 2026 ensemble.

## Connexion

1. Choisis ton avatar sur la page de login
2. Première connexion : configure ton PIN à 4 chiffres
3. Connexions suivantes : entre ton PIN

## Pronostics de Score

- Pronostique le score exact de chaque match AVANT le coup d'envoi
- Les pronos sont verrouillés au kickoff et révélés à tous

### Système de Points

| Action | Points |
|--------|--------|
| Bon résultat (1N2) | 1 pt |
| Bonne différence de buts | 2 pts |
| Score exact | 3 pts |
| Bonus Visionnaire | +1 pt si tu es le seul à avoir trouvé le résultat exact |

### Badges Quotidiens

- **Drère du jour** : Plus de points sur la session
- **Type mzi** : Le moins de points sur la session

## Déploiement

### Variables d'environnement Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<généré avec: openssl rand -base64 32>
```

### Commandes

```bash
npm install
npm run build
npm run start
```

### Base de données

Exécuter dans l'ordre :
1. `supabase-migration.sql`
2. `supabase-migration-v2.sql`
3. `supabase-migration-v3.sql`
4. `supabase-migration-v4.sql`

## Tech Stack

- Next.js 16 + React 19
- Supabase (PostgreSQL + RLS)
- Tailwind CSS
- canvas-confetti

---

Made with love pour la Zbre Team - Bruxelles
