CREATE TYPE "public"."event_kind" AS ENUM('appointment', 'other');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "event_kind" NOT NULL,
	"patient_id" uuid,
	"title" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" text,
	"private_note" text,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"series_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_range_ok" CHECK ("events"."ends_at" > "events"."starts_at"),
	CONSTRAINT "events_kind_fields" CHECK (("events"."kind" = 'appointment' and "events"."patient_id" is not null) or ("events"."kind" = 'other' and "events"."title" is not null))
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "events_patient_idx" ON "events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "events_series_idx" ON "events" USING btree ("series_id");