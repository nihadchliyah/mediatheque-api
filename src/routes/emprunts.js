import { Router } from 'express';
import * as depot from '../repositories/emprunts.js';
import { valider } from '../middlewares/valider.js';
import { autoriser, estBibliothecaire } from '../middlewares/auth.js';
import { idParams } from '../schemas/communs.js';
import { creerEmprunt, listerEmprunts, modifierEmprunt } from '../schemas/emprunts.js';
import { NonTrouve } from '../erreurs.js';

export const routeurEmprunts = Router();

const proprietaire = (req) => (estBibliothecaire(req) ? undefined : req.utilisateur.id);

routeurEmprunts.get('/', valider(listerEmprunts, 'query'), async (req, res) => {
  const { page, limite, rendu, utilisateurId } = req.valide.query;
  const filtreUtilisateur = estBibliothecaire(req) ? utilisateurId : req.utilisateur.id;
  const { donnees, total } = await depot.lister({ page, limite, rendu, utilisateurId: filtreUtilisateur });
  res.json({ donnees, page, limite, total, pages: Math.ceil(total / limite) });
});

routeurEmprunts.get('/:id', valider(idParams, 'params'), async (req, res) => {
  const emprunt = await depot.trouver(req.valide.params.id, proprietaire(req));
  if (!emprunt) throw new NonTrouve('Emprunt introuvable');
  res.json(emprunt);
});

routeurEmprunts.post('/', valider(creerEmprunt), async (req, res) => {
  const { utilisateurId, ...donnees } = req.valide.body;
  const pour = estBibliothecaire(req) ? (utilisateurId ?? req.utilisateur.id) : req.utilisateur.id;
  const emprunt = await depot.creer({ ...donnees, utilisateurId: pour });
  res.status(201).location(`${req.baseUrl}/${emprunt.id}`).json(emprunt);
});

routeurEmprunts.post('/:id/retour', valider(idParams, 'params'), async (req, res) => {
  res.json(await depot.retourner(req.valide.params.id, proprietaire(req)));
});

routeurEmprunts.patch('/:id', autoriser('bibliothecaire'), valider(idParams, 'params'), valider(modifierEmprunt), async (req, res) => {
  res.json(await depot.modifier(req.valide.params.id, req.valide.body));
});

routeurEmprunts.delete('/:id', autoriser('bibliothecaire'), valider(idParams, 'params'), async (req, res) => {
  await depot.supprimer(req.valide.params.id);
  res.status(204).end();
});
