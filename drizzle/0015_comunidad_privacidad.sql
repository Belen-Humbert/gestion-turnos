CREATE TYPE "public"."community_status" AS ENUM('pending', 'changes', 'approved');--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"link" text,
	"status" "community_status" DEFAULT 'pending' NOT NULL,
	"moderator_note" text,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"author_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alias" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alias_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "use_forum" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "use_library" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "use_community" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_posts_status_idx" ON "community_posts" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "community_posts_author_idx" ON "community_posts" USING btree ("author_id","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_alias_key_unique" UNIQUE("alias_key");