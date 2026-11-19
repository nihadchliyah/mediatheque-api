import type { NextFunction, Request, Response } from 'express';
import { ErreurHttp, type DetailChamp } from '../erreurs.ts';

type ErreurBrute = { name?: unknown; code?: unknown; type?: unknown; status?: unknown; statusCode?: unknown };

export function routeInconnue(_req: Request, res: Response) {
  res.status(404).json({ erreur: 'Route inconnue' });
}

const reponse = (res: Response, statut: number, erreur: string, champs?: DetailChamp[]) =>
  res.status(statut).json({ erreur, ...(champs && { champs }) });

export function gestionnaireErreurs(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof ErreurHttp) return reponse(res, err.statut, err.message, err.details);

  const e: ErreurBrute = typeof err === 'object' && err !== null ? err : {};

  if (typeof e.code === 'string' && e.code.startsWith('ERR_J')) {
    return reponse(res, 401, 'Jeton invalide ou expiré');
  }

  switch (e.type) {
    case 'entity.parse.failed': return reponse(res, 400, 'Corps JSON mal formé');
    case 'entity.too.large': return reponse(res, 413, 'Corps de requête trop volumineux (100 Ko maximum)');
  }

  switch (e.code) {
    case 'P2025': return reponse(res, 404, 'Ressource introuvable');
    case 'P2003': return reponse(res, 409, 'Opération impossible : ressource liée existante ou manquante');
    case 'P2002': return reponse(res, 409, 'Cette ressource existe déjà');
  }

  const statut = Number(e.status ?? e.statusCode);
  if (statut >= 400 && statut < 500) return reponse(res, statut, 'Requête invalide');

  console.error(`Erreur interne : ${String(e.name ?? 'Inconnue')}${e.code ? ` (${String(e.code)})` : ''} sur ${req.method} ${req.path}`);
  reponse(res, 500, 'Erreur interne du serveur');
}
