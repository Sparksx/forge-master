# Forge Master ⚒️

> ⚠️ **Work In Progress** — Ce projet est en cours de développement. Des fonctionnalités peuvent être incomplètes ou changer à tout moment.

**Forge Master** est un jeu de craft d'équipement et de progression dans lequel vous forgez des objets aléatoires, optimisez vos stats et montez en puissance.

🎮 **[Jouer maintenant sur GitHub Pages](https://sparksx.github.io/forge-master/)**

## Concept

Forgez des équipements aléatoires (armes, armures, accessoires), équipez les meilleurs, vendez les autres et améliorez votre score de puissance. Chaque objet a un niveau aléatoire et des bonus de stats uniques.

## Fonctionnalités

### Système de forge
- Forge d'équipements aléatoires avec niveaux (1-100)
- 8 emplacements d'équipement : Chapeau, Armure, Ceinture, Bottes, Gants, Collier, Anneau, Arme
- Bonus de stats aléatoires : Vitesse d'attaque, Chance de critique, Multiplicateur de critique, Multi santé, Multi dégâts, Régénération, Vol de vie
- Comparaison visuelle des stats entre l'ancien et le nouvel objet

### Progression
- Score de puissance calculé à partir de la santé, des dégâts et des bonus
- Plage de niveaux de forge qui évolue selon votre équipement actuel
- Système d'or : vendez vos anciens objets pour accumuler de l'or

### Boutique
- Achat d'or via la boutique (4 paliers)

### Interface
- Navigation par onglets (PvP, Donjon, Accueil, Améliorations, Boutique)
- Modales de détail d'objet avec comparaison colorée
- Design responsive optimisé mobile
- Sauvegarde automatique via localStorage

### Qualité
- Suite de tests unitaires (45+ tests avec Vitest)
- CI/CD avec GitHub Actions
- Déploiement automatique sur GitHub Pages

## Fonctionnalités à venir

- Système de raretés (Commun / Rare / Épique / Légendaire)
- Mode PvP
- Système de donjons
- Améliorations (Compétences, Familiers, Technologies)

## Stack technique

- JavaScript (ES6 modules)
- Vite
- Vitest
- CSS vanilla
- GitHub Actions (CI/CD)
