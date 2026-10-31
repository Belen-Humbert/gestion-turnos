ALTER TABLE "forum_posts" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_forum" boolean DEFAULT true NOT NULL;