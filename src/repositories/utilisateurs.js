import { prisma } from '../db.js';

export const champsPublics = { id: true, email: true, role: true, creeLe: true };

export function trouverParEmail(email) {
  return prisma.utilisateur.findUnique({ where: { email } });
}

export function trouverPublic(id) {
  return prisma.utilisateur.findUnique({ where: { id }, select: champsPublics });
}

export function creer({ email, motDePasseHache }) {
  return prisma.utilisateur.create({
    data: { email, motDePasseHache, role: 'membre' },
    select: champsPublics,
  });
}
