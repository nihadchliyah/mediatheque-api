import { Router } from 'express';
import * as depot from '../repositories/ouvrages.ts';
import { valider } from '../middlewares/valider.ts';
import { autoriser, proprietaire } from '../middlewares/auth.ts';
import { idParams } from '../schemas/communs.ts';
import { creerOuvrage, listerOuvrages, modifierOuvrage } from '../schemas/ouvrages.ts';
import { NonTrouve } from '../erreurs.ts';

export const routeurOuvrages = Router();

const bibliothecaire = autoriser('bibliothecaire');

routeurOuvrages.get('/', valider({ query: listerOuvrages }, async ({ query }, _req, res) => {
  const { donnees, total } = await depot.lister(query);
  res.json({ donnees, page: query.page, limite: query.limite, total, pages: Math.ceil(total / query.limite) });
}));

routeurOuvrages.get('/:id', valider({ params: idParams }, async ({ params }, req, res) => {
  const ouvrage = await depot.trouverAvecEmpruntsEnCours(params.id, proprietaire(req));
  if (!ouvrage) throw new NonTrouve('Ouvrage introuvable');
  res.json(ouvrage);
}));

routeurOuvrages.post('/', bibliothecaire, valider({ body: creerOuvrage }, async ({ body }, req, res) => {
  const ouvrage = await depot.creer(body);
  res.status(201).location(`${req.baseUrl}/${ouvrage.id}`).json(ouvrage);
}));

routeurOuvrages.patch('/:id', bibliothecaire, valider({ params: idParams, body: modifierOuvrage }, async ({ params, body }, _req, res) => {
  res.json(await depot.modifier(params.id, body));
}));

routeurOuvrages.delete('/:id', bibliothecaire, valider({ params: idParams }, async ({ params }, _req, res) => {
  await depot.supprimer(params.id);
  res.status(204).end();
}));
