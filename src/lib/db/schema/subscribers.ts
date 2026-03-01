import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

export const subscriptionFrequencyEnum = pgEnum("subscription_frequency", [
  "weekly",
  "daily",
]);

export const emailSubscribers = pgTable(
  "email_subscribers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),

    /** Departamentos de interés — null = todos */
    departments: text("departments")
      .array()
      .$type<string[]>(),

    /** Tipos de evento de interés — null = todos */
    eventTypes: text("event_types")
      .array()
      .$type<string[]>(),

    frequency: subscriptionFrequencyEnum("frequency").default("weekly").notNull(),

    verified: boolean("verified").default(false).notNull(),
    verificationToken: varchar("verification_token", { length: 255 }).notNull(),
    unsubscribeToken: varchar("unsubscribe_token", { length: 255 }).notNull().unique(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("subscribers_email_idx").on(table.email),
    index("subscribers_verified_idx").on(table.verified),
    index("subscribers_frequency_idx").on(table.frequency),
  ],
);

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type NewEmailSubscriber = typeof emailSubscribers.$inferInsert;
