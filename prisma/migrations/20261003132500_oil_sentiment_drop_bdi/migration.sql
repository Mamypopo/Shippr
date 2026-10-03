-- AlterEnum
BEGIN;
CREATE TYPE "IndexCode_new" AS ENUM ('WCI', 'SCFI', 'BDRY', 'WTI', 'BRENT');
ALTER TABLE "freight_index" ALTER COLUMN "indexCode" TYPE "IndexCode_new" USING ("indexCode"::text::"IndexCode_new");
ALTER TYPE "IndexCode" RENAME TO "IndexCode_old";
ALTER TYPE "IndexCode_new" RENAME TO "IndexCode";
DROP TYPE "public"."IndexCode_old";
COMMIT;

