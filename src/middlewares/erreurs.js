import { ErreurHttp } from '../erreurs.js';

export function routeInconnue(req, res) {
  res.status(404).json({ erreur: `Route inconnue : ${req.method} ${req.originalUrl}` });
}

export function gestionnaireErreurs(err, req, res, next) {
  if (err instanceof ErreurHttp) {
    return res.status(err.statut).json({ erreur: err.message, ...(err.details && { champs: err.details }) });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erreur: 'Corps JSON mal formé' });
  }

  switch (err.code) {
    case 'P2025':
      return res.status(404).json({ erreur: 'Ressource introuvable' });
    case 'P2003':
      return res.status(409).json({ erreur: 'Opération impossible : ressource liée existante ou manquante' });
    case 'P2002':
      return res.status(409).json({ erreur: 'Cette ressource existe déjà' });
  }

  console.error(err);
  res.status(500).json({ erreur: 'Erreur interne du serveur' });
}
