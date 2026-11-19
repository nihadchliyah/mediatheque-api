import { createDocument, type ZodOpenApiOperationObject, type ZodOpenApiResponseObject } from 'zod-openapi';
import type { z } from 'zod';
import { idParams } from '../schemas/communs.ts';
import { connexion, inscription, rafraichir } from '../schemas/auth.ts';
import { creerOuvrage, listerOuvrages, modifierOuvrage } from '../schemas/ouvrages.ts';
import { creerEmprunt, listerEmprunts, modifierEmprunt } from '../schemas/emprunts.ts';
import { creerReservation, listerReservations } from '../schemas/reservations.ts';
import { questionAssistant } from '../schemas/assistant.ts';
import * as R from '../schemas/reponses.ts';

const json = (description: string, schema: z.ZodType): ZodOpenApiResponseObject => ({
  description,
  content: { 'application/json': { schema } },
});

const corps = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

const erreurs = {
  400: json('Paramètres invalides : le détail par champ est dans `champs`', R.erreur),
  401: json('Jeton absent, invalide ou expiré', R.erreur),
  403: json('Rôle insuffisant', R.erreur),
  404: json('Ressource introuvable, ou appartenant à un autre membre', R.erreur),
  409: json("Conflit avec l'état de la ressource", R.erreur),
  413: json('Corps de requête supérieur à 100 Ko', R.erreur),
  429: json('Trop de requêtes', R.erreur),
} as const;

type CodeErreur = keyof typeof erreurs;
const avec = (...codes: CodeErreur[]) => Object.fromEntries(codes.map((c) => [c, erreurs[c]]));

const sansCorps = (description: string): ZodOpenApiResponseObject => ({ description });

function protegee(operation: ZodOpenApiOperationObject): ZodOpenApiOperationObject {
  return {
    ...operation,
    security: [{ bearerAuth: [] }],
    responses: { ...operation.responses, ...avec(401, 429) },
  };
}

const parId = { path: idParams };

export const documentOpenApi = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'API Médiathèque',
    version: '1.0.0',
    description: [
      "API REST de la médiathèque associative : catalogue, emprunts, réservations et assistant conversationnel.",
      '',
      '1. `POST /api/auth/connexion` renvoie un `accessToken` (15 min) et un `refreshToken` (7 jours, usage unique).',
      '2. Cliquez sur **Authorize** et collez l\'`accessToken`.',
      '3. Un membre ne voit que ses emprunts et ses réservations : une ressource d\'un autre membre renvoie 404.',
    ].join('\n'),
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Santé' },
    { name: 'Authentification', description: '10 requêtes par 15 minutes et par adresse IP' },
    { name: 'Ouvrages', description: 'Lecture pour tout utilisateur connecté, écriture réservée au bibliothécaire' },
    { name: 'Emprunts' },
    { name: 'Réservations' },
    { name: 'Assistant', description: 'Assistant conversationnel, 10 questions par minute et par utilisateur' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/sante': {
      get: {
        tags: ['Santé'],
        summary: "État de l'API",
        responses: { 200: json('API disponible', R.sante) },
      },
    },

    '/api/auth/inscription': {
      post: {
        tags: ['Authentification'],
        summary: 'Créer un compte membre',
        description: 'Le rôle est toujours `membre` ; un éventuel champ `role` est ignoré.',
        requestBody: corps(inscription),
        responses: { 201: json('Compte créé', R.utilisateurPublic), ...avec(400, 409, 429) },
      },
    },
    '/api/auth/connexion': {
      post: {
        tags: ['Authentification'],
        summary: 'Se connecter',
        description: 'Même réponse 401 que le compte existe ou non.',
        requestBody: corps(connexion),
        responses: { 200: json('Jetons émis', R.jetons), ...avec(400, 401, 429) },
      },
    },
    '/api/auth/rafraichir': {
      post: {
        tags: ['Authentification'],
        summary: 'Échanger un refresh token contre une nouvelle paire de jetons',
        description: "Le refresh token est consommé. Le rejouer révoque tous les refresh tokens de l'utilisateur.",
        requestBody: corps(rafraichir),
        responses: { 200: json('Nouvelle paire de jetons', R.jetons), ...avec(400, 401, 429) },
      },
    },
    '/api/auth/deconnexion': {
      post: protegee({
        tags: ['Authentification'],
        summary: 'Se déconnecter',
        description: "Révoque tous les refresh tokens de l'utilisateur.",
        responses: { 204: sansCorps('Déconnecté') },
      }),
    },

    '/api/ouvrages': {
      get: protegee({
        tags: ['Ouvrages'],
        summary: 'Lister le catalogue',
        requestParams: { query: listerOuvrages },
        responses: { 200: json('Page d\'ouvrages', R.page(R.ouvrage, 'PageOuvrages')), ...avec(400) },
      }),
      post: protegee({
        tags: ['Ouvrages'],
        summary: 'Ajouter un ouvrage (bibliothécaire)',
        requestBody: corps(creerOuvrage),
        responses: { 201: json('Ouvrage créé', R.ouvrage), ...avec(400, 403, 409, 413) },
      }),
    },
    '/api/ouvrages/{id}': {
      get: protegee({
        tags: ['Ouvrages'],
        summary: "Détail d'un ouvrage et de ses emprunts en cours",
        requestParams: parId,
        responses: { 200: json('Ouvrage', R.ouvrageDetail), ...avec(400, 404) },
      }),
      patch: protegee({
        tags: ['Ouvrages'],
        summary: 'Modifier un ouvrage (bibliothécaire)',
        requestParams: parId,
        requestBody: corps(modifierOuvrage),
        responses: { 200: json('Ouvrage modifié', R.ouvrage), ...avec(400, 403, 404, 409) },
      }),
      delete: protegee({
        tags: ['Ouvrages'],
        summary: 'Supprimer un ouvrage (bibliothécaire)',
        description: 'Refusé avec 409 si un emprunt est en cours.',
        requestParams: parId,
        responses: { 204: sansCorps('Ouvrage supprimé'), ...avec(400, 403, 404, 409) },
      }),
    },

    '/api/emprunts': {
      get: protegee({
        tags: ['Emprunts'],
        summary: 'Lister les emprunts',
        description: 'Un membre ne reçoit que les siens (`utilisateurId` est ignoré) ; un bibliothécaire reçoit tous les emprunts.',
        requestParams: { query: listerEmprunts },
        responses: { 200: json("Page d'emprunts", R.page(R.emprunt, 'PageEmprunts')), ...avec(400) },
      }),
      post: protegee({
        tags: ['Emprunts'],
        summary: 'Emprunter un ouvrage',
        description: 'Un membre emprunte pour lui-même ; seul un bibliothécaire peut indiquer `utilisateurId`.',
        requestBody: corps(creerEmprunt),
        responses: { 201: json('Emprunt créé', R.emprunt), ...avec(400, 404, 409) },
      }),
    },
    '/api/emprunts/{id}': {
      get: protegee({
        tags: ['Emprunts'],
        summary: "Détail d'un emprunt",
        requestParams: parId,
        responses: { 200: json('Emprunt', R.emprunt), ...avec(400, 404) },
      }),
      patch: protegee({
        tags: ['Emprunts'],
        summary: "Modifier les dates d'un emprunt (bibliothécaire)",
        requestParams: parId,
        requestBody: corps(modifierEmprunt),
        responses: { 200: json('Emprunt modifié', R.emprunt), ...avec(400, 403, 404) },
      }),
      delete: protegee({
        tags: ['Emprunts'],
        summary: 'Supprimer un emprunt (bibliothécaire)',
        description: "Si l'emprunt était en cours, l'ouvrage passe à la plus ancienne réservation ou redevient disponible.",
        requestParams: parId,
        responses: { 204: sansCorps('Emprunt supprimé'), ...avec(400, 403, 404) },
      }),
    },
    '/api/emprunts/{id}/retour': {
      post: protegee({
        tags: ['Emprunts'],
        summary: 'Enregistrer le retour',
        description: "Dans la même transaction, la plus ancienne réservation de l'ouvrage devient un emprunt (`empruntSuivant`).",
        requestParams: parId,
        responses: { 200: json('Emprunt rendu', R.retour), ...avec(400, 404, 409) },
      }),
    },

    '/api/reservations': {
      get: protegee({
        tags: ['Réservations'],
        summary: 'Lister les réservations',
        description: "File d'attente par ordre d'arrivée. Un membre ne reçoit que les siennes.",
        requestParams: { query: listerReservations },
        responses: { 200: json('Page de réservations', R.page(R.reservation, 'PageReservations')), ...avec(400) },
      }),
      post: protegee({
        tags: ['Réservations'],
        summary: 'Réserver un ouvrage indisponible (membre)',
        description: "409 si l'ouvrage est disponible, déjà emprunté par le membre ou déjà réservé par lui.",
        requestBody: corps(creerReservation),
        responses: { 201: json('Réservation créée', R.reservationCreee), ...avec(400, 403, 404, 409) },
      }),
    },
    '/api/reservations/{id}': {
      get: protegee({
        tags: ['Réservations'],
        summary: "Détail d'une réservation",
        requestParams: parId,
        responses: { 200: json('Réservation', R.reservation), ...avec(400, 404) },
      }),
      delete: protegee({
        tags: ['Réservations'],
        summary: 'Annuler une réservation',
        requestParams: parId,
        responses: { 204: sansCorps('Réservation annulée'), ...avec(400, 404) },
      }),
    },

    '/api/assistant/flux': {
      post: protegee({
        tags: ['Assistant'],
        summary: "Poser une question à l'assistant (réponse en Server-Sent Events)",
        description: [
          'La réponse est un flux `text/event-stream` :',
          '- `event: outil` / `data: {"nom": "mes_emprunts"}` quand un outil est appelé ;',
          '- `data: {"texte": "..."}` pour chaque fragment de réponse ;',
          '- `event: fin` / `data: {}` en fin de réponse, ou `event: erreur` / `data: {"erreur": "..."}`.',
          '',
          "Les outils (rechercher_ouvrages, mes_emprunts, mes_reservations) n'acceptent aucun identifiant :",
          "ils utilisent celui du jeton. La génération s'arrête quand le client ferme la connexion.",
          'La conversation est mémorisée par utilisateur et tronquée aux dix derniers échanges.',
          "Swagger UI attend la fin du flux pour l'afficher : utilisez `curl -N` pour le voir en direct.",
        ].join('\n'),
        requestBody: corps(questionAssistant),
        responses: {
          200: {
            description: "Flux d'événements",
            content: { 'text/event-stream': { schema: R.fluxSse } },
          },
          ...avec(400),
        },
      }),
    },
    '/api/assistant/memoire': {
      delete: protegee({
        tags: ['Assistant'],
        summary: "Effacer la conversation de l'utilisateur connecté",
        responses: { 204: sansCorps('Conversation effacée') },
      }),
    },
  },
});
