-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL,
ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_expiresAt_idx" ON "User"("expiresAt");
