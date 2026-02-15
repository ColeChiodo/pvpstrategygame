/*
  Warnings:

  - You are about to drop the `MatchHistory` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[gameSessionId,userId]` on the table `Replay` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gameSessionId` to the `Replay` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MatchHistory" DROP CONSTRAINT "MatchHistory_opponentId_fkey";

-- DropForeignKey
ALTER TABLE "MatchHistory" DROP CONSTRAINT "MatchHistory_userId_fkey";

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "loserId" TEXT,
ADD COLUMN     "winnerId" TEXT;

-- AlterTable
ALTER TABLE "Rank" ADD COLUMN     "longestStreak" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Replay" ADD COLUMN     "gameSessionId" TEXT NOT NULL;

-- DropTable
DROP TABLE "MatchHistory";

-- CreateTable
CREATE TABLE "GameStats" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPlayer1" BOOLEAN NOT NULL,
    "unitsKilled" INTEGER NOT NULL DEFAULT 0,
    "unitsLost" INTEGER NOT NULL DEFAULT 0,
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "damageHealed" INTEGER NOT NULL DEFAULT 0,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "timeUsed" INTEGER NOT NULL DEFAULT 0,
    "attacksMade" INTEGER NOT NULL DEFAULT 0,
    "killsLanded" INTEGER NOT NULL DEFAULT 0,
    "avgDamagePerAttack" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingKingHealth" INTEGER NOT NULL DEFAULT 0,
    "meleeDamage" INTEGER NOT NULL DEFAULT 0,
    "rangedDamage" INTEGER NOT NULL DEFAULT 0,
    "mageDamage" INTEGER NOT NULL DEFAULT 0,
    "healerDamage" INTEGER NOT NULL DEFAULT 0,
    "cavalryDamage" INTEGER NOT NULL DEFAULT 0,
    "scoutDamage" INTEGER NOT NULL DEFAULT 0,
    "tankDamage" INTEGER NOT NULL DEFAULT 0,
    "kingDamage" INTEGER NOT NULL DEFAULT 0,
    "meleeHealing" INTEGER NOT NULL DEFAULT 0,
    "rangedHealing" INTEGER NOT NULL DEFAULT 0,
    "mageHealing" INTEGER NOT NULL DEFAULT 0,
    "healerHealing" INTEGER NOT NULL DEFAULT 0,
    "cavalryHealing" INTEGER NOT NULL DEFAULT 0,
    "scoutHealing" INTEGER NOT NULL DEFAULT 0,
    "tankHealing" INTEGER NOT NULL DEFAULT 0,
    "kingHealing" INTEGER NOT NULL DEFAULT 0,
    "meleeKilled" INTEGER NOT NULL DEFAULT 0,
    "rangedKilled" INTEGER NOT NULL DEFAULT 0,
    "mageKilled" INTEGER NOT NULL DEFAULT 0,
    "healerKilled" INTEGER NOT NULL DEFAULT 0,
    "cavalryKilled" INTEGER NOT NULL DEFAULT 0,
    "scoutKilled" INTEGER NOT NULL DEFAULT 0,
    "tankKilled" INTEGER NOT NULL DEFAULT 0,
    "kingKilled" INTEGER NOT NULL DEFAULT 0,
    "meleeLost" INTEGER NOT NULL DEFAULT 0,
    "rangedLost" INTEGER NOT NULL DEFAULT 0,
    "mageLost" INTEGER NOT NULL DEFAULT 0,
    "healerLost" INTEGER NOT NULL DEFAULT 0,
    "cavalryLost" INTEGER NOT NULL DEFAULT 0,
    "scoutLost" INTEGER NOT NULL DEFAULT 0,
    "tankLost" INTEGER NOT NULL DEFAULT 0,
    "kingLost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameStats_userId_idx" ON "GameStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Replay_gameSessionId_userId_key" ON "Replay"("gameSessionId", "userId");

-- AddForeignKey
ALTER TABLE "GameStats" ADD CONSTRAINT "GameStats_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
