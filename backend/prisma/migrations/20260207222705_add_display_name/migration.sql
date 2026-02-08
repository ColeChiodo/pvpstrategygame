/*
  Warnings:

  - Added the required column `displayName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "displayName" TEXT NOT NULL DEFAULT 'Player';

-- Update existing users to have displayName equal to their username
UPDATE "User" SET "displayName" = "username" WHERE "displayName" = 'Player';
