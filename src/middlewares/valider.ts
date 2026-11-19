import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { RequeteInvalide } from '../erreurs.ts';

type Source = 'params' | 'query' | 'body';
type Schemas = Partial<Record<Source, z.ZodType>>;

export type Entree<S extends Schemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

const SOURCES: Source[] = ['params', 'query', 'body'];

export function valider<S extends Schemas>(
  schemas: S,
  gestionnaire: (entree: Entree<S>, req: Request, res: Response) => unknown,
): RequestHandler {
  return async (req, res) => {
    const entree: Partial<Record<Source, unknown>> = {};
    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;
      const resultat = schema.safeParse(req[source] ?? {});
      if (!resultat.success) {
        const champs = resultat.error.issues.map((i) => ({
          champ: i.path.join('.') || source,
          message: i.message,
        }));
        throw new RequeteInvalide(`Paramètres invalides (${source})`, champs);
      }
      entree[source] = resultat.data;
    }
    await gestionnaire(entree as Entree<S>, req, res);
  };
}
