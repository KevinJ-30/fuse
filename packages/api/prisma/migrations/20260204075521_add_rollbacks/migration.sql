-- AlterTable
ALTER TABLE "Rollback" ADD COLUMN     "blastRadius" JSONB,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "strategy" TEXT NOT NULL DEFAULT 'SINGLE';
