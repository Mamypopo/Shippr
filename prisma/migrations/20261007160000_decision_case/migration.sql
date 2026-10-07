-- AlterTable
ALTER TABLE "ahp_decision_log"
  ADD COLUMN "caseId" TEXT,
  ADD COLUMN "equipment" TEXT,
  ADD COLUMN "cargoDescription" TEXT,
  ADD COLUMN "quantity" INTEGER,
  ADD COLUMN "requiredEtd" DATE,
  ADD COLUMN "scenario" TEXT;
