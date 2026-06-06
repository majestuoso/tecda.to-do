import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  boardsTable,
  boardMembersTable,
  boardInvitationsTable,
  boardActivityTable,
  cardsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateBoardBody,
  UpdateBoardBody,
  UpdateBoardParams,
  GetBoardParams,
  DeleteBoardParams,
  GetBoardStatsParams,
  GetBoardActivityParams,
  ListBoardMembersParams,
  RemoveBoardMemberParams,
  InviteMemberParams,
  InviteMemberBody,
  ListMyInvitationsResponse,
  AcceptInvitationParams,
  DeclineInvitationParams,
} from "@workspace/api-zod";
import { getUserInfo } from "../lib/auth";

const router: IRouter = Router();

async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const info = await getUserInfo(userId);
    return info?.username ?? info?.firstName ?? userId.slice(0, 8);
  } catch {
    return userId.slice(0, 8);
  }
}

async function logActivity(
  boardId: number,
  userId: string,
  action: string,
  cardId?: number,
  cardTitle?: string,
  detail?: string,
) {
  try {
    await db.insert(boardActivityTable).values({
      boardId,
      userId,
      action,
      cardId: cardId ?? null,
      cardTitle: cardTitle ?? null,
      detail: detail ?? null,
    });
  } catch {
    // non-critical
  }
}

// GET /boards
router.get("/boards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const memberships = await db
    .select({
      boardId: boardMembersTable.boardId,
      role: boardMembersTable.role,
    })
    .from(boardMembersTable)
    .where(eq(boardMembersTable.userId, req.user.id));

  if (memberships.length === 0) {
    res.json([]);
    return;
  }

  const boardIds = memberships.map((m) => m.boardId);
  const roleMap = new Map(memberships.map((m) => [m.boardId, m.role]));

  const boards = await db
    .select()
    .from(boardsTable)
    .where(sql`${boardsTable.id} = ANY(${sql.raw(`ARRAY[${boardIds.join(",")}]::integer[]`)})`);

  const memberCounts = await db
    .select({
      boardId: boardMembersTable.boardId,
      count: count(),
    })
    .from(boardMembersTable)
    .where(sql`${boardMembersTable.boardId} = ANY(${sql.raw(`ARRAY[${boardIds.join(",")}]::integer[]`)})`)
    .groupBy(boardMembersTable.boardId);

  const cardCounts = await db
    .select({
      boardId: cardsTable.boardId,
      count: count(),
    })
    .from(cardsTable)
    .where(sql`${cardsTable.boardId} = ANY(${sql.raw(`ARRAY[${boardIds.join(",")}]::integer[]`)})`)
    .groupBy(cardsTable.boardId);

  const memberCountMap = new Map(memberCounts.map((m) => [m.boardId, Number(m.count)]));
  const cardCountMap = new Map(cardCounts.map((c) => [c.boardId, Number(c.count)]));

  const result = boards.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description ?? null,
    color: b.color,
    memberCount: memberCountMap.get(b.id) ?? 0,
    cardCount: cardCountMap.get(b.id) ?? 0,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    role: roleMap.get(b.id) ?? "member",
  }));

  res.json(result);
});

// POST /boards
router.post("/boards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateBoardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [board] = await db
    .insert(boardsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? "#4F46E5",
      ownerId: req.user.id,
    })
    .returning();

  // Add owner as admin member
  await db.insert(boardMembersTable).values({
    boardId: board.id,
    userId: req.user.id,
    role: "admin",
  });

  await logActivity(board.id, req.user.id, "created the board");

  res.status(201).json({
    id: board.id,
    name: board.name,
    description: board.description ?? null,
    color: board.color,
    ownerId: board.ownerId,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    cards: [],
    members: [],
  });
});

// GET /boards/:boardId
router.get("/boards/:boardId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetBoardParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, params.data.boardId));

  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  // Check membership
  const [membership] = await db
    .select()
    .from(boardMembersTable)
    .where(
      and(
        eq(boardMembersTable.boardId, board.id),
        eq(boardMembersTable.userId, req.user.id),
      ),
    );

  if (!membership) {
    res.status(403).json({ error: "Not a board member" });
    return;
  }

  const cards = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.boardId, board.id))
    .orderBy(cardsTable.position, cardsTable.createdAt);

  const members = await db
    .select()
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, board.id));

  // Get user info for members
  const memberList = await Promise.all(
    members.map(async (m) => {
      let info: Awaited<ReturnType<typeof getUserInfo>> = null;
      try {
        info = await getUserInfo(m.userId);
      } catch {}
      return {
        id: m.id,
        boardId: m.boardId,
        userId: m.userId,
        username: info?.username ?? null,
        firstName: info?.firstName ?? null,
        lastName: info?.lastName ?? null,
        profileImage: info?.profileImage ?? null,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      };
    }),
  );

  const cardList = cards.map((c) => ({
    id: c.id,
    boardId: c.boardId,
    title: c.title,
    description: c.description ?? null,
    status: c.status,
    position: c.position,
    assigneeId: c.assigneeId ?? null,
    assigneeUsername: null,
    assigneeImage: null,
    dueDate: c.dueDate ?? null,
    attachmentCount: 0,
    linkCount: 0,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  res.json({
    id: board.id,
    name: board.name,
    description: board.description ?? null,
    color: board.color,
    ownerId: board.ownerId,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    cards: cardList,
    members: memberList,
  });
});

// PATCH /boards/:boardId
router.patch("/boards/:boardId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateBoardParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBoardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [board] = await db
    .update(boardsTable)
    .set({
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.color && { color: parsed.data.color }),
    })
    .where(eq(boardsTable.id, params.data.boardId))
    .returning();

  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  res.json({
    id: board.id,
    name: board.name,
    description: board.description ?? null,
    color: board.color,
    ownerId: board.ownerId,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    cards: [],
    members: [],
  });
});

// DELETE /boards/:boardId
router.delete("/boards/:boardId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteBoardParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(boardsTable).where(eq(boardsTable.id, params.data.boardId));
  res.sendStatus(204);
});

// GET /boards/:boardId/stats
router.get("/boards/:boardId/stats", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetBoardStatsParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const boardId = params.data.boardId;

  const cardStats = await db
    .select({
      status: cardsTable.status,
      count: count(),
    })
    .from(cardsTable)
    .where(eq(cardsTable.boardId, boardId))
    .groupBy(cardsTable.status);

  const memberCount = await db
    .select({ count: count() })
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, boardId));

  const statMap = new Map(cardStats.map((s) => [s.status, Number(s.count)]));

  res.json({
    boardId,
    todoCount: statMap.get("todo") ?? 0,
    inProgressCount: statMap.get("in_progress") ?? 0,
    doneCount: statMap.get("done") ?? 0,
    totalCards: cardStats.reduce((sum, s) => sum + Number(s.count), 0),
    memberCount: Number(memberCount[0]?.count ?? 0),
  });
});

// GET /boards/:boardId/activity
router.get("/boards/:boardId/activity", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetBoardActivityParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const events = await db
    .select()
    .from(boardActivityTable)
    .where(eq(boardActivityTable.boardId, params.data.boardId))
    .orderBy(sql`${boardActivityTable.createdAt} DESC`)
    .limit(20);

  const result = await Promise.all(
    events.map(async (e) => {
      let displayName = e.userId.slice(0, 8);
      try {
        const info = await getUserInfo(e.userId);
        displayName = info?.username ?? info?.firstName ?? displayName;
      } catch {}
      return {
        id: e.id,
        boardId: e.boardId,
        cardId: e.cardId ?? null,
        cardTitle: e.cardTitle ?? null,
        userId: e.userId,
        userDisplayName: displayName,
        action: e.action,
        detail: e.detail ?? null,
        createdAt: e.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

// GET /boards/:boardId/members
router.get("/boards/:boardId/members", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListBoardMembersParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const members = await db
    .select()
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, params.data.boardId));

  const result = await Promise.all(
    members.map(async (m) => {
      let info: Awaited<ReturnType<typeof getUserInfo>> = null;
      try { info = await getUserInfo(m.userId); } catch {}
      return {
        id: m.id,
        boardId: m.boardId,
        userId: m.userId,
        username: info?.username ?? null,
        firstName: info?.firstName ?? null,
        lastName: info?.lastName ?? null,
        profileImage: info?.profileImage ?? null,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

// DELETE /boards/:boardId/members/:userId
router.delete("/boards/:boardId/members/:userId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = RemoveBoardMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(boardMembersTable)
    .where(
      and(
        eq(boardMembersTable.boardId, params.data.boardId),
        eq(boardMembersTable.userId, params.data.userId),
      ),
    );

  res.sendStatus(204);
});

// POST /boards/:boardId/invitations
router.post("/boards/:boardId/invitations", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = InviteMemberParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = InviteMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check current member count (max 20)
  const [memberCount] = await db
    .select({ count: count() })
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, params.data.boardId));

  if (Number(memberCount.count) >= 20) {
    res.status(400).json({ error: "Board has reached maximum of 20 members" });
    return;
  }

  // Find user by username in users table
  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username));

  if (!targetUser) {
    res.status(404).json({ error: "User not found. They must have logged in at least once." });
    return;
  }

  // Check not already a member
  const [existing] = await db
    .select()
    .from(boardMembersTable)
    .where(
      and(
        eq(boardMembersTable.boardId, params.data.boardId),
        eq(boardMembersTable.userId, targetUser.id),
      ),
    );

  if (existing) {
    res.status(400).json({ error: "User is already a board member" });
    return;
  }

  // Check no pending invite
  const [existingInvite] = await db
    .select()
    .from(boardInvitationsTable)
    .where(
      and(
        eq(boardInvitationsTable.boardId, params.data.boardId),
        eq(boardInvitationsTable.invitedUserId, targetUser.id),
        eq(boardInvitationsTable.status, "pending"),
      ),
    );

  if (existingInvite) {
    res.status(400).json({ error: "User already has a pending invitation" });
    return;
  }

  const [board] = await db
    .select({ name: boardsTable.name })
    .from(boardsTable)
    .where(eq(boardsTable.id, params.data.boardId));

  const [invitation] = await db
    .insert(boardInvitationsTable)
    .values({
      boardId: params.data.boardId,
      invitedUserId: targetUser.id,
      invitedByUserId: req.user.id,
      status: "pending",
    })
    .returning();

  const inviterInfo = await getUserInfo(req.user.id).catch(() => null);

  res.status(201).json({
    id: invitation.id,
    boardId: invitation.boardId,
    boardName: board?.name ?? "",
    invitedByUsername: inviterInfo?.username ?? null,
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
  });
});

// GET /invitations
router.get("/invitations", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const invitations = await db
    .select({
      id: boardInvitationsTable.id,
      boardId: boardInvitationsTable.boardId,
      boardName: boardsTable.name,
      invitedByUserId: boardInvitationsTable.invitedByUserId,
      status: boardInvitationsTable.status,
      createdAt: boardInvitationsTable.createdAt,
    })
    .from(boardInvitationsTable)
    .innerJoin(boardsTable, eq(boardInvitationsTable.boardId, boardsTable.id))
    .where(
      and(
        eq(boardInvitationsTable.invitedUserId, req.user.id),
        eq(boardInvitationsTable.status, "pending"),
      ),
    );

  const result = await Promise.all(
    invitations.map(async (inv) => {
      let inviterInfo: Awaited<ReturnType<typeof getUserInfo>> = null;
      try { inviterInfo = await getUserInfo(inv.invitedByUserId); } catch {}
      return {
        id: inv.id,
        boardId: inv.boardId,
        boardName: inv.boardName,
        invitedByUsername: inviterInfo?.username ?? null,
        status: inv.status,
        createdAt: inv.createdAt.toISOString(),
      };
    }),
  );

  res.json(ListMyInvitationsResponse.parse(result));
});

// POST /invitations/:invitationId/accept
router.post("/invitations/:invitationId/accept", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = AcceptInvitationParams.safeParse({ invitationId: req.params.invitationId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [invitation] = await db
    .select()
    .from(boardInvitationsTable)
    .where(
      and(
        eq(boardInvitationsTable.id, params.data.invitationId),
        eq(boardInvitationsTable.invitedUserId, req.user.id),
      ),
    );

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  await db
    .update(boardInvitationsTable)
    .set({ status: "accepted" })
    .where(eq(boardInvitationsTable.id, invitation.id));

  const [member] = await db
    .insert(boardMembersTable)
    .values({
      boardId: invitation.boardId,
      userId: req.user.id,
      role: "member",
    })
    .returning();

  await logActivity(invitation.boardId, req.user.id, "joined the board");

  let info: Awaited<ReturnType<typeof getUserInfo>> = null;
  try { info = await getUserInfo(member.userId); } catch {}

  res.json({
    id: member.id,
    boardId: member.boardId,
    userId: member.userId,
    username: info?.username ?? null,
    firstName: info?.firstName ?? null,
    lastName: info?.lastName ?? null,
    profileImage: info?.profileImage ?? null,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  });
});

// POST /invitations/:invitationId/decline
router.post("/invitations/:invitationId/decline", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeclineInvitationParams.safeParse({ invitationId: req.params.invitationId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .update(boardInvitationsTable)
    .set({ status: "declined" })
    .where(
      and(
        eq(boardInvitationsTable.id, params.data.invitationId),
        eq(boardInvitationsTable.invitedUserId, req.user.id),
      ),
    );

  res.sendStatus(204);
});

export default router;
