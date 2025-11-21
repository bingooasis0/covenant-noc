-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "dashboardOptions" JSONB,
ADD COLUMN     "monitoringInterval" INTEGER NOT NULL DEFAULT 60;
