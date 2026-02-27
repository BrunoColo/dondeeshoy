import { pgTable, text, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";
import { sourceEnum } from "./events";

/**
 * banned_events — events permanently blocked from re-appearing on the site.
 *
 * When an admin deletes an event, a row is inserted here with:
 *   - normalizedName: lowercase + accent-stripped event name (blocks by title)
 *   - source + sourceId: blocks the exact scraper record (prevents re-processing)
 *
 * The pipeline checks this table before creating/merging events.
 */
export const bannedEvents = pgTable(
  "banned_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Normalized (lowercase, accent-stripped) event name for fuzzy blocking */
    normalizedName: text("normalized_name").notNull(),
    /** Original event name for display in admin UI */
    originalName: varchar("original_name", { length: 255 }).notNull(),
    /** Scraper source — nullable because manually-submitted events have no source */
    source: sourceEnum("source"),
    /** Scraper source ID — nullable for the same reason */
    sourceId: varchar("source_id", { length: 255 }),
    /** Admin note / reason for banning (optional) */
    reason: text("reason"),
    bannedAt: timestamp("banned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("banned_events_normalized_name_idx").on(table.normalizedName),
    index("banned_events_source_source_id_idx").on(table.source, table.sourceId),
  ],
);

export type BannedEvent = typeof bannedEvents.$inferSelect;
export type NewBannedEvent = typeof bannedEvents.$inferInsert;
