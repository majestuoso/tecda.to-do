import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db } from "@workspace/db";
import {
  cardsTable,
  cardAttachmentsTable,
  cardLinksTable,
  boardActivityTable,
} from "@workspace/db";
import {
  CreateCardParams,
  CreateCardBody,
  GetCardParams,
  UpdateCardParams,
  UpdateCardBody,
  DeleteCardParams,
  AddCardLinkParams,
  AddCardLinkBody,
  RemoveCardLinkParams,
  RemoveCardAttachmentParams,
  ListCardsParams,
} from "@workspace/api-zod";
import { getUserInfo } from "../lib/auth";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function logActivity(
  boardId: number,
  userId: string,
  action: string,
  cardId?: number,
  cardTitle?: string,
) {
  try {
    await db.insert(boardActivityTable).values({
      boardId,
      userId,
      action,
      cardId: cardId ?? null,
      cardTitle: cardTitle ?? null,
      detail: null,
    });
  } catch {}
}

// GET /boards/:boardId/cards
router.get("/boards/:boardId/cards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListCardsParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const cards = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.boardId, params.data.boardId))
    .orderBy(cardsTable.position, cardsTable.createdAt);

  const cardIds = cards.map((c) => c.id);
  if (cardIds.length === 0) {
    res.json([]);
    return;
  }

  const attCounts = await db
    .select({ cardId: cardAttachmentsTable.cardId, count: count() })
    .from(cardAttachmentsTable)
    .where(sql`${cardAttachmentsTable.cardId} = ANY(${sql.raw(`ARRAY[${cardIds.join(",")}]::integer[]`)})`)
    .groupBy(cardAttachmentsTable.cardId);

  const linkCounts = await db
    .select({ cardId: cardLinksTable.cardId, count: count() })
    .from(cardLinksTable)
    .where(sql`${cardLinksTable.cardId} = ANY(${sql.raw(`ARRAY[${cardIds.join(",")}]::integer[]`)})`)
    .groupBy(cardLinksTable.cardId);

  const attMap = new Map(attCounts.map((a) => [a.cardId, Number(a.count)]));
  const linkMap = new Map(linkCounts.map((l) => [l.cardId, Number(l.count)]));

  const result = await Promise.all(
    cards.map(async (c) => {
      let assigneeUsername: string | null = null;
      let assigneeImage: string | null = null;
      if (c.assigneeId) {
        try {
          const info = await getUserInfo(c.assigneeId);
          assigneeUsername = info?.username ?? null;
          assigneeImage = info?.profileImage ?? null;
        } catch {}
      }
      return {
        id: c.id,
        boardId: c.boardId,
        title: c.title,
        description: c.description ?? null,
        status: c.status,
        position: c.position,
        assigneeId: c.assigneeId ?? null,
        assigneeUsername,
        assigneeImage,
        dueDate: c.dueDate ?? null,
        attachmentCount: attMap.get(c.id) ?? 0,
        linkCount: linkMap.get(c.id) ?? 0,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

// POST /boards/:boardId/cards
router.post("/boards/:boardId/cards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = CreateCardParams.safeParse({ boardId: req.params.boardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [maxPos] = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${cardsTable.position}), -1)` })
    .from(cardsTable)
    .where(
      and(
        eq(cardsTable.boardId, params.data.boardId),
        eq(cardsTable.status, parsed.data.status ?? "todo"),
      ),
    );

  const [card] = await db
    .insert(cardsTable)
    .values({
      boardId: params.data.boardId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? "todo",
      position: (Number(maxPos.maxPos) ?? -1) + 1,
      assigneeId: parsed.data.assigneeId ?? null,
      dueDate: parsed.data.dueDate ?? null,
    })
    .returning();

  await logActivity(params.data.boardId, req.user.id, "created a card", card.id, card.title);

  res.status(201).json({
    id: card.id,
    boardId: card.boardId,
    title: card.title,
    description: card.description ?? null,
    status: card.status,
    position: card.position,
    assigneeId: card.assigneeId ?? null,
    assigneeUsername: null,
    assigneeImage: null,
    dueDate: card.dueDate ?? null,
    attachmentCount: 0,
    linkCount: 0,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  });
});

// GET /cards/:cardId
router.get("/cards/:cardId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetCardParams.safeParse({ cardId: req.params.cardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [card] = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.id, params.data.cardId));

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const attachments = await db
    .select()
    .from(cardAttachmentsTable)
    .where(eq(cardAttachmentsTable.cardId, card.id));

  const links = await db
    .select()
    .from(cardLinksTable)
    .where(eq(cardLinksTable.cardId, card.id));

  let assigneeUsername: string | null = null;
  let assigneeImage: string | null = null;
  if (card.assigneeId) {
    try {
      const info = await getUserInfo(card.assigneeId);
      assigneeUsername = info?.username ?? null;
      assigneeImage = info?.profileImage ?? null;
    } catch {}
  }

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "";

  res.json({
    id: card.id,
    boardId: card.boardId,
    title: card.title,
    description: card.description ?? null,
    status: card.status,
    position: card.position,
    assigneeId: card.assigneeId ?? null,
    assigneeUsername,
    assigneeImage,
    dueDate: card.dueDate ?? null,
    attachments: attachments.map((a) => ({
      id: a.id,
      cardId: a.cardId,
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      url: `${baseUrl}/api/attachments/${a.filename}`,
      createdAt: a.createdAt.toISOString(),
    })),
    links: links.map((l) => ({
      id: l.id,
      cardId: l.cardId,
      url: l.url,
      title: l.title ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  });
});

// PATCH /cards/:cardId
router.patch("/cards/:cardId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateCardParams.safeParse({ cardId: req.params.cardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.position !== undefined) updateData.position = parsed.data.position;
  if ("assigneeId" in parsed.data) updateData.assigneeId = parsed.data.assigneeId ?? null;
  if ("dueDate" in parsed.data) updateData.dueDate = parsed.data.dueDate ?? null;

  const [card] = await db
    .update(cardsTable)
    .set(updateData)
    .where(eq(cardsTable.id, params.data.cardId))
    .returning();

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  if (parsed.data.status) {
    await logActivity(card.boardId, req.user.id, `moved card to ${parsed.data.status}`, card.id, card.title);
  }

  let assigneeUsername: string | null = null;
  let assigneeImage: string | null = null;
  if (card.assigneeId) {
    try {
      const info = await getUserInfo(card.assigneeId);
      assigneeUsername = info?.username ?? null;
      assigneeImage = info?.profileImage ?? null;
    } catch {}
  }

  res.json({
    id: card.id,
    boardId: card.boardId,
    title: card.title,
    description: card.description ?? null,
    status: card.status,
    position: card.position,
    assigneeId: card.assigneeId ?? null,
    assigneeUsername,
    assigneeImage,
    dueDate: card.dueDate ?? null,
    attachmentCount: 0,
    linkCount: 0,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  });
});

// DELETE /cards/:cardId
router.delete("/cards/:cardId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteCardParams.safeParse({ cardId: req.params.cardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [card] = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.id, params.data.cardId));

  if (card) {
    await logActivity(card.boardId, req.user.id, "deleted a card", card.id, card.title);
  }

  await db.delete(cardsTable).where(eq(cardsTable.id, params.data.cardId));
  res.sendStatus(204);
});

// POST /cards/:cardId/links
router.post("/cards/:cardId/links", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = AddCardLinkParams.safeParse({ cardId: req.params.cardId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddCardLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [link] = await db
    .insert(cardLinksTable)
    .values({
      cardId: params.data.cardId,
      url: parsed.data.url,
      title: parsed.data.title ?? null,
    })
    .returning();

  res.status(201).json({
    id: link.id,
    cardId: link.cardId,
    url: link.url,
    title: link.title ?? null,
    createdAt: link.createdAt.toISOString(),
  });
});

// DELETE /cards/:cardId/links/:linkId
router.delete("/cards/:cardId/links/:linkId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = RemoveCardLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(cardLinksTable)
    .where(
      and(
        eq(cardLinksTable.id, params.data.linkId),
        eq(cardLinksTable.cardId, params.data.cardId),
      ),
    );

  res.sendStatus(204);
});

// POST /cards/:cardId/attachments — file upload (not generated)
router.post("/cards/:cardId/attachments", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawId = Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId;
  const cardId = parseInt(rawId, 10);
  if (isNaN(cardId)) {
    res.status(400).json({ error: "Invalid card ID" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const [attachment] = await db
    .insert(cardAttachmentsTable)
    .values({
      cardId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })
    .returning();

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "";

  res.status(201).json({
    id: attachment.id,
    cardId: attachment.cardId,
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: `${baseUrl}/api/attachments/${attachment.filename}`,
    createdAt: attachment.createdAt.toISOString(),
  });
});

// DELETE /cards/:cardId/attachments/:attachmentId
router.delete("/cards/:cardId/attachments/:attachmentId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = RemoveCardAttachmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [att] = await db
    .select()
    .from(cardAttachmentsTable)
    .where(
      and(
        eq(cardAttachmentsTable.id, params.data.attachmentId),
        eq(cardAttachmentsTable.cardId, params.data.cardId),
      ),
    );

  if (att) {
    const filePath = path.join(uploadsDir, att.filename);
    try { fs.unlinkSync(filePath); } catch {}
    await db.delete(cardAttachmentsTable).where(eq(cardAttachmentsTable.id, att.id));
  }

  res.sendStatus(204);
});

// Serve uploaded files
router.get("/attachments/:filename", (req, res): void => {
  const rawFilename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const safeName = path.basename(rawFilename);
  const filePath = path.join(uploadsDir, safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.sendFile(filePath);
});

export default router;
