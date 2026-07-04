# Audit notifications — état des lieux (4 juil 2026)

## 1. Ce qui ÉCRIT dans `notifications` aujourd'hui

Table `notifications` (colonnes : `user_id`, `type`, `title`, `message`, `link`, `created_by`, `related_id`, `read`).

**Client (anon direct)** via `notifyAllUsers()` (`src/hooks/useSupabase.ts:242`) — insère une ligne **par autre membre** (broadcast aux 13 autres) :
| Type | Déclencheur |
|---|---|
| `activity_created` | **création d'une activité** ✅ (`createActivity`, lien `/activities`, `related_id` = id activité) |
| `activity_response` | réponse oui/non/peut-être à une activité |
| `location_proposed` | proposition d'un lieu pour regarder un match |
| `location_vote` | vote sur un lieu |
| `match_response` | (aussi écrit **côté serveur**) participation à un match |

**Serveur (service role)** :
- `match_response` : `src/app/api/results/route.ts:247` + `results/sync/route.ts:377` (à la saisie/sync d'un résultat).

→ **Oui, la création d'activité génère bien une notification** (`activity_created`) pour les 13 autres.

## 2. Ce qui LIT les notifications : **RIEN côté UI**

- Le hook a déjà `getNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()` (`useSupabase.ts:271-330`) et un `useEffect` (~1039) qui **charge** les notifs dans un state `notifications` au montage.
- **MAIS aucun composant ne consomme ce state.** Zéro cloche, zéro badge, zéro panneau, zéro page. Pas de route `/api/notifications`.
- **Conclusion : le système est "write-only".** Les membres génèrent des notifications (déjà en base, prod comprise) mais **ne les voient nulle part**. Le socle (écriture + fetch + mark-read) est là ; il manque **uniquement l'UI de lecture**.

## 3. Propositions (à décider — non implémentées)

### (a) Cloche in-app + badge non-lus + panneau — RECOMMANDÉ
- **Ce que ça demande** : icône `Bell` (lucide) dans la Navbar (haut-droite, à côté de l'avatar, mobile + desktop) + badge accent avec le compte de non-lus (`read = false`) + un panneau v2 (surface-raised, ListRows, eyebrow timestamps, `link` cliquable, mark-read à l'ouverture / au clic). Optionnel : abonnement Supabase Realtime pour le badge live (sinon refetch au montage + à l'ouverture).
- **Réutilise l'existant** : `getNotifications` / `markNotificationRead` / `markAllNotificationsRead` déjà écrits. Il ne manque que le **compteur non-lus** (un filtre) et l'UI.
- **Coût estimé : ~2-4 h.** Faible. Aucune nouvelle infra, aucune migration.
- **Point de design** : sur mobile la bottom tab bar est pleine → la cloche va en **haut-droite** (près de l'avatar), pas dans la tab bar.

### (b) Vraies push PWA — plus lourd, plus tard
- **Ce que ça demande** : `manifest.json` + **service worker** + **Web Push (VAPID)** + table des `push_subscriptions` par user + logique d'envoi **serveur** (là où `notifyAllUsers` déclenche, mais côté serveur) + prompt de permission.
- **Gros caveat iOS** : le Web Push n'existe que sur **iOS 16.4+** ET **uniquement si l'app est "Ajoutée à l'écran d'accueil"** (PWA installée). Pour un groupe d'amis sur iPhone, friction réelle (il faut que chacun l'installe).
- **Coût estimé : ~1-2 jours.** Moyen-élevé. Nouvelle infra + UX d'installation.

### Reco
Commencer par **(a)** (valeur immédiate, quasi gratuit vu le socle existant). Envisager **(b)** seulement si la team installe réellement la PWA — sinon peu de ROI vu le caveat iOS.
