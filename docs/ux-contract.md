# UX Contract - ZbrePlanning

Ce document définit le comportement attendu de chaque page. Tout écart = violation à corriger.

---

## 1. Page Login (`/login`)

### État initial
- Grille de 14 membres avec photos
- Indicateur "14 membres actifs"

### Actions
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Clic membre | → Affiche écran PIN | - |
| PIN incorrect | Toast "Erreur" + PIN effacé | - |
| PIN correct | Toast "Bienvenue X !" + redirect `/` | Cookie session |
| Setup PIN (1ère fois) | 2 champs PIN + confirmation | PIN hashé en DB |

### Reload
- Si session active → redirect `/`
- Sinon → grille membres

---

## 2. Page Accueil (`/`)

### État initial
- Hero avec photo groupe
- Stats (Membres, À pronostiquer, Jours CDM, Équipes)
- Countdown prochain match
- Grille prochains matchs (6 max)
- Mes rendez-vous (matchs/activités confirmés)
- La Team (14 avatars)
- Stats perso

### Actions
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Clic "À pronostiquer" | → `/world-cup` | - |
| Clic countdown | → `/world-cup` | - |
| Clic carte match | → `/world-cup` | - |
| Clic activité | → `/activities` | - |
| Clic castor easter egg | Toggle photo castor | - |

### Reload
- Tous les compteurs recalculés depuis DB
- Mes rendez-vous rechargés

---

## 3. Page World Cup (`/world-cup`)

### État initial
- Filtres phase (Groupes, 8e, Quarts, Demis, Finale)
- Filtres secondaires (Mes équipes, À pronostiquer, Soirée/Nuit)
- Cartes matchs avec:
  - Équipes + drapeaux
  - **Zone prono (STAR)** : inputs score visibles directement
  - **Participation (secondaire)** : boutons Oui/Peut-être plus petits
  - Progress bar réponses (X/14 ont répondu)
  - Badge "Confirmé" si ≥5 Oui

### Actions - PRONOSTICS (fonction star)
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Saisie score | Debounce 1s puis auto-save | DB `match_score_predictions` |
| Save réussi | Toast "Pronostic enregistré ✓" | - |
| Match verrouillé (<2h) | Inputs disabled + 🔒 | - |

### Actions - PARTICIPATION (fonction secondaire)
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Clic "Oui !" | Bouton vert plein | DB `match_participations` |
| Clic "Peut-être" | Bouton doré plein | DB `match_participations` |
| ≥5 Oui | Badge "Confirmé !" + confetti | - |

### Actions - FAVORIS
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Clic ☆ équipe | → ★ doré | DB `user_favorites` |
| Clic ★ équipe | → ☆ | DB `user_favorites` |
| Filtre "Mes équipes" | Affiche matchs avec ★ | - |

### Actions - DÉTAILS (expandable)
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Clic "Détails" | Expand: lieux proposés, Auvio | - |
| Proposer lieu | Toast "Lieu proposé !" | DB `watch_locations` |
| Voter lieu | Compteur +1 + label "Tu as voté" | DB `location_votes` |

### Auvio Button
| Condition | Affichage |
|-----------|-----------|
| Match pas aujourd'hui | Caché |
| Match aujourd'hui, hors fenêtre | Grisé + "(dispo 30 min avant)" |
| Match aujourd'hui, dans fenêtre | Actif rouge, cliquable |

*Fenêtre Auvio = 30 min avant → 2h30 après kickoff*

### Pronos des autres
- Toujours visibles (fun > anti-cheat)
- Affichage compact: avatar + score (ex: "2-1")
- Séparé de mon prono par bordure

### Reload
- Participations restaurées
- Scores restaurés
- Favoris restaurés
- Filtres NON persistés (reset à "Groupes")

---

## 4. Page Leaderboard (`/leaderboard`)

### État initial
- Hero avec titre + emoji trophée
- Section "Drère du jour" si applicable
- Tableau classement:
  - Rang (🥇🥈🥉 puis #4, #5...)
  - Avatar + nom
  - Points total
  - Scores exacts
  - Couronnes (Drère count)
  - Changement rang (↑↓—)
- Section "Wooden Spoon" (dernier)
- Stats fun (Optimiste, Visionnaire, Suiveur)
- Barème des points

### Actions
| Action | Feedback | Persistance |
|--------|----------|-------------|
| (aucune action) | Page read-only | - |

### Reload
- Classement recalculé depuis DB
- Position utilisateur highlighted en violet

---

## 5. Page Activities (`/activities`)

### État initial
- Bouton "Créer une activité"
- Quick-select types (Resto, Bar, Sport...)
- Liste activités avec:
  - Type + titre + description
  - Date/heure/lieu
  - Progress bar réponses
  - Badge "Confirmé" si ≥5 Oui
  - Boutons Je viens/Peut-être/Non

### Actions
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Créer activité | Modal → Toast | DB `activities` |
| "Je viens" | Bouton vert plein | DB `activity_participations` |
| "Peut-être" | Bouton doré plein | DB `activity_participations` |
| "Non" | Bouton rouge plein | DB `activity_participations` |

### Reload
- Activités rechargées
- Mes participations restaurées

---

## 6. Page Admin Results (`/admin/results`)

### Accès
- Réservé aux admins (sinon redirect)

### Actions
| Action | Feedback | Persistance |
|--------|----------|-------------|
| Saisie résultat | Save button | DB `match_results` |
| Save résultat | Toast + calcul points | DB `points_log` |

---

## 7. Page Predictions (`/predictions`)

### État initial
- Liste de tous mes pronostics
- Groupés par match
- Score prédit + résultat réel (si joué)
- Points gagnés

### Reload
- Tous pronostics rechargés

---

## Règles transversales

### Loading
- Toutes les pages: spinner centré pendant chargement
- Jamais d'écran noir

### Navigation
- Navbar présente sur toutes pages (sauf login)
- Avatar utilisateur avec dropdown

### Toasts
- Succès: vert avec ✓
- Erreur: rouge
- Auto-dismiss après 3s

### Mobile
- Responsive sur toutes pages
- Score inputs accessibles sans scroll dans la carte
- Boutons tactiles min 44x44px

---

## Violations connues et corrigées

| Page | Violation | Fix |
|------|-----------|-----|
| world-cup | Pronos cachés avant lock | API retourne tous les pronos |
| world-cup | Auvio caché hors fenêtre | Auvio grisé visible sur matchs du jour |
| world-cup | "Tu as voté" manquant | Label ajouté sur votes |

---

*Dernière mise à jour: 2026-06-11*
