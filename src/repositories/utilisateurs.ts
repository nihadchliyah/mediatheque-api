import { prisma } from '../db.ts';

export const champsPublics = { id: true, email: true, role: true, creeLe: true } as const;

export function trouverParEmail(email: string) {
  return prisma.utilisateur.findUnique({ where: { email } });
}

export function trouverPublic(id: number) {
  return prisma.utilisateur.findUnique({ where: { id }, select: champsPublics });
}

export function creer({ email, motDePasseHache }: { email: string; motDePasseHache: string }) {
  return prisma.utilisateur.create({
    data: { email, motDePasseHache, role: 'membre' },
    select: champsPublics,
  });
}
