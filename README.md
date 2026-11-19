# mediatheque-api

API REST de la médiathèque associative, écrite en TypeScript :
- catalogue (**ouvrages**), **emprunts** et **réservations** ;
- comptes **membre** et **bibliothécaire** authentifiés par JWT ;
- documentation **OpenAPI 3.1** sur `/api/docs` ;
- **assistant conversationnel** diffusé en Server-Sent Events.

Stack : Node 24, TypeScript 7 (strict, syntaxe effaçable), Express 5, Zod 4, Prisma 7 (PostgreSQL 17), jose, bcryptjs, helmet, cors, express-rate-limit, zod-openapi, swagger-ui-express, SDK OpenAI.

## Prérequis

- Node.js 24 ou plus (exécute directement les fichiers `.ts`)
- Docker, pour PostgreSQL et pour l'image de l'API
- Une clé OpenAI, seulement si l'on veut l'assistant en mode réel. Le mode **bouchon** fonctionne sans clé.

## Démarrage en local (10 minutes)

```bash
npm ci                    # dépendances + génération du client Prisma (postinstall)
cp .env.example .env      # choisir les identifiants PostgreSQL et générer les deux secrets JWT (voir plus bas)
docker compose up -d db   # PostgreSQL 17 sur le port 5434
npm run db:migrate        # applique les migrations
npm run seed              # 3 comptes, 10 ouvrages, 3 emprunts, 2 réservations (relançable)
npm run dev               # node --watch src/index.ts
```

Ensuite :
1. Ouvrir `http://localhost:3000/api/docs`.
2. Appeler `POST /api/auth/connexion` avec un compte de démonstration.
3. Cliquer sur **Authorize** et coller l'`accessToken`.

Le fichier `requetes.http` (extension VS Code REST Client) rejoue toutes les routes de haut en bas, cas d'erreur compris. Il faut lancer `npm run seed` juste avant.

## Lancement avec Docker

Le `Dockerfile` est multi-étapes :
1. L'étape `construction` exécute `npm ci`, `prisma generate` et `tsc` vers `dist/`.
2. L'image finale ne contient que les dépendances de production et `dist/`. Elle tourne avec l'utilisateur `node` et lance `node dist/index.js`.

```bash
docker build -t mediatheque-api .
docker run --rm -p 3000:3000 --env-file .env \
  -e DATABASE_URL="postgresql://UTILISATEUR:MOT_DE_PASSE@host.docker.internal:5434/mediatheque?schema=public" \
  mediatheque-api
curl http://localhost:3000/sante          # {"statut":"ok"}
```

Dans un conteneur, `localhost` désigne le conteneur lui-même : `DATABASE_URL` pointe donc vers `host.docker.internal`.

Pour tout lancer en une commande (base, migrations, API) :

```bash
docker compose --profile api up --build
```

Le service `migration` applique les migrations avant de démarrer l'API. Il utilise l'étape `construction` de l'image.

## Variables d'environnement

| Variable              | Description                                                     | Exemple (`.env.example`)                                   |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| `POSTGRES_USER`       | Utilisateur créé par le conteneur PostgreSQL                    | `UTILISATEUR`                                              |
| `POSTGRES_PASSWORD`   | Son mot de passe, choisi localement                             | `MOT_DE_PASSE`                                             |
| `POSTGRES_DB`         | Base créée par le conteneur                                     | `mediatheque`                                              |
| `PORT`                | Port HTTP de l'API                                              | `3000`                                                     |
| `DATABASE_URL`        | Chaîne de connexion PostgreSQL (mêmes identifiants)             | `postgresql://UTILISATEUR:MOT_DE_PASSE@localhost:5434/...` |
| `JWT_ACCESS_SECRET`   | Secret des access tokens (32 caractères minimum)                | voir « Génération des secrets »                            |
| `JWT_REFRESH_SECRET`  | Secret des refresh tokens, différent du précédent               | voir « Génération des secrets »                            |
| `JWT_ACCESS_DUREE`    | Durée de vie de l'access token                                  | `15m`                                                      |
| `REFRESH_DUREE_JOURS` | Durée de vie du refresh token, en jours                         | `7`                                                        |
| `CORS_ORIGINS`        | Origines autorisées, séparées par des virgules                  | `http://localhost:5173,http://localhost:8081`              |
| `BCRYPT_COUT`         | Coût bcrypt (12 minimum)                                        | `12`                                                       |
| `IA_FOURNISSEUR`      | `bouchon` (par défaut) ou `openai`                              | `bouchon`                                                  |
| `OPENAI_API_KEY`      | Clé OpenAI, obligatoire si `IA_FOURNISSEUR=openai`              | *(vide)*                                                   |
| `OPENAI_MODELE`       | Modèle utilisé en mode `openai`                                 | `gpt-4.1-mini`                                             |

- La configuration est validée par Zod au démarrage. L'API refuse de démarrer si une variable manque, si un secret est trop court ou si la clé OpenAI manque en mode `openai`.
- `.env` et `.env.test` ne sont pas versionnés. Seuls les fichiers `.example`, aux valeurs factices, le sont.
- Les valeurs sont écrites sans guillemets, pour rester compatibles avec `docker run --env-file`.
- **Aucune clé d'API n'a été commitée.**

### Génération des secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Lancer la commande deux fois : une valeur pour `JWT_ACCESS_SECRET`, une autre pour `JWT_REFRESH_SECRET`. En CI, les secrets sont générés à chaque exécution.

## Comptes de démonstration (seeder)

Ces mots de passe sont fictifs et servent uniquement à l'environnement local.

| E-mail                | Mot de passe        | Rôle           | Données du seed                                   |
| --------------------- | ------------------- | -------------- | ------------------------------------------------- |
| `biblio@example.net`  | `Biblio-Demo-2026`  | bibliothecaire |                                                   |
| `camille@example.net` | `Camille-Demo-2026` | membre         | emprunte l'ouvrage 1, réserve l'ouvrage 2          |
| `leo@example.net`     | `Leo-Demo-2026`     | membre         | emprunte l'ouvrage 2, réserve l'ouvrage 1          |

## Rôles et droits par route

« Authentifié » désigne tout utilisateur connecté, membre ou bibliothécaire. Sans jeton valide, toute route protégée renvoie `401`.

| Méthode et route                              | Rôle requis                                     | Succès | Erreurs principales      |
| --------------------------------------------- | ----------------------------------------------- | ------ | ------------------------ |
| `GET /sante`                                  | aucun                                           | 200    |                          |
| `GET /api/docs`, `GET /api/docs.json`         | aucun                                           | 200    |                          |
| `POST /api/auth/inscription`                  | aucun (crée toujours un membre)                 | 201    | 400, 409, 429            |
| `POST /api/auth/connexion`                    | aucun                                           | 200    | 400, 401, 429            |
| `POST /api/auth/rafraichir`                   | aucun (refresh token valide)                    | 200    | 400, 401, 429            |
| `POST /api/auth/deconnexion`                  | authentifié                                     | 204    | 401, 429                 |
| `GET /api/ouvrages`, `GET /api/ouvrages/:id`  | authentifié                                     | 200    | 400, 404                 |
| `POST /api/ouvrages`                          | bibliothécaire                                  | 201    | 400, 403, 409            |
| `PATCH /api/ouvrages/:id`                     | bibliothécaire                                  | 200    | 400, 403, 404, 409       |
| `DELETE /api/ouvrages/:id`                    | bibliothécaire                                  | 204    | 403, 404, 409 si emprunté |
| `GET /api/emprunts`, `GET /api/emprunts/:id`  | membre (les siens), bibliothécaire (tous)       | 200    | 400, 404                 |
| `POST /api/emprunts`                          | membre (pour lui-même), bibliothécaire (pour un membre) | 201 | 400, 404, 409 si indisponible |
| `POST /api/emprunts/:id/retour`               | membre (les siens), bibliothécaire (tous)       | 200    | 404, 409 si déjà rendu   |
| `PATCH /api/emprunts/:id`                     | bibliothécaire (dates uniquement)               | 200    | 400, 403, 404            |
| `DELETE /api/emprunts/:id`                    | bibliothécaire                                  | 204    | 403, 404                 |
| `GET /api/reservations`, `GET /api/reservations/:id` | membre (les siennes), bibliothécaire (toutes) | 200 | 400, 404             |
| `POST /api/reservations`                      | membre                                          | 201    | 400, 403, 404, 409       |
| `DELETE /api/reservations/:id`                | membre (les siennes), bibliothécaire            | 204    | 404                      |
| `POST /api/assistant/flux`                    | authentifié, 10 par minute                      | 200 (SSE) | 400, 429              |
| `DELETE /api/assistant/memoire`               | authentifié                                     | 204    |                          |

Deux choix laissés ouverts par l'énoncé :
- **404 plutôt que 403** pour la ressource d'un autre membre (emprunt, réservation). Un 403 confirmerait que l'identifiant existe, alors qu'un 404 ne révèle rien. Le 403 est réservé au cas où le **rôle** est insuffisant, ce que le client connaît déjà.
- **Le bibliothécaire emprunte** pour lui-même ou pour un membre (`utilisateurId`), car il enregistre les prêts au comptoir. En revanche, il ne **réserve** pas (403) : la réservation est la démarche d'un membre qui attend un ouvrage. Un bibliothécaire qui veut réserver utilise un compte membre.

### Règles des réservations

- Un membre réserve un ouvrage **indisponible**. Il reçoit `409` si l'ouvrage est disponible (il peut l'emprunter directement) ou s'il l'emprunte déjà lui-même.
- Un membre n'a qu'**une réservation active par ouvrage**. Une contrainte d'unicité `(ouvrageId, utilisateurId)` le garantit en base : une deuxième demande reçoit `409`. La réponse indique le **rang** dans la file.
- Au **retour** d'un emprunt, dans la même transaction et sous verrou de la ligne de l'ouvrage, la réservation la plus ancienne est supprimée et devient un emprunt de 21 jours. Cet emprunt est renvoyé dans `empruntSuivant`. Sans réservation, l'ouvrage redevient disponible. La suppression d'un emprunt en cours suit la même règle.
- Annuler une réservation la supprime (`204`) : la file avance d'elle-même.

## Authentification

```
POST /api/auth/connexion {email, motDePasse}   -> 200 { accessToken (15 min), refreshToken (7 j) }
GET  /api/...  Authorization: Bearer <access>  -> 200, ou 401 une fois expiré
POST /api/auth/rafraichir {refreshToken}        -> 200 nouvelle paire (l'ancien refresh est consommé)
POST /api/auth/deconnexion                      -> 204 (tous les refresh tokens révoqués)
```

- **Mots de passe :** hachés par bcrypt avec un coût de 12. Ils n'apparaissent jamais dans une réponse, un jeton ou un journal. La connexion répond le même `401` en un temps équivalent, que le compte existe ou non.
- **Access token :** JWT HS256 de 15 minutes, qui porte `sub` et `role`. L'émetteur, l'audience et l'algorithme sont vérifiés.
- **Refresh token :** JWT signé par un secret distinct. Son `jti` est stocké en base, ce qui le rend révocable. Chaque rafraîchissement le fait tourner, et sa réutilisation révoque tous les jetons de l'utilisateur.

## Assistant conversationnel

`POST /api/assistant/flux` reçoit `{ "question": "..." }` (500 caractères au plus) et répond en `text/event-stream` :

```
event: outil
data: {"nom":"mes_emprunts"}

data: {"texte":"Vous avez "}

data: {"texte":"1 emprunt(s) en cours…"}

event: fin
data: {}
```

En cas d'échec du fournisseur après l'envoi des en-têtes, le flux se termine par `event: erreur` / `data: {"erreur":"..."}`. Aucun détail interne n'est transmis.

Exemple avec `curl -N`, qui affiche les fragments au fil de l'eau :

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"email":"camille@example.net","motDePasse":"Camille-Demo-2026"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl -N -X POST http://localhost:3000/api/assistant/flux \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"question":"Quels livres de Camus sont disponibles ?"}'
```

- **Outils :** trois outils, construits pour chaque requête avec l'identité du jeton :
  - `rechercher_ouvrages` (recherche, disponible) ;
  - `mes_emprunts` ;
  - `mes_reservations`.

  Aucun outil n'accepte d'identifiant d'utilisateur. Même si un message pousse le modèle à « regarder les emprunts de Léo », il n'a aucun moyen d'y accéder.
- **Mémoire :** la conversation est mémorisée par utilisateur authentifié et tronquée aux **dix derniers échanges**. Elle est effacée par `DELETE /api/assistant/memoire`. Une réponse interrompue n'est pas mémorisée.
- **Interruption :** quand le client ferme la connexion, un `AbortController` arrête la génération. Le bouchon cesse d'émettre et l'appel OpenAI en cours est annulé.
- **Coût :**
  - chaque appel au fournisseur est journalisé, sous la forme `assistant fournisseur=openai utilisateur=2 jetons entree=120 sortie=8 total=128` ;
  - la boucle d'appels d'outils est bornée à 4 tours ;
  - l'historique est tronqué ;
  - chaque outil renvoie 10 éléments au plus.
- **Fournisseurs :** `IA_FOURNISSEUR` choisit entre deux implémentations :
  - `openai` utilise le SDK officiel (Chat Completions en streaming, appels d'outils) ;
  - `bouchon` est déterministe : il choisit l'outil selon la question, l'exécute réellement avec les droits de l'utilisateur et diffuse une réponse mot par mot. Les tests utilisent toujours le bouchon.

> **Modes testés :** le mode bouchon est testé (tests automatisés, `curl -N`, `requetes.http`). Le mode OpenAI a été vérifié contre un serveur local qui simule l'API OpenAI : streaming, appel d'outil puis second tour, usage journalisé. Il n'a **pas encore été testé avec une clé réelle**.

## Relecture OWASP API Security Top 10 (2023)

| Risque | Parade | Où |
| ------ | ------ | -- |
| API1 Contrôle d'accès au niveau objet (BOLA) | Pour un membre, emprunts et réservations sont filtrés par `utilisateurId` dans la requête SQL elle-même. Une ressource d'un autre membre renvoie 404. Les outils de l'assistant prennent l'identité du jeton et aucun identifiant. | `middlewares/auth.ts` (`proprietaire`), `repositories/*.ts`, `services/assistant/outils.ts` ; tests `acces`, `reservations`, `assistant` |
| API2 Authentification défaillante | bcrypt coût 12 et hachage factice contre l'énumération ; JWT HS256 avec algorithme, émetteur et audience imposés ; access token de 15 min ; refresh token à usage unique, révocable, avec révocation totale en cas de rejeu ; 10 tentatives par 15 min | `services/auth.ts`, `routes/auth.ts`, `repositories/refreshTokens.ts`, `app.ts` |
| API3 Contrôle d'accès au niveau propriété | Zod retire les champs inconnus (`role` à l'inscription, `utilisateurId` au PATCH d'un emprunt, `disponible` sur un ouvrage). Les `select` Prisma n'exposent ni le hachage ni les autres données personnelles (relations limitées à `id` et `email`). | `schemas/*.ts`, `repositories/utilisateurs.ts` (`champsPublics`), relations des dépôts |
| API4 Consommation de ressources non restreinte | 300 requêtes par minute en tout ; 10 par 15 min sur l'authentification ; 10 questions par minute et par utilisateur à l'assistant ; corps JSON ≤ 100 Ko (413) ; pagination plafonnée à 50 ; question ≤ 500 caractères ; mémoire limitée à 10 échanges ; 4 tours d'outils au plus ; délai OpenAI de 30 s | `app.ts`, `routes/assistant.ts`, `schemas/communs.ts`, `services/assistant/*` |
| API5 Contrôle d'accès au niveau fonction | `autoriser('bibliothecaire')` protège les écritures sur le catalogue, le PATCH et le DELETE d'emprunt ; `autoriser('membre')` protège la réservation. Les rôles sont vérifiés côté serveur à partir du jeton. | `middlewares/auth.ts`, `routes/*.ts` ; test `acces` (403) |
| API6 Accès non restreint aux flux métier sensibles | Emprunt atomique (`updateMany` conditionnel) ; une seule réservation par membre et par ouvrage, garantie par une contrainte d'unicité ; conversion réservation → emprunt dans une transaction avec `SELECT … FOR UPDATE` ; débit de l'assistant limité | `repositories/emprunts.ts`, `repositories/reservations.ts`, `prisma/schema.prisma` |
| API7 Server-Side Request Forgery | L'API n'appelle aucune URL fournie par un client. Le seul appel sortant vise l'API OpenAI, fixée par la configuration. | `services/assistant/openai.ts` |
| API8 Mauvaise configuration de sécurité | helmet (CSP, HSTS, nosniff) ; `X-Powered-By` désactivé ; CORS limité à une liste d'origines ; gestionnaire d'erreurs JSON sans pile d'exécution ni message interne ; jeton invalide → 401, jamais 500 ; configuration validée au démarrage ; image Docker non root | `app.ts`, `middlewares/erreurs.ts`, `config.ts`, `Dockerfile` |
| API9 Gestion d'inventaire incorrecte | Spécification OpenAPI générée depuis les schémas de validation : elle ne peut pas diverger du code. Un test vérifie que chaque route protégée déclare `bearerAuth` et 401. `requetes.http` couvre toutes les routes. | `docs/openapi.ts`, `tests/docs.test.ts` |
| API10 Consommation non sûre d'API tierces | Les arguments renvoyés par le modèle sont revalidés par Zod avant exécution ; un outil inconnu est refusé ; le prompt système traite les résultats d'outils comme des données (injection de prompt) ; une erreur du fournisseur devient `event: erreur` sans détail ; la clé reste dans `.env` | `services/assistant/outils.ts`, `openai.ts`, `index.ts`, `routes/assistant.ts` |

## Tests et intégration continue

```bash
cp .env.test.example .env.test   # adapter DATABASE_URL (base dont le nom contient « test ») et les secrets
npm run check                    # tsc --noEmit, mode strict
npm test                         # applique les migrations sur la base de test, puis lance node:test
```

- **Exécution :** 43 tests `node:test` en TypeScript. Ils appellent l'API avec `fetch` sur un port éphémère, contre une base distincte, et refusent de tourner sur une base dont le nom ne contient pas « test ». L'assistant y tourne toujours en mode bouchon.
- **Couverture :**
  - authentification et rotation des jetons ;
  - 401, 403 et 429 ;
  - propriété des emprunts ;
  - durcissement (helmet, CORS, 413) ;
  - validation ;
  - réservations : règles 409 et 404, unicité, droits, conversion au retour, annulation ;
  - documentation : HTML servi, JSON OpenAPI 3.1 valide, sécurité de chaque route ;
  - assistant SSE : `data:` puis `event: fin`, droits des outils, mémoire isolée et tronquée, arrêt à la coupure du client, 429.

Le workflow `.github/workflows/ci.yml` tourne à chaque pull request et à chaque push sur `main`. Il enchaîne `npm ci`, `npm audit --audit-level=high`, `npm run check` et `npm test`, avec un service PostgreSQL 17.

## Scripts

| Script                   | Rôle                                                       |
| ------------------------ | ---------------------------------------------------------- |
| `npm run dev`            | `node --watch src/index.ts`                                |
| `npm run check`          | Vérification des types (`tsc --noEmit`)                    |
| `npm run build`          | Compilation vers `dist/`                                   |
| `npm start`              | `node dist/index.js`                                       |
| `npm test`               | Tests sur la base de test                                  |
| `npm run db:migrate`     | Applique les migrations                                    |
| `npm run db:migrate:dev` | Crée une migration après une modification du schéma        |
| `npm run seed`           | Vide les tables et réinsère les données de démonstration   |

## Structure

```
prisma/                  schéma, migrations (init, auth, reservations), seeder
src/
  index.ts               démarrage du serveur HTTP et arrêt propre
  app.ts                 application Express : sécurité, limites, routeurs
  config.ts              variables d'environnement validées par Zod
  db.ts                  client Prisma et adaptateur pg
  erreurs.ts             classes d'erreurs HTTP
  types/express.d.ts     typage global de req.utilisateur
  middlewares/           journal, validation typée, authentification et rôles, erreurs
  schemas/               schémas Zod des entrées (types dérivés) et des réponses
  repositories/          accès aux données, transactions
  routes/                un routeur par ressource, plus docs et assistant
  services/auth.ts       hachage, signature et vérification des JWT
  services/assistant/    fournisseurs OpenAI et bouchon, outils, mémoire
  docs/openapi.ts        spécification OpenAPI générée depuis les schémas
tests/                   tests node:test
requetes.http            toutes les requêtes, cas d'erreur compris
Dockerfile               image multi-étapes
docker-compose.yml       PostgreSQL ; profil « api » : migrations et API
```

## Choix techniques

- **TypeScript sans étape de build en développement :** Node 24 retire les types à l'exécution (`erasableSyntaxOnly`, imports en `.ts`), et `tsc` réécrit les extensions pour produire `dist/`. Le middleware `valider` transmet au gestionnaire des entrées typées par `z.output` des schémas : aucun transtypage dans les routes.
- **PostgreSQL et Prisma :** ce couple fournit les relations, les transactions interactives, les verrous de ligne (`FOR UPDATE`) et la contrainte d'unicité dont les emprunts et les réservations ont besoin. Les migrations sont versionnées.
- **zod-openapi :** la bibliothèque s'appuie sur les métadonnées natives de Zod 4 (`.meta()`). Les schémas de validation sont donc aussi ceux de la documentation.
- **SDK OpenAI plutôt que LangChain.js :** une seule dépendance, et un contrôle direct sur la boucle d'outils, le streaming, l'annulation et l'usage. L'interface `FournisseurIA` isole le fournisseur, ce qui permet d'en ajouter un autre sans toucher aux routes.
- **Mémoire de l'assistant en RAM :** c'est simple et suffisant pour une instance. Elle est perdue au redémarrage et n'est pas partagée entre plusieurs instances : il faudrait passer à Redis ou à une table pour monter en charge.

## Évolution du projet

| Étape         | Branche / PR             | Contenu                                                                 |
| ------------- | ------------------------ | ----------------------------------------------------------------------- |
| TP 1          | `main`                   | CRUD ouvrages et emprunts, validation Zod, Prisma, seeder, pagination   |
| TP 2          | `feature/auth` (PR #1)   | Comptes, JWT access et refresh, rôles et propriété, durcissement, tests, CI |
| Projet final  | `feature/projet-final`   | TypeScript strict, réservations, OpenAPI, assistant SSE, Docker, OWASP  |
