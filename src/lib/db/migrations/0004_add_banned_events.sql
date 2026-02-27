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
CREATE INDEX "banned_events_normalized_name_idx" ON "banned_events" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "banned_events_source_source_id_idx" ON "banned_events" USING btree ("source","source_id");
