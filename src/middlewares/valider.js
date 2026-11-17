import { RequeteInvalide } from '../erreurs.js';

export const valider = (schema, source = 'body') => (req, _res, next) => {
  const resultat = schema.safeParse(req[source] ?? {});
  if (!resultat.success) {
    const champs = resultat.error.issues.map((i) => ({
      champ: i.path.join('.') || source,
      message: i.message,
    }));
    return next(new RequeteInvalide(`Paramètres invalides (${source})`, champs));
  }
  req.valide = { ...req.valide, [source]: resultat.data };
  next();
};
