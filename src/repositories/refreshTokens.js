import { prisma } from '../db.js';

export function enregistrer({ jti, utilisateurId, expireLe }) {
  return prisma.refreshToken.create({ data: { jti, utilisateurId, expireLe } });
}

export async function consommer(jti, utilisateurId) {
  const { count } = await prisma.refreshToken.updateMany({
    where: { jti, utilisateurId, revoqueLe: null, expireLe: { gt: new Date() } },
    data: { revoqueLe: new Date() },
  });
  return count === 1;
}

export function revoquerTous(utilisateurId) {
  return prisma.refreshToken.updateMany({
    where: { utilisateurId, revoqueLe: null },
    data: { revoqueLe: new Date() },
  });
}
