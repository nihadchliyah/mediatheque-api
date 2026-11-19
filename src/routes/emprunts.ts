import { Router } from 'express';
import * as depot from '../repositories/emprunts.ts';
import { valider } from '../middlewares/valider.ts';
import { autoriser, estBibliothecaire, proprietaire, utilisateurConnecte } from '../middlewares/auth.ts';
import { idParams } from '../schemas/communs.ts';
import { creerEmprunt, listerEmprunts, modifierEmprunt } from '../schemas/emprunts.ts';
import { NonTrouve } from '../erreurs.ts';

export const routeurEmprunts = Router();

const bibliothecaire = autoriser('bibliothecaire');

routeurEmprunts.get('/', valider({ query: listerEmprunts }, async ({ query }, req, res) => {
  const utilisateurId = estBibliothecaire(req) ? query.utilisateurId : utilisateurConnecte(req).id;
  const { donnees, total } = await depot.lister({ ...query, utilisateurId });
  res.json({ donnees, page: query.page, limite: query.limite, total, pages: Math.ceil(total / query.limite) });
}));

routeurEmprunts.get('/:id', valider({ params: idParams }, async ({ params }, req, res) => {
  const emprunt = await depot.trouver(params.id, proprietaire(req));
  if (!emprunt) throw new NonTrouve('Emprunt introuvable');
  res.json(emprunt);
}));

routeurEmprunts.post('/', valider({ body: creerEmprunt }, async ({ body }, req, res) => {
  const { utilisateurId, ...donnees } = body;
  const moi = utilisateurConnecte(req).id;
  const pour = estBibliothecaire(req) ? (utilisateurId ?? moi) : moi;
  const emprunt = await depot.creer({ ...donnees, utilisateurId: pour });
  res.status(201).location(`${req.baseUrl}/${emprunt.id}`).json(emprunt);
}));

routeurEmprunts.post('/:id/retour', valider({ params: idParams }, async ({ params }, req, res) => {
  res.json(await depot.retourner(params.id, proprietaire(req)));
}));

routeurEmprunts.patch('/:id', bibliothecaire, valider({ params: idParams, body: modifierEmprunt }, async ({ params, body }, _req, res) => {
  res.json(await depot.modifier(params.id, body));
}));

routeurEmprunts.delete('/:id', bibliothecaire, valider({ params: idParams }, async ({ params }, _req, res) => {
  await depot.supprimer(params.id);
  res.status(204).end();
}));
