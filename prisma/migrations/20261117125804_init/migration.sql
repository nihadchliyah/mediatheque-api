-- CreateTable
CREATE TABLE "ouvrages" (
    "id" SERIAL NOT NULL,
    "titre" VARCHAR(150) NOT NULL,
    "auteur" VARCHAR(100) NOT NULL,
    "annee" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ouvrages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emprunts" (
    "id" SERIAL NOT NULL,
    "ouvrageId" INTEGER NOT NULL,
    "emprunteur" VARCHAR(80) NOT NULL,
    "dateEmprunt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRetourPrevue" TIMESTAMP(3) NOT NULL,
    "rendu" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emprunts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ouvrages_titre_auteur_key" ON "ouvrages"("titre", "auteur");

-- CreateIndex
CREATE INDEX "emprunts_ouvrageId_idx" ON "emprunts"("ouvrageId");

-- AddForeignKey
ALTER TABLE "emprunts" ADD CONSTRAINT "emprunts_ouvrageId_fkey" FOREIGN KEY ("ouvrageId") REFERENCES "ouvrages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
