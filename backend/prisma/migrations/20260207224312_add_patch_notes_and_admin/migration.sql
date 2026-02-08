-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "displayName" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PatchNote" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatchNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatchNote_createdAt_idx" ON "PatchNote"("createdAt");
