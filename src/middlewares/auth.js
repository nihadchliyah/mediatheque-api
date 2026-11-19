import { ErreurHttp } from '../erreurs.js';
import { verifierAccess } from '../services/auth.js';

export async function authentifier(req, _res, next) {
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

export const autoriser = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.utilisateur?.role)) {
    return next(new ErreurHttp(403, 'Droits insuffisants'));
  }
  next();
};

export const estBibliothecaire = (req) => req.utilisateur.role === 'bibliothecaire';
