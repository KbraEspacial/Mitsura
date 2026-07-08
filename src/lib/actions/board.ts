"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function getBoardList(): Promise<{ id: string; title: string }[]> {
  const session = await getSession();
  if (!session) return [];
  return db.board.findMany({
    where: {
      OR: [{ ownerId: session.id }, { members: { some: { userId: session.id } } }],
    },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function getBoards() {
  const session = await getSession();
  if (!session) return [];
  return db.board.findMany({
    where: {
      OR: [{ ownerId: session.id }, { members: { some: { userId: session.id } } }],
    },
    include: {
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getBoard(boardId: string) {
  const session = await getSession();
  if (!session) return null;
  const board = await db.board.findFirst({
    where: {
      id: boardId,
      OR: [{ ownerId: session.id }, { members: { some: { userId: session.id } } }],
    },
    include: {
      columns: { orderBy: { order: "asc" } },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, image: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  return board;
}

export async function createBoard(_prev: unknown, form: FormData) {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };

  const title = form.get("title") as string | null;
  if (!title?.trim()) return { error: "El título es obligatorio" };

  const board = await db.board.create({
    data: {
      title,
      ownerId: session.id,
      columns: {
        create: [
          { title: "Por hacer", order: 0 },
          { title: "En progreso", order: 1 },
          { title: "Hecho", order: 2 },
        ],
      },
    },
  });

  redirect(`/boards/${board.id}`);
}

export async function addBoardMember(boardId: string, email: string) {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };

  const board = await db.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (!board || board.ownerId !== session.id) return { error: "No tienes permisos" };

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: "Usuario no encontrado" };
  if (user.id === session.id) return { error: "Eres el dueño del tablero" };

  const existing = await db.boardMember.findUnique({
    where: { userId_boardId: { userId: user.id, boardId } },
  });
  if (existing) return { error: "El usuario ya es miembro" };

  await db.boardMember.create({ data: { userId: user.id, boardId } });
  return { success: true };
}

export async function removeBoardMember(boardId: string, memberRecordId: string) {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };

  const board = await db.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (!board || board.ownerId !== session.id) return { error: "No tienes permisos" };

  await db.boardMember.deleteMany({ where: { id: memberRecordId, boardId } });
  return { success: true };
}

export async function deleteBoard(boardId: string) {
  const session = await getSession();
  if (!session) return;
  await db.board.deleteMany({ where: { id: boardId, ownerId: session.id } });
  redirect("/boards");
}
