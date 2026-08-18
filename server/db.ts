import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  channelCategories,
  channelMembers,
  channels,
  InsertUser,
  messages,
  users,
} from "../drizzle/schema";
import { FIXED_CATEGORIES, getMissingFixedChannels } from "./fixed-rooms";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function ensureWorkspaceSeed() {
  const db = await getDb();
  if (!db) return;

  const existingCategories = await db.select().from(channelCategories).orderBy(asc(channelCategories.position));
  const existingCategoryNames = new Set(existingCategories.map(category => category.name));
  const categoriesToInsert = FIXED_CATEGORIES
    .filter(name => !existingCategoryNames.has(name))
    .map((name, index) => ({ name, position: existingCategories.length + index + 1 }));

  if (categoriesToInsert.length > 0) {
    await db.insert(channelCategories).values(categoriesToInsert);
  }

  const categories = await db.select().from(channelCategories).orderBy(asc(channelCategories.position));
  const categoryByName = new Map(categories.map(category => [category.name, category.id]));
  const categoryNameById = new Map(categories.map(category => [category.id, category.name]));
  const existingChannels = await db.select().from(channels);
  const channelsToInsert = getMissingFixedChannels(
    existingChannels.map(channel => ({ category: categoryNameById.get(channel.categoryId) ?? "", name: channel.name }))
  ).map(channel => ({
    categoryId: categoryByName.get(channel.category)!,
    name: channel.name,
    type: channel.type,
    position: channel.position,
  }));

  if (channelsToInsert.length > 0) {
    await db.insert(channels).values(channelsToInsert);
  }
}

export async function listWorkspace() {
  const db = await getDb();
  if (!db) return [];

  const [categories, channelRows] = await Promise.all([
    db.select().from(channelCategories).orderBy(asc(channelCategories.position), asc(channelCategories.name)),
    db.select().from(channels).orderBy(asc(channels.position), asc(channels.name)),
  ]);

  return categories.map(category => ({
    ...category,
    channels: channelRows.filter(channel => channel.categoryId === category.id),
  }));
}

export async function createWorkspaceCategory(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const lastCategory = await db
    .select({ position: channelCategories.position })
    .from(channelCategories)
    .orderBy(desc(channelCategories.position))
    .limit(1);

  await db.insert(channelCategories).values({
    name,
    position: (lastCategory[0]?.position ?? 0) + 1,
  });
}

export async function createWorkspaceChannel(input: {
  categoryId: number;
  name: string;
  type: "text" | "voice";
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const lastChannel = await db
    .select({ position: channels.position })
    .from(channels)
    .where(eq(channels.categoryId, input.categoryId))
    .orderBy(desc(channels.position))
    .limit(1);

  await db.insert(channels).values({
    ...input,
    position: (lastChannel[0]?.position ?? 0) + 1,
  });
}

export async function ensureChannelMembership(channelId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ id: channelMembers.id })
    .from(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(channelMembers).values({ channelId, userId });
}

export async function ensureWorkspaceMembership(userId: number) {
  const db = await getDb();
  if (!db) return;
  const channelRows = await db.select({ id: channels.id }).from(channels);
  await Promise.all(channelRows.map(channel => ensureChannelMembership(channel.id, userId)));
}

export async function listChannelMessages(channelId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      userId: messages.userId,
      content: messages.content,
      createdAt: messages.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(eq(messages.channelId, channelId))
    .orderBy(asc(messages.createdAt))
    .limit(200);
}

export async function createChannelMessage(input: {
  channelId: number;
  userId: number;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.insert(messages).values(input);
}
