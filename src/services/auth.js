import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const encodeur = new TextEncoder();
const cleAccess = encodeur.encode(config.JWT_ACCESS_SECRET);
const cleRefresh = encodeur.encode(config.JWT_REFRESH_SECRET);
const EMETTEUR = 'mediatheque-api';

export function hacherMotDePasse(motDePasse) {
  return bcrypt.hash(motDePasse, config.BCRYPT_COUT);
}

const hachageFactice = bcrypt.hashSync('mot-de-passe-factice', config.BCRYPT_COUT);

export async function verifierMotDePasse(motDePasse, hachage) {
  const valide = await bcrypt.compare(motDePasse, hachage ?? hachageFactice);
  return Boolean(hachage) && valide;
}

export function signerAccess(utilisateur) {
  return new SignJWT({ role: utilisateur.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(utilisateur.id))
    .setIssuer(EMETTEUR)
    .setAudience('access')
    .setIssuedAt()
    .setExpirationTime(config.JWT_ACCESS_DUREE)
    .sign(cleAccess);
}

export async function signerRefresh(utilisateur) {
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

export async function verifierAccess(jeton) {
  const { payload } = await jwtVerify(jeton, cleAccess, {
    issuer: EMETTEUR, audience: 'access', algorithms: ['HS256'],
  });
  return { id: Number(payload.sub), role: payload.role };
}

export async function verifierRefresh(jeton) {
  const { payload } = await jwtVerify(jeton, cleRefresh, {
    issuer: EMETTEUR, audience: 'refresh', algorithms: ['HS256'],
  });
  return { id: Number(payload.sub), jti: payload.jti };
}
