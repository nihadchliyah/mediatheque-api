-- Les emprunts existants n'ont pas de compte associé : ils sont supprimés.
DELETE FROM "emprunts";
UPDATE "ouvrages" SET "disponible" = true;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('membre', 'bibliothecaire');

-- AlterTable
ALTER TABLE "emprunts" DROP COLUMN "emprunteur",
ADD COLUMN     "utilisateurId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "motDePasseHache" VARCHAR(100) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'membre',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "jti" VARCHAR(64) NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "revoqueLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "refresh_tokens_utilisateurId_idx" ON "refresh_tokens"("utilisateurId");

-- CreateIndex
CREATE INDEX "emprunts_utilisateurId_idx" ON "emprunts"("utilisateurId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprunts" ADD CONSTRAINT "emprunts_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

