import { Router } from 'express';
import * as utilisateurs from '../repositories/utilisateurs.js';
import * as refreshTokens from '../repositories/refreshTokens.js';
import * as auth from '../services/auth.js';
import { valider } from '../middlewares/valider.js';
import { authentifier } from '../middlewares/auth.js';
import { inscription, connexion, rafraichir } from '../schemas/auth.js';
import { Conflit, ErreurHttp } from '../erreurs.js';

export const routeurAuth = Router();

async function emettreJetons(utilisateur) {
  const accessToken = await auth.signerAccess(utilisateur);
  const { jeton: refreshToken, jti, expireLe } = await auth.signerRefresh(utilisateur);
  await refreshTokens.enregistrer({ jti, utilisateurId: utilisateur.id, expireLe });
  return { accessToken, refreshToken, tokenType: 'Bearer' };
}

routeurAuth.post('/inscription', valider(inscription), async (req, res) => {
  const { email, motDePasse } = req.valide.body;
  if (await utilisateurs.trouverParEmail(email)) {
    throw new Conflit('Cette adresse e-mail est déjà utilisée');
  }
  const motDePasseHache = await auth.hacherMotDePasse(motDePasse);
  const utilisateur = await utilisateurs.creer({ email, motDePasseHache });
  res.status(201).json(utilisateur);
});

routeurAuth.post('/connexion', valider(connexion), async (req, res) => {
  const { email, motDePasse } = req.valide.body;
  const utilisateur = await utilisateurs.trouverParEmail(email);
  const valide = await auth.verifierMotDePasse(motDePasse, utilisateur?.motDePasseHache);
  if (!valide) throw new ErreurHttp(401, 'Identifiants invalides');
  res.json(await emettreJetons(utilisateur));
});

routeurAuth.post('/rafraichir', valider(rafraichir), async (req, res) => {
  const invalide = new ErreurHttp(401, 'Jeton de rafraîchissement invalide');
  let charge;
  try {
    charge = await auth.verifierRefresh(req.valide.body.refreshToken);
  } catch {
    throw invalide;
  }
  if (!(await refreshTokens.consommer(charge.jti, charge.id))) {
    await refreshTokens.revoquerTous(charge.id);
    throw invalide;
  }
  const utilisateur = await utilisateurs.trouverPublic(charge.id);
  if (!utilisateur) throw invalide;
  res.json(await emettreJetons(utilisateur));
});

routeurAuth.post('/deconnexion', authentifier, async (req, res) => {
  await refreshTokens.revoquerTous(req.utilisateur.id);
  res.status(204).end();
});
