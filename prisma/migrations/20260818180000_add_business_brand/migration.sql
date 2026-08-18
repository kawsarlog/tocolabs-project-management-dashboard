-- Brand logo and optional workspace tagline for business-owner settings.
ALTER TABLE "business" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "business" ADD COLUMN "tagline" TEXT;
