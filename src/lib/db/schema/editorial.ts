import {
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const editorialConfigs = pgTable(
  "editorial_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 120 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("editorial_configs_key_unique").on(table.key),
    index("editorial_configs_updated_at_idx").on(table.updatedAt),
  ],
);

export type EditorialConfig = typeof editorialConfigs.$inferSelect;
export type NewEditorialConfig = typeof editorialConfigs.$inferInsert;