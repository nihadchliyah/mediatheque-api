import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.ts';
import type { Role } from '../generated/prisma/enums.ts';

export type UtilisateurConnecte = { id: number; role: Role };

const encodeur = new TextEncoder();
const cleAccess = encodeur.encode(config.JWT_ACCESS_SECRET);
const cleRefresh = encodeur.encode(config.JWT_REFRESH_SECRET);
const EMETTEUR = 'mediatheque-api';
const ROLES: readonly string[] = ['membre', 'bibliothecaire'] satisfies Role[];

export function hacherMotDePasse(motDePasse: string): Promise<string> {
  return bcrypt.hash(motDePasse, config.BCRYPT_COUT);
}

const hachageFactice = bcrypt.hashSync('mot-de-passe-factice', config.BCRYPT_COUT);

export async function verifierMotDePasse(motDePasse: string, hachage: string | undefined): Promise<boolean> {
  const valide = await bcrypt.compare(motDePasse, hachage ?? hachageFactice);
  return Boolean(hachage) && valide;
}

export function signerAccess(utilisateur: UtilisateurConnecte): Promise<string> {
  return new SignJWT({ role: utilisateur.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(utilisateur.id))
    .setIssuer(EMETTEUR)
    .setAudience('access')
    .setIssuedAt()
    .setExpirationTime(config.JWT_ACCESS_DUREE)
    .sign(cleAccess);
}

export async function signerRefresh(utilisateur: Pick<UtilisateurConnecte, 'id'>) {
  const jti = randomUUID();
  const expireLe = new Date(Date.now() + config.REFRESH_DUREE_JOURS * 24 * 60 * 60 * 1000);
  const jeton = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(utilisateur.id))
    .setIssuer(EMETTEUR)
    .setAudience('refresh')
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expireLe)
    .sign(cleRefresh);
  return { jeton, jti, expireLe };
}

function identifiant(sujet: string | undefined): number {
  const id = Number(sujet);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Sujet du jeton invalide');
  return id;
}

export async function verifierAccess(jeton: string): Promise<UtilisateurConnecte> {
  const { payload } = await jwtVerify(jeton, cleAccess, {
    issuer: EMETTEUR, audience: 'access', algorithms: ['HS256'],
  });
  if (typeof payload.role !== 'string' || !ROLES.includes(payload.role)) {
    throw new Error('Rôle du jeton invalide');
  }
  return { id: identifiant(payload.sub), role: payload.role as Role };
}

export async function verifierRefresh(jeton: string): Promise<{ id: number; jti: string }> {
  const { payload } = await jwtVerify(jeton, cleRefresh, {
    issuer: EMETTEUR, audience: 'refresh', algorithms: ['HS256'],
  });
  if (!payload.jti) throw new Error('Identifiant du jeton absent');
  return { id: identifiant(payload.sub), jti: payload.jti };
}
