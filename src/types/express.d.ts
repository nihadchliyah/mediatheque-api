import type { UtilisateurConnecte } from '../services/auth.ts';

declare global {
  namespace Express {
    interface Request {
      utilisateur?: UtilisateurConnecte;
    }
  }
}

export {};
