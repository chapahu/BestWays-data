# BestWays-data

Données publiques préparées pour l'appli BestWays (Île-de-France). Aucune donnée personnelle.

| Branche | Contenu | Mise à jour |
|---|---|---|
| `pack` | `pack.bin.gz` : horaires théoriques précompilés (~40 jours) et `pack.meta.json` | chaque nuit |
| `stats` | `stats.json` : historique des retards réels par ligne, arrêt et tranche horaire | toutes les 10 min |
| `main` | ce README et le collecteur (`collector/collect.js`, `.github/workflows/collect.yml`) | — |

Les branches `pack` et `stats` ne contiennent qu'un seul commit, remplacé à chaque publication.

## Sources et licences

- Horaires : **Île-de-France Mobilités**, « Offre horaires TC GTFS IDFM », https://data.iledefrance-mobilites.fr — Open Database License (ODbL) 1.0.
- Retards : **Île-de-France Mobilités**, plateforme PRIM (https://prim.iledefrance-mobilites.fr), flux « estimated-timetable » — ODbL 1.0.
- Réseau piéton (dans le pack) : © les contributeurs **OpenStreetMap**, https://www.openstreetmap.org/copyright — ODbL 1.0.

Les fichiers de ce dépôt sont des bases de données dérivées, redistribuées sous la même licence ODbL :
https://opendatacommons.org/licenses/odbl/1-0/
