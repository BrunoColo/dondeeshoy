ALTER TABLE "events"
	ADD COLUMN "department" varchar(100) DEFAULT 'Montevideo' NOT NULL;--> statement-breakpoint

UPDATE "events"
	SET "department" = COALESCE(NULLIF("city", ''), 'Montevideo');--> statement-breakpoint

CREATE INDEX "events_date_department_status_idx"
	ON "events" USING btree ("date", "department", "status");