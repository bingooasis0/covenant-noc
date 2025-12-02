-- CreateTable
CREATE TABLE "CardConfiguration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "targetId" TEXT,
    "viewType" TEXT NOT NULL DEFAULT 'noc',
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'meraki_api_key',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 0,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "maxSitesPerUser" INTEGER NOT NULL DEFAULT 100,
    "enableRegistration" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardConfiguration_userId_scope_targetId_viewType_key" ON "CardConfiguration"("userId", "scope", "targetId", "viewType");

-- AddForeignKey
ALTER TABLE "CardConfiguration" ADD CONSTRAINT "CardConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
