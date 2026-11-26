ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discharged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_key_unique" UNIQUE("phone_key");