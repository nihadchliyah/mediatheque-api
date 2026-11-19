import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Adresse e-mail invalide'));

export const inscription = z.object({
  email,
  motDePasse: z.string()
    .min(12, '12 caractères minimum')
    .max(72, '72 caractères maximum')
    .refine((m) => /[a-z]/.test(m) && /[A-Z]/.test(m) && /\d/.test(m),
      'Doit contenir une minuscule, une majuscule et un chiffre'),
});

export const connexion = z.object({
  email,
  motDePasse: z.string().min(1).max(72),
});

export const rafraichir = z.object({
  refreshToken: z.string().min(1).max(2000),
});
