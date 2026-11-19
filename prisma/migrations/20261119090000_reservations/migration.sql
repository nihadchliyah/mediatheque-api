-- CreateTable
CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "ouvrageId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_ouvrageId_creeLe_idx" ON "reservations"("ouvrageId", "creeLe");

-- CreateIndex
CREATE INDEX "reservations_utilisateurId_idx" ON "reservations"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_ouvrageId_utilisateurId_key" ON "reservations"("ouvrageId", "utilisateurId");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_ouvrageId_fkey" FOREIGN KEY ("ouvrageId") REFERENCES "ouvrages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

