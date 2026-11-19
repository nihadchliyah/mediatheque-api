import type { NextFunction, Request, Response } from 'express';
import { ErreurHttp } from '../erreurs.ts';
import { verifierAccess, type UtilisateurConnecte } from '../services/auth.ts';
import type { Role } from '../generated/prisma/enums.ts';

export async function authentifier(req: Request, _res: Response, next: NextFunction) {
  const [schema, jeton] = (req.get('authorization') ?? '').split(' ');
  if (schema !== 'Bearer' || !jeton) {
    return next(new ErreurHttp(401, 'Authentification requise'));
  }
  try {
    req.utilisateur = await verifierAccess(jeton);
    next();
  } catch {
    next(new ErreurHttp(401, 'Jeton invalide ou expiré'));
  }
}

export function utilisateurConnecte(req: Request): UtilisateurConnecte {
  if (!req.utilisateur) throw new ErreurHttp(401, 'Authentification requise');
  return req.utilisateur;
}

export const autoriser = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.utilisateur || !roles.includes(req.utilisateur.role)) {
    return next(new ErreurHttp(403, 'Droits insuffisants'));
  }
  next();
};

export const estBibliothecaire = (req: Request) => utilisateurConnecte(req).role === 'bibliothecaire';

export const proprietaire = (req: Request) => (estBibliothecaire(req) ? undefined : utilisateurConnecte(req).id);
