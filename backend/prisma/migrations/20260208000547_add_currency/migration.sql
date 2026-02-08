-- DropForeignKey
ALTER TABLE "PurchasedItem" DROP CONSTRAINT "PurchasedItem_userId_fkey";

-- DropIndex
DROP INDEX "Cosmetic_userId_key_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currency" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "PurchasedItem" ADD CONSTRAINT "PurchasedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
