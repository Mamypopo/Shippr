-- CreateEnum
CREATE TYPE "IndexCode" AS ENUM ('WCI', 'SCFI', 'BDI', 'BDRY');

-- CreateEnum
CREATE TYPE "IndexUnit" AS ENUM ('USD_PER_FEU', 'POINTS', 'USD');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('SCRAPER', 'MANUAL', 'YAHOO', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "DisruptionTag" AS ENUM ('GEOPOLITICS', 'LABOR', 'CHOKEPOINT', 'WEATHER', 'CAPACITY', 'RATE_MOVE');

-- CreateEnum
CREATE TYPE "NewsSeverity" AS ENUM ('INFO', 'WATCH', 'ALERT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('VIEWER', 'ANALYST', 'ADMIN');

-- CreateTable
CREATE TABLE "freight_index" (
    "id" TEXT NOT NULL,
    "indexCode" "IndexCode" NOT NULL,
    "routeCode" TEXT NOT NULL DEFAULT 'COMPOSITE',
    "periodDate" DATE NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "unit" "IndexUnit" NOT NULL,
    "source" "DataSource" NOT NULL,
    "enteredById" TEXT,
    "rawSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freight_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "port" (
    "id" TEXT NOT NULL,
    "unlocode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "port_status" (
    "id" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "observedOn" DATE NOT NULL,
    "avgWaitDays" DECIMAL(4,2) NOT NULL,
    "vesselsWaiting" INTEGER,
    "riskLevel" "RiskLevel" NOT NULL,
    "source" "DataSource" NOT NULL,
    "note" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "port_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_feed_item" (
    "id" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "tags" "DisruptionTag"[],
    "severity" "NewsSeverity" NOT NULL DEFAULT 'INFO',
    "matchedKeywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_feed_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_quote" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT,
    "carrierName" TEXT NOT NULL,
    "serviceName" TEXT,
    "oceanFreightUsd" DECIMAL(12,2) NOT NULL,
    "localChargesUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "freeTimeDays" INTEGER NOT NULL DEFAULT 0,
    "freeTimeValuePerDayUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transitDays" INTEGER NOT NULL,
    "isDirect" BOOLEAN NOT NULL DEFAULT true,
    "transshipmentCount" INTEGER NOT NULL DEFAULT 0,
    "onTimePct" DECIMAL(5,2) NOT NULL,
    "blankSailingsPerQuarter" INTEGER NOT NULL DEFAULT 0,
    "equipmentAvailabilityScore" INTEGER NOT NULL DEFAULT 5,
    "bookingSlaHours" INTEGER NOT NULL DEFAULT 24,
    "docTurnaroundHours" INTEGER NOT NULL DEFAULT 24,
    "serviceScore" INTEGER NOT NULL DEFAULT 5,
    "containerType" TEXT NOT NULL DEFAULT '40HC',
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ahp_decision_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "presetKey" TEXT,
    "originLocode" TEXT,
    "destLocode" TEXT,
    "routeCode" TEXT,
    "criteriaMatrix" JSONB NOT NULL,
    "criteriaWeights" JSONB NOT NULL,
    "lambdaMax" DOUBLE PRECISION NOT NULL,
    "consistencyIndex" DOUBLE PRECISION NOT NULL,
    "consistencyRatio" DOUBLE PRECISION NOT NULL,
    "isConsistent" BOOLEAN NOT NULL,
    "alternativeScores" JSONB NOT NULL,
    "winnerCarrier" TEXT NOT NULL,
    "benchmarkSnapshot" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ahp_decision_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_run" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "orgName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "freight_index_indexCode_periodDate_idx" ON "freight_index"("indexCode", "periodDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "freight_index_indexCode_routeCode_periodDate_key" ON "freight_index"("indexCode", "routeCode", "periodDate");

-- CreateIndex
CREATE UNIQUE INDEX "port_unlocode_key" ON "port"("unlocode");

-- CreateIndex
CREATE INDEX "port_status_observedOn_idx" ON "port_status"("observedOn" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "port_status_portId_observedOn_key" ON "port_status"("portId", "observedOn");

-- CreateIndex
CREATE UNIQUE INDEX "news_feed_item_guid_key" ON "news_feed_item"("guid");

-- CreateIndex
CREATE INDEX "news_feed_item_publishedAt_idx" ON "news_feed_item"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "news_feed_item_severity_idx" ON "news_feed_item"("severity");

-- CreateIndex
CREATE INDEX "carrier_quote_decisionId_idx" ON "carrier_quote"("decisionId");

-- CreateIndex
CREATE INDEX "ahp_decision_log_userId_createdAt_idx" ON "ahp_decision_log"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "scrape_run_source_startedAt_idx" ON "scrape_run"("source", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_email_key" ON "user_profile"("email");

-- AddForeignKey
ALTER TABLE "freight_index" ADD CONSTRAINT "freight_index_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "port_status" ADD CONSTRAINT "port_status_portId_fkey" FOREIGN KEY ("portId") REFERENCES "port"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "port_status" ADD CONSTRAINT "port_status_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_quote" ADD CONSTRAINT "carrier_quote_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ahp_decision_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahp_decision_log" ADD CONSTRAINT "ahp_decision_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
