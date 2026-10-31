CREATE TABLE "forum_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"url" text,
	"storage_key" text,
	"file_name" text,
	"content_type" text,
	"size_bytes" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "forum_attachments_kind_ok" CHECK ("forum_attachments"."kind" in ('file', 'link')),
	CONSTRAINT "forum_attachments_shape" CHECK (("forum_attachments"."kind" = 'file' and "forum_attachments"."storage_key" is not null and "forum_attachments"."content_type" is not null) or ("forum_attachments"."kind" = 'link' and "forum_attachments"."url" is not null))
);
--> statement-breakpoint
CREATE TABLE "forum_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"admin_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"comments_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_attachments" ADD CONSTRAINT "forum_attachments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_attachments_post_idx" ON "forum_attachments" USING btree ("post_id","position");--> statement-breakpoint
CREATE INDEX "forum_comments_post_idx" ON "forum_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_comments_user_idx" ON "forum_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_posts_created_idx" ON "forum_posts" USING btree ("created_at");