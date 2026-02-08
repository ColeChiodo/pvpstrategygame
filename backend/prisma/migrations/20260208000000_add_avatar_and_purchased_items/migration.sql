-- Drop the existing avatarUrl column and add avatar with default
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarUrl";
ALTER TABLE "User" ADD COLUMN "avatar" TEXT NOT NULL DEFAULT '/assets/avatars/free/default.png';

-- Add unique constraint to Cosmetic table
ALTER TABLE "Cosmetic" ADD CONSTRAINT "Cosmetic_userId_type_key_key" UNIQUE ("userId", "type", "key");

-- Create PurchasedItem table
CREATE TABLE "PurchasedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasedItem_pkey" PRIMARY KEY ("id")
);

-- Add relation to User model
ALTER TABLE "PurchasedItem" ADD CONSTRAINT "PurchasedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique constraint
CREATE UNIQUE INDEX "PurchasedItem_userId_type_key_key" ON "PurchasedItem"("userId", "type", "key");
CREATE INDEX "PurchasedItem_userId_idx" ON "PurchasedItem"("userId");
