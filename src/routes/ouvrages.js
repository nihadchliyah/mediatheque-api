import { Router } from 'express';
import * as depot from '../repositories/ouvrages.js';
import { valider } from '../middlewares/valider.js';
import { autoriser, estBibliothecaire } from '../middlewares/auth.js';
import { idParams } from '../schemas/communs.js';
import { creerOuvrage, listerOuvrages, modifierOuvrage } from '../schemas/ouvrages.js';
import { Conflit, NonTrouve } from '../erreurs.js';

export const routeurOuvrages = Router();

const bibliothecaire = autoriser('bibliothecaire');

routeurOuvrages.get('/', valider(listerOuvrages, 'query'), async (req, res) => {
  const { page, limite, disponible } = req.valide.query;
  const { donnees, total } = await depot.lister({ page, limite, disponible });
  res.json({ donnees, page, limite, total, pages: Math.ceil(total / limite) });
});

routeurOuvrages.get('/:id', valider(idParams, 'params'), async (req, res) => {
  const ouvrage = await depot.trouverAvecEmpruntsEnCours(
    req.valide.params.id,
    estBibliothecaire(req) ? undefined : req.utilisateur.id,
  );
  if (!ouvrage) throw new NonTrouve('Ouvrage introuvable');
  res.json(ouvrage);
});

routeurOuvrages.post('/', bibliothecaire, valider(creerOuvrage), async (req, res) => {
  const ouvrage = await depot.creer(req.valide.body);
  res.status(201).location(`${req.baseUrl}/${ouvrage.id}`).json(ouvrage);
});

routeurOuvrages.patch('/:id', bibliothecaire, valider(idParams, 'params'), valider(modifierOuvrage), async (req, res) => {
  res.json(await depot.modifier(req.valide.params.id, req.valide.body));
});

routeurOuvrages.delete('/:id', bibliothecaire, valider(idParams, 'params'), async (req, res) => {
  const { id } = req.valide.params;
  if (await depot.compterEmpruntsEnCours(id) > 0) {
    throw new Conflit('Impossible de supprimer un ouvrage actuellement emprunté');
  }
  await depot.supprimer(id);
  res.status(204).end();
});
