# ZbrePlanning — Direction artistique "Tableau d'affichage"

Concept : un stade la nuit. Le noir est teinté de vert, la lumière sculpte les
surfaces, et le CHIFFRE (score, points, ELO, countdown) est le héros
typographique de la marque. Référence de qualité : Linear (échelle d'élévations,
discipline), esthétique broadcast raffinée (pas kitsch).

## 1. Couleur — le noir est vert
- --canvas: #0A0C0B        (fond de page, near-black teinté vert)
- --surface-1: #101312     (sections, cards de base)
- --surface-2: #161A18     (éléments surélevés : rangées hover, inputs, segmented)
- --surface-3: #1D2220     (popovers, éléments actifs)
- --surface-4: #242A27     (modals, tooltips)
La hiérarchie vient de CETTE échelle, pas des bordures.
- --text-primary: #F2F4F3 ; --text-secondary: #9CA6A1 ; --text-tertiary: #5F6963
  (les gris sont teintés vert — JAMAIS de gris neutre pur)
- --accent: #34D399 ; --accent-glow: rgba(52,211,153,0.25)
- --gold: #E8B93E (Drère / 1ère place UNIQUEMENT) ; --live: #FF4D4D ; --danger: #F87171

## 2. Lumière — le matériau central
- Tout panneau surélevé (surface-2+) porte un liseré lumineux sur son arête
  supérieure : box-shadow: inset 0 1px 0 rgba(255,255,255,0.06). C'est ce qui
  donne le rendu "pixel ciselé" au lieu du flat.
- Le badge LIVE émet : point rouge + box-shadow 0 0 12px rgba(255,77,77,0.5), pulse 2s.
- Focus/éléments actifs accent : glow doux 0 0 0 3px var(--accent-glow), jamais d'outline dur.
- Un halo radial très subtil (radial-gradient, opacité 0.04, vert) est autorisé
  derrière UN élément héros par page (ex: le countdown). Jamais deux.

## 3. Bordures — règle stricte
Une bordure n'est justifiée QUE si l'élévation ne suffit pas (inputs, segmented,
tableaux de données). Partout ailleurs : élévation + espacement. Supprimer le
réflexe "tout est une boîte à hairline". Les sections de page (Prochains matchs,
La team...) vivent SANS conteneur : titre + contenu directement sur --canvas.

## 4. Typographie — le chiffre est la marque
- UI/corps : Inter 400/500/600 (inchangé).
- DISPLAY (nouveau) : Space Grotesk (Google Fonts), réservé à deux usages :
  a) Les chiffres héros : scores, points, countdown, ELO, rangs du podium.
     Classe .score : Space Grotesk 600, font-variant-numeric: tabular-nums,
     tracking -0.03em. Tailles : 48-64px (héros), 28px (cards), 20px (rangées).
  b) Les titres de page et le wordmark : Space Grotesk 500, tracking -0.02em.
- Le wordmark "ZbrePlanning" passe en Space Grotesk 500. C'est l'identité.
- Les chiffres deviennent GRANDS. Un total de points se lit à 2 mètres.
- Labels : 11px uppercase tracking 0.08em text-tertiary (inchangé).

## 5. Image — traitement archive de club
Toute photo affichée dans le chrome (hero, bannières) reçoit :
filter: grayscale(1) contrast(1.05) ; overlay teinté var(--canvas) à 25% ;
grain (noise SVG ou png 128px, opacity 0.05, blend overlay) ; scrim bas vers --canvas.
Jamais de photo brute en couleurs. Les avatars utilisateurs restent en couleur
(ce sont les personnes, pas le décor).

## 6. Motion — tout est fluide
- Standard : 150ms cubic-bezier(0.25,0.46,0.45,0.94) sur tout élément interactif.
- Entrée des listes : stagger 30ms/rangée, fade + translateY(4px→0), 250ms, une seule fois.
- Chiffres héros : count-up 500ms ease-out au mount (countdown, totaux points).
- Hover cards/rangées : passage surface-1→surface-2 + liseré haut, PAS de scale.
- Aucun bounce, aucun spring décoratif. prefers-reduced-motion respecté.

## 7. Interdits (inchangés + nouveaux)
Emojis dans le chrome. Points d'exclamation. Gradients de texte. Violet.
Or hors Drère/1er. Photos couleur dans le chrome. Bordures par défaut.
Deux halos sur une même page. Gris neutres non teintés.

## 8. Température (v2.1)
Le stade est allumé : le noir reste, la lumière devient chaude.
- `--canvas: #0C0C09` ; `--surface-1: #131310` ; `--surface-2: #1A1A15` ; `--surface-3: #21211B` ; `--surface-4: #282821` (gamme vert-chaud ambrée)
- `--text-primary: #F5F4EF` (ivoire) ; secondary/tertiary suivent, teintés chauds
- `--glow-warm: rgba(232,185,62,0.07)` — lueur ambiante autorisée : UN radial très large en haut de page (les projecteurs). Ne remplace pas le halo héros existant.
- Photo hero : duotone chaud (ombres `--canvas`, hautes lumières ambrées ~`#E8B93E` à 15%) au lieu du grayscale strict. Grain conservé.
- Les interdits (§7) et la règle de l'or restent inchangés.

*État : PILOTE sur la home uniquement (classe `.theme-warm`). Les autres pages restent sur v2 le temps du jugement — divergence temporaire assumée.*
