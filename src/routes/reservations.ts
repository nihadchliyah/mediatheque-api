import { Router } from 'express';
import * as depot from '../repositories/reservations.ts';
import { valider } from '../middlewares/valider.ts';
import { autoriser, estBibliothecaire, proprietaire, utilisateurConnecte } from '../middlewares/auth.ts';
import { idParams } from '../schemas/communs.ts';
import { creerReservation, listerReservations } from '../schemas/reservations.ts';
import { NonTrouve } from '../erreurs.ts';

export const routeurReservations = Router();

routeurReservations.get('/', valider({ query: listerReservations }, async ({ query }, req, res) => {
  const utilisateurId = estBibliothecaire(req) ? query.utilisateurId : utilisateurConnecte(req).id;
  const { donnees, total } = await depot.lister({ ...query, utilisateurId });
  res.json({ donnees, page: query.page, limite: query.limite, total, pages: Math.ceil(total / query.limite) });
}));

routeurReservations.get('/:id', valider({ params: idParams }, async ({ params }, req, res) => {
  const reservation = await depot.trouver(params.id, proprietaire(req));
  if (!reservation) throw new NonTrouve('Réservation introuvable');
  res.json(reservation);
}));

routeurReservations.post('/', autoriser('membre'), valider({ body: creerReservation }, async ({ body }, req, res) => {
  const reservation = await depot.creer({ ouvrageId: body.ouvrageId, utilisateurId: utilisateurConnecte(req).id });
  res.status(201).location(`${req.baseUrl}/${reservation.id}`).json(reservation);
}));

routeurReservations.delete('/:id', valider({ params: idParams }, async ({ params }, req, res) => {
  await depot.annuler(params.id, proprietaire(req));
  res.status(204).end();
}));
