CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "event_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"event_name" varchar(255) NOT NULL,
	"event_date" varchar(20) NOT NULL,
	"event_time" varchar(10),
	"event_type" "event_type" DEFAULT 'otro' NOT NULL,
	"description" text NOT NULL,
	"venue_name" varchar(255) NOT NULL,
	"venue_address" varchar(512) NOT NULL,
	"city" varchar(100) NOT NULL,
	"is_free" boolean DEFAULT true NOT NULL,
	"price_range" varchar(100),
	"ticket_url" varchar(2048),
	"image_url" varchar(2048),
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
