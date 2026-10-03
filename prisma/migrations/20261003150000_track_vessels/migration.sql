-- CreateTable
CREATE TABLE "tracked_vessel" (
    "id" TEXT NOT NULL,
    "mmsi" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "destinationPortId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessel_position" (
    "id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "speedKnots" DOUBLE PRECISION,
    "courseDeg" DOUBLE PRECISION,
    "navStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_vessel_mmsi_key" ON "tracked_vessel"("mmsi");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_position_vesselId_observedAt_key" ON "vessel_position"("vesselId", "observedAt");

-- CreateIndex
CREATE INDEX "vessel_position_vesselId_observedAt_idx" ON "vessel_position"("vesselId", "observedAt" DESC);

-- AddForeignKey
ALTER TABLE "tracked_vessel" ADD CONSTRAINT "tracked_vessel_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_vessel" ADD CONSTRAINT "tracked_vessel_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_position" ADD CONSTRAINT "vessel_position_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "tracked_vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
