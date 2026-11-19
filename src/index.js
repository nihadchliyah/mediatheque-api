import { config } from './config.js';
import { creerApp } from './app.js';
import { prisma } from './db.js';

const serveur = creerApp().listen(config.PORT, () => {
  console.log(`API médiathèque sur http://localhost:${config.PORT}`);
});

async function arreter() {
  serveur.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);
