CREATE TYPE "public"."subscription_frequency" AS ENUM('weekly', 'daily');--> statement-breakpoint
CREATE TABLE "banned_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_name" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"source" "source",
	"source_id" varchar(255),
	"reason" text,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"departments" text[],
	"event_types" text[],
	"frequency" "subscription_frequency" DEFAULT 'weekly' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_token" varchar(255) NOT NULL,
	"unsubscribe_token" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "email_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE INDEX "banned_events_normalized_name_idx" ON "banned_events" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "banned_events_source_source_id_idx" ON "banned_events" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "subscribers_email_idx" ON "email_subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "subscribers_verified_idx" ON "email_subscribers" USING btree ("verified");--> statement-breakpoint
CREATE INDEX "subscribers_frequency_idx" ON "email_subscribers" USING btree ("frequency");