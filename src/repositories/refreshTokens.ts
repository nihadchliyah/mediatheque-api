import { prisma } from '../db.ts';

export function enregistrer(donnees: { jti: string; utilisateurId: number; expireLe: Date }) {
  return prisma.refreshToken.create({ data: donnees });
}

export async function consommer(jti: string, utilisateurId: number): Promise<boolean> {
  const { count } = await prisma.refreshToken.updateMany({
    where: { jti, utilisateurId, revoqueLe: null, expireLe: { gt: new Date() } },
    data: { revoqueLe: new Date() },
  });
  return count === 1;
}

export function revoquerTous(utilisateurId: number) {
  return prisma.refreshToken.updateMany({
    where: { utilisateurId, revoqueLe: null },
    data: { revoqueLe: new Date() },
  });
}
