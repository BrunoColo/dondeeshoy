import { decimal, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  address: varchar("address", { length: 512 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  website: varchar("website", { length: 2048 }),
});
