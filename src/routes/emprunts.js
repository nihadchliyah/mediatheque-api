import { Router } from 'express';
import * as depot from '../repositories/emprunts.js';
import { valider } from '../middlewares/valider.js';
import { idParams } from '../schemas/communs.js';
import { creerEmprunt, listerEmprunts, modifierEmprunt } from '../schemas/emprunts.js';
import { NonTrouve } from '../erreurs.js';

export const routeurEmprunts = Router();

routeurEmprunts.get('/', valider(listerEmprunts, 'query'), async (req, res) => {
  const { page, limite, rendu } = req.valide.query;
  const { donnees, total } = await depot.lister({ page, limite, rendu });
  res.json({ donnees, page, limite, total, pages: Math.ceil(total / limite) });
});

routeurEmprunts.get('/:id', valider(idParams, 'params'), async (req, res) => {
  const emprunt = await depot.trouver(req.valide.params.id);
  if (!emprunt) throw new NonTrouve('Emprunt introuvable');
  res.json(emprunt);
});

routeurEmprunts.post('/', valider(creerEmprunt), async (req, res) => {
  const emprunt = await depot.creer(req.valide.body);
  res.status(201).location(`${req.baseUrl}/${emprunt.id}`).json(emprunt);
});

routeurEmprunts.post('/:id/retour', valider(idParams, 'params'), async (req, res) => {
  res.json(await depot.retourner(req.valide.params.id));
});

routeurEmprunts.patch('/:id', valider(idParams, 'params'), valider(modifierEmprunt), async (req, res) => {
  res.json(await depot.modifier(req.valide.params.id, req.valide.body));
});

routeurEmprunts.delete('/:id', valider(idParams, 'params'), async (req, res) => {
  await depot.supprimer(req.valide.params.id);
  res.status(204).end();
});
