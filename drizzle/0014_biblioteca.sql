CREATE TABLE "library_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"cover_key" text NOT NULL,
	"cover_content_type" text NOT NULL,
	"lent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_books_cover_key_unique" UNIQUE("cover_key")
);
--> statement-breakpoint
CREATE TABLE "library_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"admin_seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "library_comments" ADD CONSTRAINT "library_comments_book_id_library_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."library_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_comments" ADD CONSTRAINT "library_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_comments" ADD CONSTRAINT "library_comments_parent_id_library_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."library_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_books_created_idx" ON "library_books" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "library_comments_book_idx" ON "library_comments" USING btree ("book_id","created_at");--> statement-breakpoint
CREATE INDEX "library_comments_user_idx" ON "library_comments" USING btree ("user_id","created_at");