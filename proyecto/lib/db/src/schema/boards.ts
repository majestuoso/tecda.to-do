import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boardsTable = pgTable("boards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }).notNull().default("#4F46E5"),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBoardSchema = createInsertSchema(boardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boardsTable.$inferSelect;

export const boardMembersTable = pgTable("board_members", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: varchar("role", { length: 32 }).notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBoardMemberSchema = createInsertSchema(boardMembersTable).omit({ id: true, joinedAt: true });
export type InsertBoardMember = z.infer<typeof insertBoardMemberSchema>;
export type BoardMember = typeof boardMembersTable.$inferSelect;

export const boardInvitationsTable = pgTable("board_invitations", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  invitedUserId: text("invited_user_id").notNull(),
  invitedByUserId: text("invited_by_user_id").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBoardInvitationSchema = createInsertSchema(boardInvitationsTable).omit({ id: true, createdAt: true });
export type InsertBoardInvitation = z.infer<typeof insertBoardInvitationSchema>;
export type BoardInvitation = typeof boardInvitationsTable.$inferSelect;

export const boardActivityTable = pgTable("board_activity", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  cardId: integer("card_id"),
  cardTitle: text("card_title"),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBoardActivitySchema = createInsertSchema(boardActivityTable).omit({ id: true, createdAt: true });
export type InsertBoardActivity = z.infer<typeof insertBoardActivitySchema>;
export type BoardActivity = typeof boardActivityTable.$inferSelect;
