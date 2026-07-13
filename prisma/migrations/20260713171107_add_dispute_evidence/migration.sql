/*
  Warnings:

  - You are about to drop the column `fileName` on the `DisputeEvidence` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `DisputeEvidence` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `DisputeEvidence` table. All the data in the column will be lost.
  - Added the required column `originalName` to the `DisputeEvidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sha256Hash` to the `DisputeEvidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeBytes` to the `DisputeEvidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storagePath` to the `DisputeEvidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storedName` to the `DisputeEvidence` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DisputeEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disputeId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisputeEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DisputeEvidence" ("createdAt", "disputeId", "id", "mimeType", "uploadedById") SELECT "createdAt", "disputeId", "id", "mimeType", "uploadedById" FROM "DisputeEvidence";
DROP TABLE "DisputeEvidence";
ALTER TABLE "new_DisputeEvidence" RENAME TO "DisputeEvidence";
CREATE INDEX "DisputeEvidence_disputeId_idx" ON "DisputeEvidence"("disputeId");
CREATE INDEX "DisputeEvidence_uploadedById_idx" ON "DisputeEvidence"("uploadedById");
CREATE INDEX "DisputeEvidence_createdAt_idx" ON "DisputeEvidence"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
