CREATE TYPE "public"."payment_status" AS ENUM('pending', 'cash', 'transfer');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "payment_status" "payment_status" DEFAULT 'pending' NOT NULL;