-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,
    "serverUrl" TEXT,
    "port" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSession_player1Id_idx" ON "GameSession"("player1Id");

-- CreateIndex
CREATE INDEX "GameSession_player2Id_idx" ON "GameSession"("player2Id");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");
