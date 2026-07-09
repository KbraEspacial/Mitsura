"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export type ActivityInfo = {
  id: string;
  action: string;
  message: string;
  createdAt: Date;
  user: { name: string; image: string | null };
  board: { id: string; title: string };
};

export async function createActivity(
  boardId: string,
  userId: string,
  action: string,
  message: string,
) {
  try {
    await db.activity.create({ data: { boardId, userId, action, message } });
  } catch {
    // fail silently — activity logging should never break the main flow
  }
}

export async function getRecentActivities(): Promise<ActivityInfo[]> {
  const session = await getSession();
  if (!session) return [];

  const sharedBoards = await db.board.findMany({
    where: {
      OR: [
        { ownerId: session.id, members: { some: {} } },
        { members: { some: { userId: session.id } } },
      ],
    },
    select: { id: true },
  });

  if (sharedBoards.length === 0) return [];

  const activities = await db.activity.findMany({
    where: { boardId: { in: sharedBoards.map((b) => b.id) } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: { select: { name: true, image: true } },
      board: { select: { id: true, title: true } },
    },
  });

  return activities;
}
