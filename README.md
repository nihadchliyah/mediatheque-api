# mediatheque-api

API REST de la médiathèque associative : gestion du catalogue (**ouvrages**), des **emprunts** et des **comptes** (membres et bibliothécaires).

Stack : Node 24, Express 5, Zod 4, Prisma 7 (PostgreSQL, adaptateur `pg`), jose (JWT), bcryptjs, helmet, cors, express-rate-limit.

## Prérequis

- Node.js 24 ou plus
- PostgreSQL 15 ou plus, ou Docker (un `docker-compose.yml` est fourni)

## Installation

```bash
npm ci                    # installe les dépendances et génère le client Prisma (postinstall)
cp .env.example .env      # puis renseigner DATABASE_URL et générer les secrets (voir plus bas)
docker compose up -d      # facultatif : lance PostgreSQL sur le port 5434
npm run db:migrate        # applique les migrations (prisma migrate deploy)
npm run seed              # 3 comptes, 10 ouvrages, 3 emprunts dont 1 rendu (relançable)
npm run dev               # lance l'API avec rechargement automatique
```

L'API répond sur `http://localhost:3000/sante`.

## Variables d'environnement

| Variable              | Description                                              | Exemple                                                                 |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `PORT`                | Port HTTP de l'API                                       | `3000`                                                                  |
| `DATABASE_URL`        | Chaîne de connexion PostgreSQL                           | `postgresql://UTILISATEUR:MOT_DE_PASSE@localhost:5434/mediatheque?schema=public` |
| `JWT_ACCESS_SECRET`   | Secret de signature des access tokens (32 caractères min.) | voir « Génération des secrets »                                       |
| `JWT_REFRESH_SECRET`  | Secret de signature des refresh tokens, différent du précédent | voir « Génération des secrets »                                  |
| `JWT_ACCESS_DUREE`    | Durée de vie de l'access token (15 min maximum)          | `15m`                                                                   |
| `REFRESH_DUREE_JOURS` | Durée de vie du refresh token en jours                   | `7`                                                                     |
| `CORS_ORIGINS`        | Origines autorisées, séparées par des virgules           | `http://localhost:5173,http://localhost:8081`                           |
| `BCRYPT_COUT`         | Coût bcrypt (12 minimum)                                 | `12`                                                                    |

La configuration est validée au démarrage : l'API refuse de démarrer si une variable manque ou si un secret est trop court.

Les fichiers `.env` et `.env.test` ne sont pas versionnés. Seuls `.env.example` et `.env.test.example` le sont, avec des valeurs factices.

### Génération des secrets

Chaque secret doit être une valeur aléatoire propre à chaque environnement :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Lancer la commande deux fois : une valeur pour `JWT_ACCESS_SECRET`, une autre pour `JWT_REFRESH_SECRET`. En intégration continue, les secrets sont générés à chaque exécution (`openssl rand -base64 48`).

## Comptes de démonstration (seeder)

Mots de passe **fictifs**, uniquement pour l'environnement local :

| E-mail                | Mot de passe        | Rôle           |
| --------------------- | ------------------- | -------------- |
| `biblio@example.net`  | `Biblio-Demo-2026`  | bibliothecaire |
| `camille@example.net` | `Camille-Demo-2026` | membre         |
| `leo@example.net`     | `Leo-Demo-2026`     | membre         |

## Authentification

```
Client                                   API
  | POST /api/auth/inscription {email, motDePasse}
  |--------------------------------------->|  201 { id, email, role: "membre" }
  | POST /api/auth/connexion {email, motDePasse}
  |--------------------------------------->|  200 { accessToken (15 min), refreshToken (7 j) }
  | GET /api/ouvrages
  | Authorization: Bearer <accessToken>
  |--------------------------------------->|  200
  |              ... access token expiré ...
  |--------------------------------------->|  401
  | POST /api/auth/rafraichir {refreshToken}
  |--------------------------------------->|  200 { nouvel accessToken, nouveau refreshToken }
  | POST /api/auth/deconnexion
  | Authorization: Bearer <accessToken>
  |--------------------------------------->|  204 (tous les refresh tokens révoqués)
```

- Les mots de passe sont hachés avec bcrypt (coût 12). Ils n'apparaissent jamais dans les réponses, les jetons ou les journaux.
- La connexion renvoie le même `401 Identifiants invalides` que le compte existe ou non. Le temps de réponse est équivalent, car un hachage factice est comparé quand le compte n'existe pas.
- L'inscription crée toujours un **membre**. Un champ `role` envoyé est ignoré.
- L'access token (HS256, signé avec jose) contient l'identifiant (`sub`) et le rôle, et expire après 15 minutes.
- Le refresh token est un JWT signé avec un secret distinct. Son identifiant (`jti`) est stocké en base dans `refresh_tokens`.
  - Chaque rafraîchissement révoque l'ancien jeton et en émet un nouveau (rotation).
  - Réutiliser un jeton déjà consommé révoque tous les jetons de l'utilisateur.
- La déconnexion révoque tous les refresh tokens de l'utilisateur.

## Rôles et droits par route

Toutes les routes `/api/ouvrages` et `/api/emprunts` exigent un en-tête `Authorization: Bearer <accessToken>`.

| Méthode | Chemin                     | Anonyme | Membre                                   | Bibliothécaire            |
| ------- | -------------------------- | ------- | ---------------------------------------- | ------------------------- |
| GET     | `/sante`                   | ✅      | ✅                                       | ✅                        |
| POST    | `/api/auth/inscription`    | ✅      | ✅                                       | ✅                        |
| POST    | `/api/auth/connexion`      | ✅      | ✅                                       | ✅                        |
| POST    | `/api/auth/rafraichir`     | ✅ (refresh token) | ✅                            | ✅                        |
| POST    | `/api/auth/deconnexion`    | 401     | ✅                                       | ✅                        |
| GET     | `/api/ouvrages`            | 401     | ✅                                       | ✅                        |
| GET     | `/api/ouvrages/:id`        | 401     | ✅ (seuls ses emprunts en cours sont inclus) | ✅ (tous les emprunts en cours) |
| POST    | `/api/ouvrages`            | 401     | 403                                      | ✅                        |
| PATCH   | `/api/ouvrages/:id`        | 401     | 403                                      | ✅                        |
| DELETE  | `/api/ouvrages/:id`        | 401     | 403                                      | ✅                        |
| GET     | `/api/emprunts`            | 401     | ✅ ses emprunts uniquement               | ✅ tous (`?utilisateurId=`) |
| GET     | `/api/emprunts/:id`        | 401     | ✅ si propriétaire, sinon 404            | ✅                        |
| POST    | `/api/emprunts`            | 401     | ✅ pour lui-même uniquement              | ✅ pour lui ou `utilisateurId` |
| POST    | `/api/emprunts/:id/retour` | 401     | ✅ si propriétaire, sinon 404            | ✅                        |
| PATCH   | `/api/emprunts/:id`        | 401     | 403                                      | ✅ (dates uniquement)     |
| DELETE  | `/api/emprunts/:id`        | 401     | 403                                      | ✅                        |

- Un membre qui accède à l'emprunt d'un autre reçoit `404` plutôt que `403`, pour ne pas révéler son existence.
- Le schéma de `PATCH /api/emprunts/:id` n'accepte que `dateEmprunt` et `dateRetourPrevue` : le propriétaire d'un emprunt ne peut pas être modifié.

## Durcissement

- **helmet** : en-têtes de sécurité (CSP, HSTS, `nosniff`…), sans `X-Powered-By`.
- **CORS** : seules les origines listées dans `CORS_ORIGINS` sont acceptées, les autres reçoivent `403`. Les clients sans en-tête `Origin` (application mobile, curl) ne sont pas concernés.
- **Limitation de débit** : 10 requêtes par 15 minutes et par IP sur `/api/auth/*`, puis `429`. Limite générale de 300 requêtes par minute.
- **Taille des corps** : JSON limité à 100 Ko, au-delà la réponse est `413`.
- **Erreurs** : un gestionnaire unique répond en JSON, sans pile d'exécution ni message interne. Un jeton invalide ou expiré donne `401`, jamais `500`. Les erreurs Prisma `P2025` donnent 404, `P2003` et `P2002` donnent 409.
- **Journal** : une ligne par requête (`date méthode chemin statut durée`), sans corps de requête.

## Tests

Les tests utilisent `node:test` et `fetch` contre l'application démarrée sur un port éphémère. Ils tournent sur une **base distincte** (`mediatheque_test`) : les tests refusent de s'exécuter si le nom de la base ne contient pas `test`.

```bash
cp .env.test.example .env.test   # adapter DATABASE_URL et générer deux secrets
npm test                         # applique les migrations sur la base de test puis lance les tests
```

Couverture : inscription (201, 409, 400), connexion réussie et échouée, rafraîchissement et rotation, déconnexion, 401 sans jeton ou avec un jeton falsifié, 403 pour un rôle insuffisant, propriété des emprunts, en-têtes helmet, CORS, 413 et 429.

L'intégration continue (`.github/workflows/ci.yml`) exécute `npm ci`, `npm audit --audit-level=high` et `npm test` avec un service PostgreSQL, à chaque pull request.

## Scripts

| Script                   | Rôle                                                       |
| ------------------------ | ---------------------------------------------------------- |
| `npm run dev`            | Démarre l'API en mode watch                                |
| `npm start`              | Démarre l'API                                              |
| `npm test`               | Lance les tests sur la base de test                        |
| `npm run db:migrate`     | Applique les migrations existantes                         |
| `npm run db:migrate:dev` | Crée une nouvelle migration après une modification du schéma |
| `npm run seed`           | Vide les tables puis réinsère les données de démonstration |

## Structure

```
.github/workflows/ci.yml intégration continue
prisma/
  schema.prisma          modèles Utilisateur, RefreshToken, Ouvrage, Emprunt
  migrations/            migrations initiale et auth
  seed.js                seeder rejouable
prisma.config.ts         configuration Prisma 7 (schéma, migrations, seed, URL)
src/
  index.js               démarrage du serveur HTTP
  app.js                 application Express (sécurité, middlewares, routeurs)
  config.js              lecture et validation des variables d'environnement
  db.js                  client Prisma + adaptateur pg
  erreurs.js             classes d'erreurs HTTP
  services/auth.js       hachage des mots de passe, signature et vérification des JWT
  routes/                un routeur par ressource (auth, ouvrages, emprunts)
  repositories/          accès aux données (requêtes Prisma, transactions)
  schemas/               schémas de validation Zod
  middlewares/           journal, validation, authentification, rôles, erreurs
tests/                   tests node:test
requetes.http            requêtes de test (extension REST Client)
```

## Routes

| Méthode | Chemin                     | Description                                              | Codes                   |
| ------- | -------------------------- | -------------------------------------------------------- | ----------------------- |
| POST    | `/api/auth/inscription`    | Crée un compte membre                                    | 201, 400, 409, 429      |
| POST    | `/api/auth/connexion`      | Renvoie access et refresh tokens                         | 200, 400, 401, 429      |
| POST    | `/api/auth/rafraichir`     | Échange un refresh token contre une nouvelle paire       | 200, 400, 401, 429      |
| POST    | `/api/auth/deconnexion`    | Révoque les refresh tokens de l'utilisateur              | 204, 401, 429           |
| GET     | `/api/ouvrages`            | Liste paginée (`?page=`, `?limite=` ≤ 50, `?disponible=`) | 200, 400, 401          |
| GET     | `/api/ouvrages/:id`        | Détail avec les emprunts en cours                        | 200, 400, 401, 404      |
| POST    | `/api/ouvrages`            | Crée un ouvrage                                          | 201, 400, 401, 403      |
| PATCH   | `/api/ouvrages/:id`        | Modifie titre, auteur, année                             | 200, 400, 401, 403, 404 |
| DELETE  | `/api/ouvrages/:id`        | Supprime (409 s'il est emprunté ou a un historique)      | 204, 401, 403, 404, 409 |
| GET     | `/api/emprunts`            | Liste paginée (`?page=`, `?limite=`, `?rendu=`, `?utilisateurId=`) | 200, 400, 401 |
| GET     | `/api/emprunts/:id`        | Détail                                                   | 200, 400, 401, 404      |
| POST    | `/api/emprunts`            | Crée un emprunt (transaction, ouvrage rendu indisponible) | 201, 400, 401, 404, 409 |
| PATCH   | `/api/emprunts/:id`        | Modifie les dates                                        | 200, 400, 401, 403, 404 |
| DELETE  | `/api/emprunts/:id`        | Supprime (l'ouvrage redevient disponible si non rendu)   | 204, 401, 403, 404      |
| POST    | `/api/emprunts/:id/retour` | Marque rendu, ouvrage disponible                         | 200, 400, 401, 404, 409 |

Les listes renvoient `{ donnees, page, limite, total, pages }`. Les règles de validation sont les mêmes qu'au TP 1 :

- `titre` de 1 à 150 caractères ;
- `annee` entre 1450 et l'année courante ;
- dates au format ISO 8601.

L'e-mail doit être valide. Le mot de passe compte de 12 à 72 caractères, avec au moins une minuscule, une majuscule et un chiffre.

## Exemples de requêtes

```bash
curl -X POST http://localhost:3000/api/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"email":"camille@example.net","motDePasse":"Camille-Demo-2026"}'

curl http://localhost:3000/api/ouvrages?disponible=true \
  -H "Authorization: Bearer <accessToken>"

curl -X POST http://localhost:3000/api/emprunts \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"ouvrageId":4,"dateRetourPrevue":"2026-12-31"}'
```

`requetes.http` contient toutes les routes, y compris les cas d'erreur.

## Évolution du projet

| Étape | Branche / PR     | Contenu                                                                 |
| ----- | ---------------- | ----------------------------------------------------------------------- |
| TP 1  | `main`           | API CRUD ouvrages et emprunts, validation Zod, Prisma, seeder, pagination |
| TP 2  | `feature/auth`   | Comptes, JWT access/refresh, rôles et propriété, durcissement, tests, CI |
