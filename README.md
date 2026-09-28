# Pavillon 9

Jeu d'horreur 3D à la première personne. Un asile abandonné, généré différemment à chaque partie. Trouve les 5 fusibles, rétablis le courant et atteins la porte de SORTIE avant que le Patient 9 ne te trouve.

## Jouer
**[⬇ Télécharger Pavillon9.exe](https://github.com/VaticUI/Pavillon9/releases/latest/download/Pavillon9.exe)** (Windows, portable, aucune installation).

Windows SmartScreen peut avertir (exe non signé) : « Informations complémentaires » → « Exécuter quand même ».

| Touche | Action |
|---|---|
| ZQSD / WASD | Se déplacer |
| Souris | Regarder |
| Maj | Courir (bruyant) |
| C / Ctrl | S'accroupir (discret) |
| F | Lampe torche |
| E | Interagir |
| Échap | Pause |
| F11 | Plein écran / fenêtré |

La lumière l'attire. Le bruit aussi. Les notes trouvées au sol donnent des indices.

## Développement
```
npm install
npm start        # lance le jeu en mode dev
npm run dist     # produit release/Pavillon9.exe
```
- `src/level.js` : génération du labyrinthe, pathfinding
- `src/world.js` : construction de la scène (murs, lampes, décor, objets)
- `src/monster.js` : modèle et IA de la créature (traque, poursuite, recherche)
- `src/audio.js` : sons 100 % procéduraux (Web Audio)
- `src/textures.js` : textures générées sur canvas
- `src/main.js` : boucle de jeu, joueur, post-traitement, interface
- `tools/snap.js` : test automatisé avec captures d'écran
