# Plan d'implémentation : Système de Skills

## 1. Design des Skills

### Types de Skills

**Passif** : Bonus permanent appliqué en combat tant que le skill est équipé.
Certains passifs ont une condition de déclenchement (ex: "quand la vie < 20%").

**Actif** : Bonus temporaire avec une durée d'effet et un temps de recharge (cooldown).
Se déclenche automatiquement en combat quand le cooldown est prêt.

### Système de Tiers & Niveaux

- **6 tiers** identiques aux équipements :
  - Tier 1 : Common (gris `#9d9d9d`)
  - Tier 2 : Uncommon (vert `#1eff00`)
  - Tier 3 : Rare (bleu `#0070dd`)
  - Tier 4 : Epic (violet `#a335ee`)
  - Tier 5 : Legendary (orange `#ff8000`)
  - Tier 6 : Mythic (rouge `#ff0000`)

- **Niveaux** : Chaque skill peut monter du niveau 1 au niveau 10.
  Augmenter le niveau améliore les valeurs du skill.
  Coût en essence pour level up, croissance exponentielle.

- **Limite d'équipement** : 3 skills équipés simultanément (mix passifs/actifs libre).

### Déblocage des Skills

- Les skills sont débloqués en atteignant certaines **waves de combat** ou certains **niveaux de joueur**.
- Les tiers supérieurs nécessitent des prérequis plus élevés.
- Un skill débloqué commence au niveau 1.
- Coût de level up en **essence** : `baseCost * 1.5^(level-1)` (par skill/tier).

---

## 2. Liste des 24 Skills

### Passifs (12 skills)

| #  | ID | Nom | Icône | Tier | Type | Effet (Lvl 1 → Lvl 10) | Condition | Prérequis déblocage |
|----|-----|-----|-------|------|------|-------------------------|-----------|---------------------|
| 1  | `berserkerRage` | Berserker Rage | 🔥 | 1 Common | Passif | +10% → +55% dégâts quand vie < 30% | Vie < 30% | Joueur Lvl 3 |
| 2  | `ironSkin` | Iron Skin | 🛡️ | 1 Common | Passif | -5% → -25% dégâts reçus (permanent) | Toujours | Joueur Lvl 5 |
| 3  | `swiftBlade` | Swift Blade | ⚡ | 2 Uncommon | Passif | +5% → +30% vitesse d'attaque (permanent) | Toujours | Wave 2-1 |
| 4  | `poisonEdge` | Poison Edge | 🧪 | 2 Uncommon | Passif | Inflige 2% → 10% des dégâts en poison/tick (DoT 3s) | A chaque attaque | Wave 2-5 |
| 5  | `lastStand` | Last Stand | 💀 | 3 Rare | Passif | +20% → +80% dégâts quand vie < 20% | Vie < 20% | Wave 3-1 |
| 6  | `vampiricAura` | Vampiric Aura | 🧛 | 3 Rare | Passif | +3% → +15% life steal supplémentaire | Toujours | Joueur Lvl 25 |
| 7  | `critMastery` | Critical Mastery | 🎯 | 4 Epic | Passif | +5% → +25% chance de crit ET +10% → +50% mult crit | Toujours | Wave 5-1 |
| 8  | `thornArmor` | Thorn Armor | 🌵 | 4 Epic | Passif | Renvoie 5% → 30% des dégâts reçus à l'attaquant | Quand touché | Joueur Lvl 40 |
| 9  | `phoenixSpirit` | Phoenix Spirit | 🔥 | 5 Legendary | Passif | Résurrection à 10% → 50% HP (1 fois par combat, reset par wave) | A la mort | Wave 7-1 |
| 10 | `titanGrip` | Titan Grip | 💪 | 5 Legendary | Passif | +15% → +60% dégâts ET +10% → +40% HP max | Toujours | Joueur Lvl 60 |
| 11 | `deathMark` | Death Mark | ☠️ | 6 Mythic | Passif | Les monstres < 15% → 35% HP meurent instantanément (execute) | Monstre bas HP | Wave 9-1 |
| 12 | `godslayer` | Godslayer | ⚔️ | 6 Mythic | Passif | +5% → +25% de TOUS les bonus stats d'équipement | Toujours | Joueur Lvl 80 |

### Actifs (12 skills)

| #  | ID | Nom | Icône | Tier | Type | Effet (Lvl 1 → Lvl 10) | Durée | Cooldown | Prérequis déblocage |
|----|-----|-----|-------|------|------|-------------------------|-------|----------|---------------------|
| 13 | `warCry` | War Cry | 📢 | 1 Common | Actif | +15% → +60% dégâts | 4s → 7s | 20s → 14s | Joueur Lvl 2 |
| 14 | `heal` | Heal | 💚 | 1 Common | Actif | Soigne 10% → 40% HP max | Instantané | 15s → 8s | Joueur Lvl 4 |
| 15 | `shieldWall` | Shield Wall | 🧱 | 2 Uncommon | Actif | -20% → -60% dégâts reçus | 3s → 6s | 18s → 12s | Wave 1-5 |
| 16 | `bladeStorm` | Blade Storm | 🌪️ | 2 Uncommon | Actif | +30% → +100% vitesse d'attaque | 3s → 5s | 22s → 15s | Joueur Lvl 15 |
| 17 | `bloodRitual` | Blood Ritual | 🩸 | 3 Rare | Actif | Sacrifie 10% HP, gagne +25% → +80% dégâts | 5s → 8s | 20s → 12s | Wave 3-5 |
| 18 | `frozenShield` | Frozen Shield | ❄️ | 3 Rare | Actif | Absorbe 15% → 50% HP max en bouclier (absorbe les dégâts) | 5s → 8s | 25s → 16s | Joueur Lvl 30 |
| 19 | `shadowStrike` | Shadow Strike | 🗡️ | 4 Epic | Actif | Prochaine attaque inflige 200% → 500% dégâts (crit garanti) | 1 coup | 18s → 10s | Wave 5-5 |
| 20 | `divineBlessing` | Divine Blessing | ✨ | 4 Epic | Actif | +8% → +30% regen HP/s + immunité crit ennemi | 4s → 7s | 22s → 14s | Joueur Lvl 50 |
| 21 | `timeWarp` | Time Warp | ⏳ | 5 Legendary | Actif | Double la vitesse d'attaque + réduit cooldown actifs de 20% → 50% | 3s → 6s | 30s → 18s | Wave 8-1 |
| 22 | `ragingInferno` | Raging Inferno | 🌋 | 5 Legendary | Actif | Brûle tous les monstres pour 5% → 20% de leur HP max/s | 3s → 5s | 35s → 22s | Joueur Lvl 70 |
| 23 | `apocalypse` | Apocalypse | 💥 | 6 Mythic | Actif | Inflige 50% → 200% de vos dégâts totaux à tous les monstres (AoE burst) | Instantané | 45s → 25s | Wave 10-1 |
| 24 | `immortality` | Immortality | 👼 | 6 Mythic | Actif | Invincible (0 dégât reçu) + +20% → +80% dégâts | 2s → 5s | 60s → 35s | Joueur Lvl 90 |

### Combos Skills/Équipements intéressants

- **Berserker build** : `berserkerRage` + `lastStand` + `bloodRitual` + équipements Life Steal/Crit → dégâts massifs à basse vie
- **Tank build** : `ironSkin` + `frozenShield` + `thornArmor` + équipements Health Multi/Regen → survie maximale
- **Speed DPS** : `swiftBlade` + `bladeStorm` + `timeWarp` + équipements Attack Speed/Damage Multi → attaques ultra rapides
- **Execute build** : `deathMark` + `ragingInferno` + `apocalypse` + équipements Crit/Damage → burst les monstres
- **Sustain** : `vampiricAura` + `heal` + `divineBlessing` + équipements Health Regen/Life Steal → unkillable

---

## 3. Plan d'attaque UI

### 3.1. Emplacement dans l'app

Le sub-tab "Skills" existe déjà dans la section Upgrade (`index.html:331-336`).
Le contenu sera rendu dynamiquement dans `#subtab-skills`.

### 3.2. Layout de la page Skills (3 sections)

```
┌──────────────────────────────────────────┐
│ ⚡ SKILLS ÉQUIPÉS (3 slots)              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ 🔥       │ │ 🛡️       │ │  Vide    │  │
│ │ Berserker│ │ Shield   │ │  +       │  │
│ │ Rage     │ │ Wall     │ │          │  │
│ │ Lvl 3    │ │ Lvl 1    │ │          │  │
│ │ Tier ●   │ │ Tier ●●  │ │          │  │
│ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────┤
│ 📋 COLLECTION (filtrable par tier/type) │
│ [Tous] [Passifs] [Actifs]               │
│ [●Common] [●Uncom] [●Rare] [●Epic]...  │
│                                          │
│ ┌─────────────────────────────────────┐  │
│ │ 🔥 Berserker Rage    Passif  T1    │  │
│ │ +10% dégâts quand HP < 30%  Lvl 3  │  │
│ │ [Équiper] [Level Up: 500🔮]        │  │
│ ├─────────────────────────────────────┤  │
│ │ 🧪 Poison Edge       Passif  T2    │  │
│ │ 🔒 Nécessite Wave 2-5              │  │
│ ├─────────────────────────────────────┤  │
│ │ 💚 Heal              Actif   T1    │  │
│ │ Soigne 15% HP  CD: 13s     Lvl 2  │  │
│ │ [Équiper] [Level Up: 300🔮]        │  │
│ └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 3.3. Interactions UI

1. **Cliquer sur un skill débloqué** → ouvre une modal de détail :
   - Nom, icône, tier (couleur bordure), type (passif/actif badge)
   - Description de l'effet avec valeurs actuelles en surbrillance
   - Progression du level (barre + niveau actuel → suivant)
   - Valeurs actuelles vs valeurs du prochain level
   - Pour les actifs : durée + cooldown affichés
   - Boutons : [Équiper/Déséquiper] [Level Up (coût en essence)] [Fermer]

2. **Cliquer sur un skill verrouillé** → affiche les conditions de déblocage

3. **Cliquer sur un slot équipé vide** → scrolle/filtre vers la collection

4. **Cliquer sur un skill équipé** → modal avec option de déséquiper

### 3.4. Indicateurs en combat (Home tab)

- Skills actifs équipés affichés sous la barre HP du joueur comme des petites icônes
- Quand un actif se déclenche : animation de glow + timer circulaire sur l'icône
- Quand un passif conditionnel s'active : léger highlight sur l'icône
- Cooldown affiché en overlay grisé sur l'icône

```
┌─ Combat Zone ──────────────────────┐
│  🧙 You          ⚔️    👹 Ogre    │
│  [██████████] HP       [████] HP   │
│                                    │
│  Skills: [🔥] [🛡️⏳12s] [💚⏳5s] │
│           ↑      ↑         ↑      │
│         actif  cooldown  cooldown  │
└────────────────────────────────────┘
```

---

## 4. Plan d'implémentation (fichiers)

### Étape 1 : Configuration des skills (`src/skills-config.js`)
- Définir les 24 skills avec : id, name, icon, tier, type (passive/active), description
- Pour chaque skill : effet par level (formule), conditions, durée/cooldown (actifs)
- Fonctions : `getSkillById()`, `getAllSkills()`, `getSkillsByTier()`, `getSkillsByType()`
- Coût de level up par tier : `getSkillLevelUpCost(tier, currentLevel)`
- Prérequis de déblocage : `getSkillUnlockRequirement(skillId)`

### Étape 2 : État et persistance (`src/state.js`)
- Ajouter au `gameState` :
  ```js
  skills: {
    unlocked: {},    // { [skillId]: level }  (skills débloqués + leur niveau)
    equipped: [],    // [skillId, skillId, skillId] (max 3, null si vide)
  }
  ```
- Fonctions : `getUnlockedSkills()`, `getEquippedSkills()`, `equipSkill()`, `unequipSkill()`, `levelUpSkill()`, `unlockSkill()`, `isSkillUnlocked()`
- Sauvegarder/restaurer dans `buildSaveData()` et `applyLoadedData()`
- Vérification automatique des déblocages quand wave/level change

### Étape 3 : Logique combat (`src/combat.js`)
- Appliquer les skills passifs dans `getPlayerStats()` :
  - Skills permanents : modifier directement les stats
  - Skills conditionnels : vérifier la condition à chaque tick
- Gérer les skills actifs dans `combatTick()` :
  - Tracker les cooldowns et durées actives
  - Appliquer/retirer les buffs temporaires
  - Émettre des événements pour l'UI : `SKILL_ACTIVATED`, `SKILL_EXPIRED`, `SKILL_READY`
- Ajouter les événements dans `events.js`

### Étape 4 : UI Skills page (`src/ui/skills-ui.js`)
- Rendu des 3 slots équipés
- Rendu de la collection avec filtres (tier/type)
- Modal détail d'un skill
- Interactions : équiper, déséquiper, level up
- Écouter les événements pour rafraîchir dynamiquement

### Étape 5 : UI Combat indicators (`src/ui/combat-ui.js`)
- Ajouter la barre d'icônes de skills sous la HP du joueur
- Animations de cooldown (overlay grisé avec timer)
- Glow quand un skill s'active
- Nombres de dégâts spéciaux (poison, thorns, etc.)

### Étape 6 : CSS (`style.css`)
- Styles pour les cartes de skills (bordures colorées par tier)
- Slots équipés avec glow
- Indicateurs de cooldown en combat
- Animations d'activation
- Badges passif/actif
- États verrouillé/débloqué

### Étape 7 : Intégration
- Ajouter les events dans `events.js`
- Wire le tout dans `main.js`
- Ajouter les skills au `buildSaveData()` / `applyLoadedData()`
- Vérifier les déblocages dans `setCombatWave()` et `addXP()`

### Étape 8 : Tests
- Tests unitaires pour la config des skills
- Tests pour la logique d'équipement (max 3, swap)
- Tests pour les effets en combat (passifs, actifs, cooldowns)
- Tests pour le level up et les coûts
