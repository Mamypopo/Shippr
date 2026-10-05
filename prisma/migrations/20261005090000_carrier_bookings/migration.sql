-- CreateTable
CREATE TABLE "carrier_booking" (
    "id" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "bookedOn" DATE NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "expectedArrival" DATE,
    "arrivedAt" DATE,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carrier_booking_carrierName_idx" ON "carrier_booking"("carrierName");

-- AddForeignKey
ALTER TABLE "carrier_booking" ADD CONSTRAINT "carrier_booking_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
