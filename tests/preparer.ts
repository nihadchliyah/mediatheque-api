import { spawnSync } from 'node:child_process';

if (!/_test\b|test/.test(new URL(process.env.DATABASE_URL ?? 'x:').pathname)) {
  console.error('DATABASE_URL doit pointer vers une base de test (nom contenant "test").');
  process.exit(1);
}

const { status } = spawnSync('npx prisma migrate deploy', { stdio: 'inherit', shell: true, env: process.env });
process.exit(status ?? 1);
