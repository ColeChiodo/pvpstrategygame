-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "won" BOOLEAN NOT NULL,
    "unitsLost" INTEGER NOT NULL,
    "unitsKilled" INTEGER NOT NULL,
    "turns" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "rankChange" INTEGER NOT NULL,
    "replayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rank" (
    "userId" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "tier" TEXT NOT NULL DEFAULT 'BRONZE',
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "season" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Cosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loadout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitSkins" JSONB NOT NULL,
    "badge" TEXT,
    "reaction" TEXT NOT NULL DEFAULT 'default',

    CONSTRAINT "Loadout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Replay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchData" JSONB NOT NULL,
    "winnerId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Replay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerId_key" ON "User"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_token_idx" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "MatchHistory_userId_idx" ON "MatchHistory"("userId");

-- CreateIndex
CREATE INDEX "MatchHistory_createdAt_idx" ON "MatchHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cosmetic_userId_key_key" ON "Cosmetic"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Loadout_userId_key" ON "Loadout"("userId");

-- CreateIndex
CREATE INDEX "Replay_userId_idx" ON "Replay"("userId");

-- CreateIndex
CREATE INDEX "Replay_createdAt_idx" ON "Replay"("createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rank" ADD CONSTRAINT "Rank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cosmetic" ADD CONSTRAINT "Cosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loadout" ADD CONSTRAINT "Loadout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
