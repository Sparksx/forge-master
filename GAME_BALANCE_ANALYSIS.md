# Analyse d'Equilibre - Forge Master

> Rapport complet d'analyse des mecaniques de jeu, de la progression et de l'equilibre.

---

## Table des matieres

1. [Resume executif](#1-resume-executif)
2. [Prix de la Forge (niveaux 1-30)](#2-prix-de-la-forge-niveaux-1-30)
3. [Prix des Technologies](#3-prix-des-technologies)
4. [Prix des Skills](#4-prix-des-skills)
5. [Gains de Gold](#5-gains-de-gold)
6. [Gains d'Essence](#6-gains-dessence)
7. [Gains de Fragments (Skill Shards)](#7-gains-de-fragments-skill-shards)
8. [Probabilites et systemes de gacha](#8-probabilites-et-systemes-de-gacha)
9. [Difficulte d'evolution et temps cumules](#9-difficulte-devolution-et-temps-cumules)
10. [Analyse de l'equilibre combat vs progression](#10-analyse-de-lequilibre-combat-vs-progression)
11. [Diagnostic et recommandations](#11-diagnostic-et-recommandations)

---

## 1. Resume executif

**Forge Master** est un jeu idle/progression avec forge d'equipement, combat par vagues, arbre technologique et systeme de skills. L'analyse revele **plusieurs desequilibres significatifs** :

- **La forge niveaux 20-30 est excessivement longue** : 121.7 jours de temps reel cumule sans speed-up
- **Le systeme de skill shards est correctement scale pour les hauts tiers (T5-T6)** mais **les skills T1-T2 sont paradoxalement les plus longues a maxer**
- **L'essence est le goulot d'etranglement principal** : certaines techs (waveBreaker, forgeMultiple, researchQueue) coutent astronomiquement cher
- **Le gold scaling est globalement coherent** grace a l'auto-forge, mais il y a un "mur" entre les niveaux 18-22 de la forge
- **La monetisation par diamants est agressive** pour le speed-up de forge (175,180 diamants pour tout skip)

---

## 2. Prix de la Forge (niveaux 1-30)

### 2.1 Tableau complet des couts et temps

| Niveau | Cout (Gold) | Temps | Temps cumule | Cout cumule |
|--------|------------|-------|--------------|-------------|
| 1 -> 2 | 200 | 1 min | 1 min | 200 |
| 2 -> 3 | 500 | 3 min | 4 min | 700 |
| 3 -> 4 | 1,000 | 6 min | 10 min | 1,700 |
| 4 -> 5 | 1,800 | 10 min | 20 min | 3,500 |
| 5 -> 6 | 3,000 | 20 min | 40 min | 6,500 |
| 6 -> 7 | 5,000 | 30 min | 1h10 | 11,500 |
| 7 -> 8 | 8,000 | 1h | 2h10 | 19,500 |
| 8 -> 9 | 12,000 | 1h30 | 3h40 | 31,500 |
| 9 -> 10 | 18,000 | 2h | 5h40 | 49,500 |
| 10 -> 11 | 27,000 | 4h | 9h40 | 76,500 |
| 11 -> 12 | 40,000 | 6h | 15h40 | 116,500 |
| 12 -> 13 | 60,000 | 10h | 25h40 | 176,500 |
| 13 -> 14 | 85,000 | 14h | 39h40 | 261,500 |
| 14 -> 15 | 120,000 | 20h | 59h40 | 381,500 |
| 15 -> 16 | 170,000 | 28h | 87h40 | 551,500 |
| 16 -> 17 | 250,000 | 40h | 127h40 | 801,500 |
| 17 -> 18 | 360,000 | 56h | 183h40 | 1,161,500 |
| 18 -> 19 | 500,000 | 72h (3j) | 255h40 | 1,661,500 |
| 19 -> 20 | 700,000 | 96h (4j) | 351h40 | 2,361,500 |
| 20 -> 21 | 1,000,000 | 120h (5j) | 471h40 | 3,361,500 |
| 21 -> 22 | 1,400,000 | 144h (6j) | 615h40 | 4,761,500 |
| 22 -> 23 | 2,000,000 | 168h (7j) | 783h40 | 6,761,500 |
| 23 -> 24 | 2,800,000 | 192h (8j) | 975h40 | 9,561,500 |
| 24 -> 25 | 4,000,000 | 216h (9j) | 1191h40 | 13,561,500 |
| 25 -> 26 | 5,500,000 | 240h (10j) | 1431h40 | 19,061,500 |
| 26 -> 27 | 7,500,000 | 288h (12j) | 1719h40 | 26,561,500 |
| 27 -> 28 | 10,000,000 | 336h (14j) | 2055h40 | 36,561,500 |
| 28 -> 29 | 14,000,000 | 384h (16j) | 2439h40 | 50,561,500 |
| 29 -> 30 | 20,000,000 | 480h (20j) | 2919h40 | 70,561,500 |

### 2.2 Totaux

| Metrique | Valeur |
|----------|--------|
| **Cout total (gold)** | **70,561,500** |
| **Temps total** | **2,919h40 = ~121.7 jours** |
| **Cout speed-up total (diamants)** | **175,180 diamants** |
| **Valeur monetaire du speed-up** | **~$175 USD** (au meilleur pack) |

### 2.3 Observations

- **Phase 1 (niv 1-10)** : Accessible, 5h40 cumulees, ~49,500 gold. Bon pour l'onboarding.
- **Phase 2 (niv 10-20)** : Transition. Le temps passe de quelques heures a quelques jours par niveau. 346h cumulees (14.4 jours).
- **Phase 3 (niv 20-30)** : **Extremement long**. Chaque niveau prend 5 a 20 jours reels. Le dernier niveau seul prend 20 jours.
- Le ratio cout/temps montre que **le temps est le vrai goulot**, pas le gold (le gold peut etre farme via auto-forge pendant que le timer tourne).

### 2.4 Probabilites de tiers par niveau de forge

| Niveau | Common | Uncommon | Rare | Epic | Legendary | Mythic | Divine |
|--------|--------|----------|------|------|-----------|--------|--------|
| 1 | 100% | - | - | - | - | - | - |
| 5 | 90.5% | 8% | 1.5% | - | - | - | - |
| 10 | 74% | 17% | 8% | 1% | - | - | - |
| 15 | 54% | 22.5% | 15% | 8% | 0.5% | - | - |
| 20 | 34% | 21% | 19.5% | 17% | 8.5% | - | - |
| 25 | 14.5% | 14.5% | 18% | 24% | 24.5% | 4% | 0.5% |
| 30 | - | 4% | 10% | 21% | **49%** | **13%** | **3%** |

**Constat** : Le tier Divine n'apparait qu'a partir du niveau 25 avec 0.5%, pour atteindre seulement 3% au niveau max. Meme au niveau 30, **il faut forger ~33 items en moyenne pour obtenir un Divine**. Avec la tech `tierAffinity` max (+6%), cette probabilite monte a environ 9%, soit ~11 items par Divine.

---

## 3. Prix des Technologies

### 3.1 Branche Forge

| Tech | Niv max | Cout total (essence) | Temps total | Pre-requis |
|------|---------|---------------------|-------------|------------|
| Forge Multiple | 5 | 60,500 | 10.1h | - |
| Forge Rapide | 3 | 3,250 | 1.3h | forgeMultiple 1 |
| Affinite de Tier | 3 | 5,200 | 2.2h | forgeMultiple 2 |
| Forge Selective | 2 | 4,000 | 1.25h | forgeMultiple 3 |
| Maitre Forgeron | 1 | 8,000 | 2h | tierAffinity 3 |

**Sous-total branche : 80,950 essence / 16.8h**

**Point critique** : `forgeMultiple` coute 60,500 essence a cause du costScale de x3 par niveau. Le niveau 5 seul coute 40,500 essence (500 x 3^4). C'est le **tech le plus cher** de la branche mais aussi le plus impactant (x6 items forges).

Detail `forgeMultiple` par niveau :

| Niveau | Cout | Temps |
|--------|------|-------|
| 1 | 500 | 5 min |
| 2 | 1,500 | 15 min |
| 3 | 4,500 | 45 min |
| 4 | 13,500 | 2.25h |
| 5 | 40,500 | 6.75h |

### 3.2 Branche Equipement

| Tech | Niv max | Cout total (essence) | Temps total | Pre-requis |
|------|---------|---------------------|-------------|------------|
| Maitrises (x8) | 25 chaque | ~5,140 chaque / **41,112 total** | ~67 min chaque / **8.9h total** | - |
| Bonus Ameliores | 5 | 19,332 | 8.6h | 1 maitrise niv 5 |
| Bonus Supplementaire | 3 | 42,000 | 13h | bonusEnhance 3 |
| Chef-d'oeuvre | 1 | 6,000 | 2h | hatMastery 10 + weaponMastery 10 |

**Sous-total branche : 108,444 essence / 32.5h**

Detail d'une maitrise d'equipement (identique pour les 8 slots) :

| Niveau | Cout | Temps | Cout cumule | Temps cumule |
|--------|------|-------|-------------|--------------|
| 1 | 15 | 30s | 15 | 30s |
| 5 | 29 | 47s | 107 | 3min10 |
| 10 | 64 | 83s | 356 | 8min20 |
| 15 | 139 | 146s | 867 | 18min |
| 20 | 302 | 258s | 1,895 | 34min |
| 25 | 656 | 455s | 5,139 | 67min |

### 3.3 Branche Combat

| Tech | Niv max | Cout total (essence) | Temps total | Pre-requis |
|------|---------|---------------------|-------------|------------|
| Vitalite | 10 | 1,396 | 42.6 min | - |
| Force | 10 | 1,396 | 42.6 min | - |
| Frappe Rapide | 5 | 12,888 | 10.7h | strength 3 |
| Brise-Vagues | 5 | **72,600** | **32.2h** | vitality 3 + strength 3 |
| XP de Bataille | 5 | 4,650 | 2.6h | waveBreaker 1 |

**Sous-total branche : 92,930 essence / 48.7h**

**Point critique** : `waveBreaker` est de loin le tech le plus cher du jeu (72,600 essence). Le niveau 5 seul coute 48,600 essence. Pour seulement +2 vagues supplementaires par niveau, le rapport cout/benefice est discutable.

Detail `waveBreaker` par niveau :

| Niveau | Cout | Temps | Vagues totales |
|--------|------|-------|----------------|
| 1 | 600 | 30 min | 12 |
| 2 | 1,800 | 75 min | 14 |
| 3 | 5,400 | 3.1h | 16 |
| 4 | 16,200 | 7.8h | 18 |
| 5 | 48,600 | 19.5h | 20 |

### 3.4 Branche Economie

| Tech | Niv max | Cout total (essence) | Temps total | Pre-requis |
|------|---------|---------------------|-------------|------------|
| Ruee vers l'Or | 25 | 2,128 | 49 min | - |
| Essence de Forge | 25 | 3,192 | 73.8 min | goldRush 5 |
| Chercheur de Tresors | 3 | 6,500 | 3.25h | goldRush 10 |
| Resonance d'Essence | 3 | 7,800 | 4.3h | essenceStudy 5 |

**Sous-total branche : 19,620 essence / 9.4h**

C'est la branche **la plus abordable**, ce qui est logique car elle accelere la generation de ressources.

### 3.5 Branche Automatisation

| Tech | Niv max | Cout total (essence) | Temps total | Pre-requis |
|------|---------|---------------------|-------------|------------|
| Filtre Intelligent | 3 | 31,500 | 10.5h | forgeMultiple 2 + goldRush 5 |
| Auto-Equipement | 1 | 8,000 | 2h | smartFilter 3 + forgeMultiple 3 |
| File de Recherche | 3 | 42,000 | 14h | smartFilter 1 + essenceStudy 3 |

**Sous-total branche : 81,500 essence / 26.5h**

**Point critique** : `researchQueue` et `smartFilter` ont des costScale de x4, ce qui rend les derniers niveaux tres chers. Le niveau 3 de `researchQueue` coute 32,000 essence a lui seul.

### 3.6 Synthese des techs

| Branche | Cout total (essence) | Temps total | % du total |
|---------|---------------------|-------------|------------|
| Forge | 80,950 | 16.8h | 21.1% |
| Equipement | 108,444 | 32.5h | 28.3% |
| Combat | 92,930 | 48.7h | 24.2% |
| Economie | 19,620 | 9.4h | 5.1% |
| Automatisation | 81,500 | 26.5h | 21.3% |
| **TOTAL** | **383,444** | **133.9h (~5.6j)** | **100%** |

Le temps de recherche total (133.9h) est bien inferieur au temps de forge (2919h), mais le goulot est l'essence necessaire (383,444).

---

## 4. Prix des Skills

### 4.1 Systeme de copies

Les skills se debloquent par copies (obtenues via le forge de skills avec des Skill Shards). Le cout en copies est **exponentiel** :

| Niveau | Copies necessaires | Copies cumulees |
|--------|--------------------|-----------------|
| 1 | 1 | 1 |
| 2 | 2 | 3 |
| 3 | 4 | 7 |
| 4 | 8 | 15 |
| 5 | 16 | 31 |
| 6 | 32 | 63 |
| 7 | 64 | 127 |
| 8 | 128 | 255 |
| 9 | 256 | 511 |
| 10 | 512 | 1,023 |

### 4.2 Niveau max par tier et copies totales requises

| Tier | Niv max | Copies pour max | Skills dans le tier |
|------|---------|-----------------|---------------------|
| T1 (Common) | 10 | **1,023** | 4 (2P + 2A) |
| T2 (Uncommon) | 8 | **255** | 4 |
| T3 (Rare) | 6 | **63** | 4 |
| T4 (Epic) | 5 | **31** | 4 |
| T5 (Legendary) | 4 | **15** | 4 |
| T6 (Mythic) | 3 | **7** | 4 |

### 4.3 Cout reel en shards pour maxer une skill specifique

Pour obtenir une copie d'une skill specifique, il faut :
1. Forger une skill (5 shards)
2. Obtenir le bon tier (probabilite variable selon la wave)
3. Obtenir la bonne skill dans le tier (1/4 car 4 skills par tier)

**Exemple : Maxer "Tough Skin" (T1, niv 10) a la wave 1** :
- Besoin : 1,023 copies
- Chance par forge : 100% T1 x 25% cette skill = 25%
- Forges necessaires : 1,023 / 0.25 = **4,092 forges**
- Shards necessaires : 4,092 x 5 = **20,460 shards**
- Sub-waves necessaires : ~17,050 (a 1.2 shards/sub-wave en moyenne)
- Equivalent : **~1,705 vagues completes**

**Exemple : Maxer "Apocalypse" (T6, niv 3) a la wave 10** :
- Besoin : 7 copies
- Chance par forge : 28% T6 x 25% cette skill = 7%
- Forges necessaires : 7 / 0.07 = **100 forges**
- Shards necessaires : 100 x 5 = **500 shards**
- Sub-waves necessaires : ~417
- Equivalent : **~42 vagues completes**

### 4.4 Tableau comparatif du grind pour maxer une skill specifique

| Skill | Tier | Copies | Forges moy. (wave 10) | Shards | Vagues equiv. |
|-------|------|--------|----------------------|--------|---------------|
| T1 skill | 1 | 1,023 | 13,640 | 68,200 | 5,683 |
| T2 skill | 2 | 255 | 1,457 | 7,286 | 607 |
| T3 skill | 3 | 63 | 210 | 1,050 | 88 |
| T4 skill | 4 | 31 | 62 | 310 | 26 |
| T5 skill | 5 | 15 | 20 | 100 | 8 |
| T6 skill | 6 | 7 | 10 | 50 | 4 |

> A la wave 10 : les chances T1 ne sont que de 3%, rendant le grind T1 **absurde** (5,683 vagues).

### 4.5 Les 24 skills et leurs effets

#### Passives

| Skill | Tier | Effet/niveau | Max niv | Effet max |
|-------|------|-------------|---------|-----------|
| Tough Skin | T1 | +5% HP | 10 | +50% HP |
| Sharp Blade | T1 | +5% DMG | 10 | +50% DMG |
| Quick Reflexes | T2 | +3% atk speed | 8 | +24% atk speed |
| Lucky Strike | T2 | +2% crit | 8 | +16% crit |
| Berserker's Rage | T3 | +5% seuil HP (x2 atk speed) | 6 | Seuil a 45% HP |
| Thorn Armor | T3 | +5% reflexion dmg | 6 | 35% reflexion |
| Vampiric Aura | T4 | +3% life steal | 5 | +15% life steal |
| Overkill | T4 | +10% excess dmg carry | 5 | 90% carry |
| Undying Will | T5 | -5s cooldown interne | 4 | 45s CD (survie letale) |
| Elemental Mastery | T5 | +5% bonus equip | 4 | +20% tous bonus |
| Soul Harvest | T6 | +0.5% dmg/kill stacking | 3 | +2% par kill |
| Transcendence | T6 | +1% all stats/player level | 3 | +3% par level |

#### Actives

| Skill | Tier | Effet/niveau | CD base | CD min | Max niv | Duree |
|-------|------|-------------|---------|--------|---------|-------|
| Shield Wall | T1 | +2% reduction dmg | 30s | 21s | 10 | 5s |
| Power Strike | T1 | +10% dmg/charge | 25s | 25s | 10 | 3 charges |
| Battle Cry | T2 | +5% atk speed | 35s | 28s | 8 | 6s |
| Healing Surge | T2 | +3% heal max HP | 40s | 33s | 8 | instant |
| Focus | T3 | +2% crit, +5% crit multi | 45s | 40s | 6 | 8s |
| Enrage | T3 | +5% dmg, -2% dmg taken | 30s | 30s | 6 | 8s |
| Evasion | T4 | +5% dodge | 40s | 36s | 5 | 6s |
| Life Drain | T4 | +5% life steal | 45s | 41s | 5 | 8s |
| War Cry | T5 | +2% all stats | 60s | 54s | 4 | 10s |
| Execute | T5 | +50% dmg (< 30% HP) | 45s | 39s | 4 | instant |
| Apocalypse | T6 | +100% dmg AoE | 90s | 80s | 3 | instant |
| Divine Shield | T6 | +0.5s immunite | 120s | 110s | 3 | 4-5s |

---

## 5. Gains de Gold

### 5.1 Sources de gold

#### A. Vente d'items (source principale)

```
sellValue = level x tier x (1 + goldRush%)
```

| Situation | Level moy. | Tier moy. | goldRush | Sell value moy. |
|-----------|-----------|-----------|----------|-----------------|
| Debut (forge niv 1) | 5 | 1 | 0% | 5 |
| Early (forge niv 5) | 15 | 1.1 | 0% | 17 |
| Mid (forge niv 15) | 40 | 1.8 | 20% | 86 |
| Late (forge niv 25) | 60 | 3.5 | 40% | 294 |
| End (forge niv 30) | 70 | 4.5 | 50% | 473 |

#### B. Gains horaires avec auto-forge

Avec auto-forge (3.5s intervalle, reduit par quickForge) et forgeMultiple :

| Phase | Items/forge | Interval | Sell moy. | Gold/heure |
|-------|------------|----------|-----------|------------|
| Sans tech | 1 | 3.5s | 5 | 5,143 |
| forgeMultiple 1, quickForge 1 | 2 | 3.15s | 30 | 68,571 |
| forgeMultiple 3, quickForge 2 | 4 | 2.8s | 86 | 441,600 |
| forgeMultiple 5, quickForge 3 | 6 | 2.45s | 294 | 2,592,000 |
| Max techs, forge niv 30 | 6 | 2.45s | 473 | 4,173,000 |

#### C. Recompenses de niveau joueur

```
gold = (50 + level x 25) -- normal
gold = (50 + level x 25) x 10 -- milestone (chaque 10 niveaux)
```

| Niveau | Recompense | Cumule (niv 1-N) |
|--------|-----------|------------------|
| 5 | 175 | 750 |
| 10 | **3,000** (milestone) | 4,125 |
| 20 | **5,500** (milestone) | 14,375 |
| 50 | **13,000** (milestone) | 48,125 |
| 100 | **25,500** (milestone) | 134,375 |

Total gold des niveaux joueur (1-100) : **~134,375 gold** -- insignifiant compare aux besoins de la forge.

#### D. Milestones du shop

| Milestone | Gold |
|-----------|------|
| Wave 2 | 200 |
| Wave 4 | 500 |
| Wave 6 | 1,000 |
| Wave 8 | 2,500 |
| Wave 10 | 5,000 |
| **Total** | **9,200** |

#### E. Daily rewards

```
gold = 50 + streak x 25
```

| Streak | Gold/jour |
|--------|----------|
| 0 | 50 |
| 7 | 225 |
| 30 | 800 |
| 100 | 2,550 |

Les dailies sont **negligeables** face aux couts de forge (20M pour le dernier niveau).

#### F. Boutique diamants

| Offre | Cout | Gold | Gold/diamant |
|-------|------|------|-------------|
| Gold S | 10 | 5,000 | 500 |
| Gold M | 50 | 30,000 | 600 |
| Gold L | 100 | 75,000 | 750 |

### 5.2 Temps de farm pour chaque upgrade de forge

| Upgrade | Cout gold | Gold/h (mid) | Temps de farm |
|---------|-----------|-------------|--------------|
| niv 10 | 18,000 | ~70,000 | ~15 min |
| niv 15 | 120,000 | ~200,000 | ~36 min |
| niv 20 | 700,000 | ~440,000 | ~1.6h |
| niv 25 | 4,000,000 | ~1,500,000 | ~2.7h |
| niv 30 | 20,000,000 | ~4,000,000 | ~5h |

> Le gold est farmable en parallele du timer de forge. Le **temps reel** (timer) est donc le vrai limitant, pas le gold.

---

## 6. Gains d'Essence

### 6.1 Formule

```
essence par item = tier x (1 + essenceStudy%)
essenceStudy max : 25 x 2% = 50%
```

### 6.2 Taux de generation

| Phase | Tier moy. | essenceStudy | Ess/item | Items/h | Essence/h |
|-------|-----------|-------------|----------|---------|-----------|
| Debut | 1 | 0% | 1 | 1,029 | 1,029 |
| Early | 1.3 | 10% | 1.4 | 2,057 | 2,880 |
| Mid | 2.5 | 30% | 3.3 | 5,143 | 16,971 |
| Late | 4.0 | 50% | 6 | 8,816 | 52,898 |
| Max | 4.5 | 50% | 6.75 | 8,816 | 59,510 |

### 6.3 Temps pour financer les techs critiques

| Tech | Cout essence | A mid (16,971/h) | A late (52,898/h) |
|------|-------------|-----------------|-------------------|
| forgeMultiple 5 (total) | 60,500 | 3.6h | 1.1h |
| waveBreaker 5 (total) | 72,600 | 4.3h | 1.4h |
| researchQueue 3 (total) | 42,000 | 2.5h | 0.8h |
| Toutes les techs | 383,444 | **22.6h** | **7.2h** |

### 6.4 Le probleme du bootstrapping

Le joueur doit gagner de l'essence pour debloquer les techs qui augmentent son essence/h. La boucle de progression est :

1. Forge basique -> peu d'essence (1/item)
2. Investir dans `essenceStudy` (pre-requis : goldRush 5)
3. Investir dans `goldRush` d'abord (cout faible : ~2,128 essence total)
4. Puis `essenceStudy` (~3,192 essence total)

Le debut est **lent** : il faut environ **5,300 essence** avant de voir un retour significatif sur l'investissement, soit ~5h de farm au debut.

---

## 7. Gains de Fragments (Skill Shards)

### 7.1 Taux de gain

| Source | Shards |
|--------|--------|
| Par sub-wave terminee | 1 |
| Bonus boss (sub-wave 10) | +2 (total 3) |
| **Par vague complete (10 sub-waves)** | **12** |

### 7.2 Economie des shards

- **Cout d'un forge de skill** : 5 shards
- **Skills par vague** : 12 / 5 = **2.4 skill forges par vague**

### 7.3 Taux reel de farm

Le taux depend de la vitesse de combat. Si le joueur farm au niveau qu'il clear facilement :

| Situation | Temps/sub-wave | Shards/heure | Skill forges/heure |
|-----------|---------------|-------------|-------------------|
| Farm facile | ~5-10s | 360-720 | 72-144 |
| Farm medium | ~15-30s | 120-240 | 24-48 |
| Bloque (defaites) | variable | variable | variable |

### 7.4 Analyse du grind total pour maxer le systeme de skills

Pour maxer **une** skill de chaque tier (la mieux possible) a la wave 10 :

| Tier | Copies | Prob/forge | Forges | Shards | Heures farm |
|------|--------|-----------|--------|--------|-------------|
| T1 | 1,023 | 0.75% | 136,400 | 682,000 | 948-1895h |
| T2 | 255 | 1.75% | 14,571 | 72,857 | 101-203h |
| T3 | 63 | 3% | 2,100 | 10,500 | 15-29h |
| T4 | 31 | 5% | 620 | 3,100 | 4.3-8.6h |
| T5 | 15 | 7.5% | 200 | 1,000 | 1.4-2.8h |
| T6 | 7 | 7% | 100 | 500 | 0.7-1.4h |

> **Maxer une skill T1 a la wave 10 est pratiquement impossible** : ~1,000-1,900 heures de farm continu. Cela correspond a **41-79 jours de jeu non-stop** ou **1-2 ans de jeu casual (2h/jour)**.

---

## 8. Probabilites et systemes de gacha

### 8.1 Forge d'equipement

Le systeme de forge est un **gacha a couches multiples** :

1. **Tier** : determine par le niveau de forge (table fixe de probabilites)
2. **Type d'equipement** : 1/8 chance par slot (aleatoire uniforme)
3. **Niveau** : +/-10 du plus haut forge pour ce slot/tier
4. **Bonus stats** : nombre base sur le tier (0 a 3), type aleatoire, valeur aleatoire

**Probabilite d'obtenir un item "parfait"** (bon slot + bon tier + bon niveau + bons bonus) :

Pour un item T6 Mythic, bon slot, bon niveau, bon bonus au forge niv 30 :
- Chance tier 6 : 13%
- Bon slot : 12.5% (1/8)
- Bon niveau (top 20%) : 20%
- 2 bonus corrects (parmi 7) : ~18.4%

**Probabilite combinee : ~0.060%** soit **1 item sur ~1,667 forges**.

Avec 6 items par forge (forgeMultiple 5) : ~1 tous les ~278 forges = ~16 min d'auto-forge.

### 8.2 Forge de skills

Systeme similaire mais plus simple :
1. **Tier** : determine par la wave la plus haute atteinte
2. **Skill** : aleatoire parmi les skills du tier (1/2 pour passif/actif, 1/4 global)

A la wave 10, les probabilites sont raisonnables pour les tiers hauts mais **punissent les joueurs qui veulent maxer les skills bas tiers**.

### 8.3 Tech tierAffinity

Effet : deplace les probabilites des tiers bas vers les tiers hauts.

| Niveau | Shift | Impact sur T6 (forge 30) | Impact sur T7 (forge 30) |
|--------|-------|--------------------------|--------------------------|
| 0 | 0% | 13% | 3% |
| 1 | +2% | ~15% | ~5% |
| 2 | +4% | ~17% | ~7% |
| 3 | +6% | ~19% | ~9% |

L'impact est **significatif** sur les tiers rares. Il triple la chance de T7 (Divine).

---

## 9. Difficulte d'evolution et temps cumules

### 9.1 Courbe de progression ideale

Voici une estimation de la progression d'un joueur actif (2-3h/jour) :

| Etape | Contenu | Temps estime |
|-------|---------|-------------|
| **Jour 1** | Forge niv 1-6, Wave 1-2, premieres techs (goldRush, maitrises) | 3h |
| **Jour 2-3** | Forge niv 7-9, Wave 3-4, forgeMultiple 1-2 | 5h |
| **Jour 4-7** | Forge niv 10, Wave 5-6, techs economie | 10h |
| **Semaine 2** | Forge niv 11-13, Wave 7-8, forgeMultiple 3 | 15h |
| **Semaine 3-4** | Forge niv 14-16, Wave 9-10, skills T1-T3 | 25h |
| **Mois 2** | Forge niv 17-20, techs combat/automation | 50h |
| **Mois 3-4** | Forge niv 21-25, waveBreaker, skills T4-T5 | 90h |
| **Mois 5-8+** | Forge niv 26-30, max techs, skills T6 | 200h+ |

**Temps total pour "completer" le jeu** : ~400-500h (estimation conservatrice)

### 9.2 Murs de progression identifies

#### Mur 1 : Forge niv 10 -> 11 (le premier timer wall)

Le temps passe de 2h a 4h. Le joueur decouvre que le gold n'est plus le probleme mais le temps reel.
**Impact** : Risque de decrochage si le joueur n'a pas d'autres activites (combat, techs).

#### Mur 2 : Forge niv 18-22 (le grand mur)

Les timers passent de 2-3 jours a 5-7 jours PAR NIVEAU. Pendant 5 niveaux consecutifs, le joueur ne voit pas de progression significative.
**Impact** : **Forte pression a la monetisation** (speed-up par diamants). C'est le moment ou le jeu incite le plus a payer.

#### Mur 3 : Essence pour forgeMultiple 4-5

forgeMultiple niv 4 coute 13,500 essence et niv 5 coute 40,500 essence. Avant d'avoir des tiers eleves, generer cette quantite est tres lent.
**Impact** : Le joueur doit choisir entre investir dans forgeMultiple (rendement a long terme) ou dans les maitrises/combat (impact immediat).

#### Mur 4 : waveBreaker (cout disproportionne)

72,600 essence au total pour un benefice marginal (+10 vagues supplementaires au total). La majorite des joueurs ne maxeront probablement jamais ce tech.
**Impact** : Contenu potentiellement inaccessible (vagues 11-20).

### 9.3 Temps cumule de toutes les activites

| Activite | Temps pour tout maxer |
|----------|----------------------|
| Forge (timers niv 1-30) | **2,919h (121.7j)** |
| Techs (timers de recherche) | **133.9h (5.6j)** |
| Gold farming (pour forge) | ~25-30h (en parallele des timers) |
| Essence farming (pour techs) | ~20-25h (en parallele des timers) |
| Skills T6 max (3 skills) | ~3-5h |
| Skills T1 max (2 skills) | **~2,000-3,800h** (non-realiste) |

> **Le temps de forge est le facteur dominant** de la progression. Meme avec un farm optimal, le joueur doit simplement attendre ~122 jours pour la forge seule.

---

## 10. Analyse de l'equilibre combat vs progression

### 10.1 Scaling des monstres

Les monstres utilisent une formule de croissance agressive :

```
effectiveLevel = 3 + 1.5 x stage^1.55
HP = HEALTH_PER_LEVEL x effectiveLevel^1.2 x 2.5
DMG = DAMAGE_PER_LEVEL x effectiveLevel^1.2 x 1.8
```

| Stage (wave-sub) | Eff. Level | HP monstre | DMG monstre | Monstres |
|------------------|-----------|-----------|-------------|----------|
| 1-1 | 4.5 | 146 | 21 | 1 |
| 1-5 | 13.5 | 561 | 81 | 2 |
| 1-10 | 25 | 1,207 | 174 | 3 |
| 3-5 | 73 | 4,867 | 701 | 2 |
| 5-5 | 148 | 12,187 | 1,755 | 2 |
| 7-5 | 238 | 22,718 | 3,271 | 2 |
| 10-10 | 497 | 57,854 | 8,331 | 3 |

### 10.2 Stats du joueur (exemples)

Stats calculees pour un equipement "typique" a chaque phase :

```
playerHP = BASE_HEALTH + sum(healthItems.stats) x (1 + healthMulti/100) x (1 + vitality/100)
playerDMG = BASE_DAMAGE + sum(dmgItems.stats) x (1 + dmgMulti/100) x (1 + strength/100)
```

| Phase | Tier moyen | Level moy | HP total | DMG total |
|-------|-----------|-----------|----------|-----------|
| Forge 5 | T1 | 15 | ~800 | ~120 |
| Forge 10 | T2 | 40 | ~4,000 | ~500 |
| Forge 15 | T3 | 60 | ~15,000 | ~1,800 |
| Forge 20 | T4 | 80 | ~45,000 | ~5,500 |
| Forge 25 | T5 | 90 | ~120,000 | ~15,000 |
| Forge 30 | T6-T7 | 100+ | ~300,000+ | ~40,000+ |

### 10.3 Adequation combat/forge

Le systeme est **globalement bien calibre** pour les waves 1-10 :
- Wave 1 est faisable avec du T1 niv 15-20 (confirme par le code)
- Wave 3+ necessite du T2+
- Wave 10 necessite du T4-T5 avec des bonus stats

Les waves 11-20 (via waveBreaker) ne semblent avoir **aucune recompense supplementaire** significative en dehors des shards de combat, ce qui rend le tech waveBreaker **encore moins rentable**.

### 10.4 Vitesse d'attaque

```
attackSpeed = max(400ms, 1500 - totalAttackSpeed% x 15)
```

Pour atteindre le cap de 400ms :
- Besoin de (1500 - 400) / 15 = **73.3% d'attack speed**
- Sources : bonus stats (max 15%), swiftStrikes tech (max 15%), Quick Reflexes skill (max 24%), Battle Cry active (+30% temporaire), War Cry (+15% temporaire)
- Max permanent : 15 + 15 + 24 = 54% -> 1500 - 810 = **690ms** (sans actives)
- Avec War Cry : 54 + 15 = 69% -> 465ms
- Le cap de 400ms est **atteignable** uniquement avec Battle Cry active (temporaire)

---

## 11. Diagnostic et recommandations

### 11.1 Points d'equilibre corrects

| Aspect | Evaluation | Detail |
|--------|-----------|--------|
| Forge niv 1-10 | Bon | Progression fluide, bon onboarding |
| Techs economie | Bon | Abordable, donne un sentiment de progression rapide |
| Maitrises equipement | Bon | Scaling doux (1.18x), accessible tout au long du jeu |
| Skills T3-T6 | Bon | Copies necessaires raisonnables (7-63), atteignables |
| Combat waves 1-10 | Bon | Bien calibre avec le scaling d'equipement |
| Monetisation shop diamants | Correct | Les offres gold/essence sont des raccourcis, pas des necessites |
| Daily rewards | Faible mais OK | Source mineure qui recompense la connexion reguliere |

### 11.2 Problemes identifies

#### CRITIQUE : Skills T1-T2 impossibles a maxer

**Probleme** : Les skills T1 necessitent 1,023 copies pour max (niv 10) mais deviennent de plus en plus rares aux waves elevees (3% a la wave 10). Le grind necessaire (2,000-3,800h) est absurde.

**Cause** : Le systeme exponentiel de copies (2^(n-1)) combine au niveaux max trop eleves pour les bas tiers.

**Solutions possibles** :
- Reduire le niv max des T1 a 5 (31 copies au lieu de 1,023)
- Ajouter un mecanisme de "focus forge" (choisir le tier desire)
- Augmenter les chances T1 a wave 10 (de 3% a 15-20%)
- Creer un systeme de "conversion" de copies entre tiers

#### MAJEUR : Forge niv 20-30 trop long

**Probleme** : 121.7 jours cumules de timers. Les niveaux 26-30 representent a eux seuls 72 jours.

**Cause** : Le scaling du temps est trop agressif dans la derniere tranche.

**Solutions possibles** :
- Plafonner les timers a 7 jours max (168h)
- Ajouter des methodes de reduction de timer (tech, combat milestones)
- Offrir des "boosts de forge" comme recompenses de vagues elevees

#### MAJEUR : waveBreaker cout disproportionne

**Probleme** : 72,600 essence pour un benefice marginal (+10 vagues). C'est la tech la plus chere du jeu.

**Cause** : costScale de x3 sur 5 niveaux, avec un baseCost deja eleve (600).

**Solutions possibles** :
- Reduire le costScale a 2 ou 2.5
- Ajouter des recompenses significatives aux vagues 11-20 (bonus gold, essence, shards)
- Reduire a 3 niveaux de waveBreaker

#### MODERE : Manque de recompenses pour les vagues etendues (11-20)

**Probleme** : Les vagues 11-20 n'offrent rien de plus que les shards normaux. Le joueur n'a aucune incitation a debloquer waveBreaker.

**Solution possible** : Ajouter des milestones shop pour les vagues 12, 14, 16, 18, 20 avec des recompenses croissantes (essence, diamants, skill forges gratuits).

#### MODERE : Bootstrapping d'essence lent

**Probleme** : Le debut de jeu genere ~1,000 essence/h. Les premieres techs utiles coutent 500-4,000 essence. Le joueur doit farmer 1-4h avant d'accelerer.

**Solution possible** : Augmenter l'essence de base par item (tier x 2 au lieu de tier x 1) ou offrir un bonus d'essence aux premiers forges.

#### MINEUR : Daily rewards negligeables

**Probleme** : 50 gold de base est insignifiant au-dela du jour 1. Meme avec un streak de 30 jours, la daily ne represente que 800 gold (le cout du niv 4 de forge).

**Solution possible** : Scaler les dailies avec le niveau de forge du joueur, ou ajouter des recompenses essence/shards.

### 11.3 Resume de l'equilibre global

```
TROP FACILE                        EQUILIBRE                      TROP DIFFICILE
    |                                  |                                |
    |                                  |                                |
    |  Daily rewards     Forge 1-10    |  Techs economie               |
    |  Milestones shop   Maitrises     |  Skills T3-T6                 |
    |                    Combat 1-10   |  forgeMultiple                |
    |                                  |  Techs combat (sauf wB)       |
    |                                  |                     Forge 20-30
    |                                  |                     waveBreaker
    |                                  |                     Skills T1 max
    |                                  |                     Skills T2 max
```

### 11.4 Score d'equilibre par systeme

| Systeme | Score /10 | Commentaire |
|---------|----------|-------------|
| Forge (prix gold) | 7/10 | Bien scale, gold farmable en parallele |
| Forge (timers) | 4/10 | Fin de jeu trop agressive (20 jours un seul niveau) |
| Technologies (economie) | 8/10 | Bon rapport cout/impact, bon pacing |
| Technologies (combat) | 5/10 | waveBreaker casse l'equilibre de la branche |
| Technologies (forge) | 6/10 | forgeMultiple domine, les autres sont corrects |
| Technologies (automation) | 6/10 | Utile mais chere (smartFilter, researchQueue) |
| Skills (T3-T6) | 8/10 | Progression satisfaisante, effort raisonnable |
| Skills (T1-T2) | 2/10 | Max levels trop hauts, grind absurde |
| Gold generation | 7/10 | Multi-sources coherentes, auto-forge efficace |
| Essence generation | 6/10 | Bootstrapping lent, puis acceptable |
| Shard generation | 7/10 | Rythme correct pour les skills hauts tiers |
| Combat balance | 8/10 | Bien calibre pour les 10 premieres vagues |
| Monetisation | 6/10 | Fair pour un F2P, pression aux niveaux 18-22 |
| **Global** | **6.2/10** | **Bon fondement, mais des extremes a corriger** |

---

## 12. Corrections appliquees

Les corrections suivantes ont ete implementees dans le code pour adresser les problemes identifies :

### Fix 1 : Skills T1-T2 — Reduction des max levels + buff per-level

**Fichier** : `src/skills-config.js`

**Avant** : T1 max 10 (1,023 copies), T2 max 8 (255 copies)
**Apres** : T1 max 5 (31 copies), T2 max 5 (31 copies)

Les valeurs per-level ont ete augmentees pour compenser la perte de niveaux et preserver ~80% de l'effet max :

| Skill | Avant | Apres | Effet max avant | Effet max apres |
|-------|-------|-------|----------------|----------------|
| Tough Skin (T1 passif) | +5%/niv, max 10 | +8%/niv, max 5 | +50% HP | +40% HP |
| Sharp Blade (T1 passif) | +5%/niv, max 10 | +8%/niv, max 5 | +50% DMG | +40% DMG |
| Shield Wall (T1 actif) | 20% base +2%/niv | 25% base +4%/niv | 38% DR | 41% DR |
| Power Strike (T1 actif) | +10%/niv | +15%/niv | +140% dmg | +110% dmg |
| Quick Reflexes (T2 passif) | +3%/niv, max 8 | +4%/niv, max 5 | +24% atk spd | +20% atk spd |
| Lucky Strike (T2 passif) | +2%/niv, max 8 | +3%/niv, max 5 | +16% crit | +15% crit |
| Battle Cry (T2 actif) | +5%/niv, max 8 | +8%/niv, max 5 | +65% burst | +62% burst |
| Healing Surge (T2 actif) | +3%/niv, max 8 | +5%/niv, max 5 | +41% heal | +40% heal |

**Impact grind** : Le nombre de copies passe de 1,023 a 31 pour T1 et de 255 a 31 pour T2.
Le nombre de forges moyen pour maxer un skill T1 a wave 10 passe de **~13,640 a ~413 forges**.

### Fix 2 : Forge — Plafonnement des timers a 7 jours

**Fichier** : `src/config.js`

Les niveaux 24-30 ont ete plafonnes a 604,800 secondes (7 jours) :

| Niveau | Avant | Apres |
|--------|-------|-------|
| 24 | 8 jours | **7 jours** |
| 25 | 9 jours | **7 jours** |
| 26 | 10 jours | **7 jours** |
| 27 | 12 jours | **7 jours** |
| 28 | 14 jours | **7 jours** |
| 29 | 16 jours | **7 jours** |
| 30 | 20 jours | **7 jours** |

**Temps total forge** : 2,919h (121.7j) -> **1,960h (81.7j)** — reduction de 33%.
**Cout speed-up total** : 175,180 -> **117,180 diamants** — reduction de 33%.

### Fix 3 : waveBreaker — Reduction des couts

**Fichier** : `src/tech-config.js`

| Parametre | Avant | Apres |
|-----------|-------|-------|
| baseCost | 600 | 400 |
| costScale | 3 | 2 |
| baseTime | 1800s (30 min) | 1200s (20 min) |
| timeScale | 2.5 | 2 |

**Couts par niveau** :

| Niveau | Cout avant | Cout apres | Temps avant | Temps apres |
|--------|-----------|-----------|-------------|-------------|
| 1 | 600 | 400 | 30 min | 20 min |
| 2 | 1,800 | 800 | 75 min | 40 min |
| 3 | 5,400 | 1,600 | 3.1h | 1.3h |
| 4 | 16,200 | 3,200 | 7.8h | 2.7h |
| 5 | 48,600 | 6,400 | 19.5h | 5.3h |
| **Total** | **72,600** | **12,400** | **32.2h** | **10h** |

Reduction de **83% du cout** et **69% du temps**.

### Fix 4 : Milestones etendues pour les vagues 11-20

**Fichier** : `src/shop.js`

5 nouveaux milestones ajoutees avec des recompenses multi-ressources :

| Milestone | Gold | Essence | Shards |
|-----------|------|---------|--------|
| Wave 12 | 10,000 | 500 | - |
| Wave 14 | 25,000 | 1,000 | 50 |
| Wave 16 | 50,000 | 2,500 | 100 |
| Wave 18 | 100,000 | 5,000 | 150 |
| Wave 20 | 250,000 | 10,000 | 250 |
| **Total** | **435,000** | **19,000** | **550** |

Ces recompenses justifient l'investissement dans waveBreaker et donnent un objectif concret au contenu etendu.

### Fix 5 : Daily rewards evolutives

**Fichier** : `src/shop.js`

**Avant** : `daily = 50 + streak x 25` (gold seulement)
**Apres** : `daily = 50 + forgeLevel x 50 + streak x 25` (gold) + `forgeLevel x 3` (essence)

| Forge Level | Gold avant (streak 7) | Gold apres (streak 7) | Essence |
|-------------|----------------------|----------------------|---------|
| 1 | 225 | 275 | 3 |
| 10 | 225 | 725 | 30 |
| 15 | 225 | 975 | 45 |
| 20 | 225 | 1,225 | 60 |
| 30 | 225 | 1,725 | 90 |

Les dailies restent un bonus secondaire mais deviennent **significatives** a mesure que le joueur progresse.

### Impact global des corrections

| Metrique | Avant | Apres | Amelioration |
|----------|-------|-------|-------------|
| Temps total forge | 121.7 jours | 81.7 jours | -33% |
| Copies pour max T1 skill | 1,023 | 31 | **-97%** |
| Copies pour max T2 skill | 255 | 31 | **-88%** |
| Cout waveBreaker | 72,600 ess | 12,400 ess | **-83%** |
| Milestones vagues 11-20 | 0 gold | 435,000 gold + 19,000 ess + 550 shards | nouveau |
| Daily gold (forge 15, streak 7) | 225 | 975 | **x4.3** |

**Score d'equilibre estime apres corrections : 7.8/10** (contre 6.2/10 avant)

---

*Rapport genere par analyse statique du code source. Les estimations de temps de farm sont basees sur un gameplay optimal avec auto-forge actif.*
