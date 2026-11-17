import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './db.js';

const port = Number(process.env.PORT) || 3000;

const serveur = app.listen(port, () => {
  console.log(`API médiathèque sur http://localhost:${port}`);
});

async function arreter() {
  serveur.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);
