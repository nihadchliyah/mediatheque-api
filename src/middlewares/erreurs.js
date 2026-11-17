import { ErreurHttp } from '../erreurs.js';

export function routeInconnue(req, res) {
  res.status(404).json({ erreur: 'Route inconnue' });
}

const reponse = (res, statut, erreur, champs) => res.status(statut).json({ erreur, ...(champs && { champs }) });

export function gestionnaireErreurs(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ErreurHttp) return reponse(res, err.statut, err.message, err.details);

  if (typeof err.code === 'string' && err.code.startsWith('ERR_J')) {
    return reponse(res, 401, 'Jeton invalide ou expiré');
  }

  switch (err.type) {
    case 'entity.parse.failed': return reponse(res, 400, 'Corps JSON mal formé');
    case 'entity.too.large': return reponse(res, 413, 'Corps de requête trop volumineux (100 Ko maximum)');
  }

  switch (err.code) {
    case 'P2025': return reponse(res, 404, 'Ressource introuvable');
    case 'P2003': return reponse(res, 409, 'Opération impossible : ressource liée existante ou manquante');
    case 'P2002': return reponse(res, 409, 'Cette ressource existe déjà');
  }

  const statut = Number(err.status ?? err.statusCode);
  if (statut >= 400 && statut < 500) return reponse(res, statut, 'Requête invalide');

  console.error(`Erreur interne : ${err.name}${err.code ? ` (${err.code})` : ''} sur ${req.method} ${req.path}`);
  reponse(res, 500, 'Erreur interne du serveur');
}
