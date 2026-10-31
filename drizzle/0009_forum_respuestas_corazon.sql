ALTER TABLE "forum_comments" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD COLUMN "admin_hearted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_parent_id_forum_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."forum_comments"("id") ON DELETE cascade ON UPDATE no action;