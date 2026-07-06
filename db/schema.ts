import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  relation: text("relation").notNull(),
  parentId: integer("parent_id"),
  isAlive: boolean("is_alive").notNull().default(true),
});
