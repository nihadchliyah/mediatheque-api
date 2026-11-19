import { Router } from 'express';
import * as utilisateurs from '../repositories/utilisateurs.ts';
import * as refreshTokens from '../repositories/refreshTokens.ts';
import * as auth from '../services/auth.ts';
import { valider } from '../middlewares/valider.ts';
import { authentifier, utilisateurConnecte } from '../middlewares/auth.ts';
import { inscription, connexion, rafraichir } from '../schemas/auth.ts';
import { Conflit, ErreurHttp } from '../erreurs.ts';

export const routeurAuth = Router();

async function emettreJetons(utilisateur: auth.UtilisateurConnecte) {
  const accessToken = await auth.signerAccess(utilisateur);
  const { jeton: refreshToken, jti, expireLe } = await auth.signerRefresh(utilisateur);
  await refreshTokens.enregistrer({ jti, utilisateurId: utilisateur.id, expireLe });
  return { accessToken, refreshToken, tokenType: 'Bearer' };
}

routeurAuth.post('/inscription', valider({ body: inscription }, async ({ body }, _req, res) => {
  if (await utilisateurs.trouverParEmail(body.email)) {
    throw new Conflit('Cette adresse e-mail est déjà utilisée');
  }
  const motDePasseHache = await auth.hacherMotDePasse(body.motDePasse);
  const utilisateur = await utilisateurs.creer({ email: body.email, motDePasseHache });
  res.status(201).json(utilisateur);
}));

routeurAuth.post('/connexion', valider({ body: connexion }, async ({ body }, _req, res) => {
  const utilisateur = await utilisateurs.trouverParEmail(body.email);
  const valide = await auth.verifierMotDePasse(body.motDePasse, utilisateur?.motDePasseHache);
  if (!utilisateur || !valide) throw new ErreurHttp(401, 'Identifiants invalides');
  res.json(await emettreJetons(utilisateur));
}));

routeurAuth.post('/rafraichir', valider({ body: rafraichir }, async ({ body }, _req, res) => {
  const invalide = new ErreurHttp(401, 'Jeton de rafraîchissement invalide');
  let charge: { id: number; jti: string };
  try {
    charge = await auth.verifierRefresh(body.refreshToken);
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
}));

routeurAuth.post('/deconnexion', authentifier, async (req, res) => {
  await refreshTokens.revoquerTous(utilisateurConnecte(req).id);
  res.status(204).end();
});
