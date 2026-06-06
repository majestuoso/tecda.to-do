import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { boardsTable } from "./boards";

export const cardsTable = pgTable("cards", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("todo"),
  position: integer("position").notNull().default(0),
  assigneeId: text("assignee_id"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCardSchema = createInsertSchema(cardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;

export const cardAttachmentsTable = pgTable("card_attachments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cardsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCardAttachmentSchema = createInsertSchema(cardAttachmentsTable).omit({ id: true, createdAt: true });
export type InsertCardAttachment = z.infer<typeof insertCardAttachmentSchema>;
export type CardAttachment = typeof cardAttachmentsTable.$inferSelect;

export const cardLinksTable = pgTable("card_links", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cardsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCardLinkSchema = createInsertSchema(cardLinksTable).omit({ id: true, createdAt: true });
export type InsertCardLink = z.infer<typeof insertCardLinkSchema>;
export type CardLink = typeof cardLinksTable.$inferSelect;
