ALTER TABLE "forum_comments" ADD COLUMN "owner_seen_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "forum_comments" SET "owner_seen_at" = now();
