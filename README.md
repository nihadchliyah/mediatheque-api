# mediatheque-api

API REST de la médiathèque associative : gestion du catalogue (**ouvrages**) et des **emprunts**.

Stack : Node 24, Express 5, Zod 4, Prisma 7 (PostgreSQL, adaptateur `pg`).

## Prérequis

- Node.js 24 ou plus
- PostgreSQL 15 ou plus, ou Docker (un `docker-compose.yml` est fourni)

## Installation

```bash
npm ci                    # installe les dépendances et génère le client Prisma (postinstall)
cp .env.example .env      # puis renseigner DATABASE_URL
docker compose up -d      # facultatif : lance PostgreSQL sur le port 5434
npm run db:migrate        # applique les migrations (prisma migrate deploy)
npm run seed              # 10 ouvrages, 3 emprunts dont 1 rendu (relançable)
npm run dev               # lance l'API avec rechargement automatique
```

L'API répond sur `http://localhost:3000/sante`.

## Variables d'environnement

| Variable       | Description                         | Exemple                                                                 |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `PORT`         | Port HTTP de l'API (3000 par défaut) | `3000`                                                                  |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL      | `postgresql://UTILISATEUR:MOT_DE_PASSE@localhost:5434/mediatheque?schema=public` |

Le fichier `.env` n'est pas versionné. Avec le `docker-compose.yml` fourni, les identifiants sont ceux définis dans ce fichier (environnement local uniquement).

## Scripts

| Script                   | Rôle                                             |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Démarre l'API en mode watch                      |
| `npm start`              | Démarre l'API                                    |
| `npm run db:migrate`     | Applique les migrations existantes               |
| `npm run db:migrate:dev` | Crée une nouvelle migration après une modification du schéma |
| `npm run seed`           | Vide les tables puis réinsère les données de démonstration |

## Structure

```
prisma/
  schema.prisma          modèles Ouvrage et Emprunt (relation 1-n)
  migrations/            migration initiale
  seed.js                seeder rejouable
prisma.config.ts         configuration Prisma 7 (schéma, migrations, seed, URL)
src/
  index.js               démarrage du serveur HTTP
  app.js                 application Express (middlewares, routeurs)
  db.js                  client Prisma + adaptateur pg
  erreurs.js             classes d'erreurs HTTP
  routes/                un routeur par ressource
  repositories/          accès aux données (requêtes Prisma, transactions)
  schemas/               schémas de validation Zod
  middlewares/           journalisation, validation, 404 et gestionnaire d'erreurs
requetes.http            requêtes de test (extension REST Client)
```

## Routes

| Méthode | Chemin                        | Description                                              | Codes             |
| ------- | ----------------------------- | -------------------------------------------------------- | ----------------- |
| GET     | `/sante`                      | État de l'API                                            | 200               |
| GET     | `/api/ouvrages`               | Liste paginée (`?page=`, `?limite=` ≤ 50, `?disponible=`) | 200, 400          |
| GET     | `/api/ouvrages/:id`           | Détail avec les emprunts en cours                        | 200, 400, 404     |
| POST    | `/api/ouvrages`               | Crée un ouvrage                                          | 201, 400          |
| PATCH   | `/api/ouvrages/:id`           | Modifie titre, auteur, année                             | 200, 400, 404     |
| DELETE  | `/api/ouvrages/:id`           | Supprime (409 s'il est emprunté ou a un historique)      | 204, 400, 404, 409 |
| GET     | `/api/emprunts`               | Liste paginée (`?page=`, `?limite=` ≤ 50, `?rendu=`)      | 200, 400          |
| GET     | `/api/emprunts/:id`           | Détail                                                   | 200, 400, 404     |
| POST    | `/api/emprunts`               | Crée un emprunt (transaction, ouvrage rendu indisponible) | 201, 400, 404, 409 |
| PATCH   | `/api/emprunts/:id`           | Modifie emprunteur ou dates                              | 200, 400, 404     |
| DELETE  | `/api/emprunts/:id`           | Supprime (l'ouvrage redevient disponible si non rendu)   | 204, 400, 404     |
| POST    | `/api/emprunts/:id/retour`    | Marque rendu, ouvrage disponible                         | 200, 400, 404, 409 |

Les listes renvoient `{ donnees, page, limite, total, pages }`.

### Règles de validation

- `titre` : 1 à 150 caractères ; `auteur` : 1 à 100 caractères
- `annee` : entier entre 1450 et l'année courante
- `emprunteur` : 2 à 80 caractères
- `dateEmprunt` (facultative, maintenant par défaut) et `dateRetourPrevue` : dates ISO 8601, retour postérieur à l'emprunt
- Les champs inconnus sont ignorés. Une erreur renvoie `400` avec la liste des champs fautifs :

```json
{
  "erreur": "Paramètres invalides (body)",
  "champs": [{ "champ": "annee", "message": "L'année doit être supérieure ou égale à 1450" }]
}
```

### Gestion des erreurs

Un gestionnaire central répond toujours en JSON, sans pile d'exécution. Il traduit les erreurs Prisma `P2025` en 404, ainsi que `P2003` et `P2002` en 409. Chaque requête est journalisée sur une ligne : `date méthode chemin statut durée`.

## Exemples de requêtes

```bash
curl http://localhost:3000/api/ouvrages?disponible=true&limite=5

curl -X POST http://localhost:3000/api/ouvrages \
  -H "Content-Type: application/json" \
  -d '{"titre":"Notre-Dame de Paris","auteur":"Victor Hugo","annee":1831}'

curl -X POST http://localhost:3000/api/emprunts \
  -H "Content-Type: application/json" \
  -d '{"ouvrageId":4,"emprunteur":"Zoé","dateRetourPrevue":"2026-12-31"}'

curl -X POST http://localhost:3000/api/emprunts/1/retour
```

`requetes.http` contient toutes les routes, y compris les cas d'erreur.
