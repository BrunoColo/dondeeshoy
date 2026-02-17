CREATE TYPE "public"."event_status" AS ENUM('active', 'cancelled', 'past');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('fiesta', 'festival', 'concierto', 'recital', 'cultural', 'deportivo', 'gastronomico', 'familiar', 'feria', 'taller', 'club', 'bar', 'teatro', 'otro');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('redtickets', 'entraste', 'cartelera', 'mvd_eventos', 'cobraticket');--> statement-breakpoint
CREATE TABLE "event_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"source" "source" NOT NULL,
	"source_url" varchar(2048) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"venue_name" varchar(255) NOT NULL,
	"venue_address" varchar(512),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"city" varchar(100) DEFAULT 'Montevideo' NOT NULL,
	"event_type" "event_type" DEFAULT 'otro' NOT NULL,
	"music_genre" varchar(100),
	"image_url" varchar(2048),
	"ticket_url" varchar(2048),
	"price_min" integer,
	"price_max" integer,
	"currency" varchar(8) DEFAULT 'UYU' NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"age_restriction" integer,
	"confidence_score" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"status" "event_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_url" varchar(2048) NOT NULL,
	"raw_data" jsonb NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processing_error" text,
	CONSTRAINT "raw_events_source_source_id_unique" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"address" varchar(512) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"city" varchar(100) NOT NULL,
	"instagram_handle" varchar(100),
	"website" varchar(2048),
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_date_status_idx" ON "events" USING btree ("date","status");--> statement-breakpoint
CREATE INDEX "events_date_city_status_idx" ON "events" USING btree ("date","city","status");--> statement-breakpoint
CREATE INDEX "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_event_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");