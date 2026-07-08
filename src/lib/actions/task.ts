"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function syncTaskWithCalendar(
  task: { id: string; title: string; description?: string | null; dueDate?: Date | null; googleEventId?: string | null },
  userId: string,
) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { googleAccessToken: true, googleCalendarConnected: true } });
  if (!user?.googleAccessToken || !user.googleCalendarConnected) return;

  try {
    const {
      createCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
    } = await import("@/lib/google");

    if (task.dueDate && !task.googleEventId) {
      const eventId = await createCalendarEvent(user.googleAccessToken, task as { id: string; title: string; description?: string | null; dueDate: Date });
      await db.task.update({ where: { id: task.id }, data: { googleEventId: eventId } });
    } else if (task.dueDate && task.googleEventId) {
      await updateCalendarEvent(user.googleAccessToken, task.googleEventId, task as { title: string; description?: string | null; dueDate: Date });
    } else if (!task.dueDate && task.googleEventId) {
      await deleteCalendarEvent(user.googleAccessToken, task.googleEventId);
      await db.task.update({ where: { id: task.id }, data: { googleEventId: null } });
    }
  } catch {
    // Token expired or API error — desconectar Calendar
    await db.user.update({ where: { id: userId }, data: { googleCalendarConnected: false } });
  }
}

export type MemberInfo = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

export async function getBoardMembers(boardId: string): Promise<MemberInfo[]> {
  const session = await getSession();
  if (!session) return [];
  const members = await db.boardMember.findMany({
    where: { boardId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, owner: { select: { id: true, name: true, email: true } } },
  });
  if (!board) return [];
  return [
    { memberId: board.ownerId, userId: board.owner.id, name: board.owner.name, email: board.owner.email, role: "OWNER" },
    ...members.map((m) => ({
      memberId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  ];
}

export async function createTask(boardId: string, columnId: string, title: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const maxOrder = await db.task.aggregate({ where: { columnId }, _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  return db.task.create({
    data: { title, boardId, columnId, order },
  });
}

export async function updateTask(
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    priority?: string;
    dueDate?: Date | null;
    assigneeId?: string | null;
  },
) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const task = await db.task.update({ where: { id: taskId }, data });

  if (data.dueDate !== undefined) {
    await syncTaskWithCalendar(task, session.id);
  }

  return task;
}

export async function updateTaskPosition(
  taskId: string,
  newColumnId: string,
  newOrder: number,
) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");
  return db.task.update({
    where: { id: taskId },
    data: { columnId: newColumnId, order: newOrder },
  });
}

export async function reorderTasks(tasks: { id: string; order: number; columnId: string }[]) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const tx = tasks.map((t) =>
    db.task.update({ where: { id: t.id }, data: { order: t.order, columnId: t.columnId } })
  );
  await db.$transaction(tx);
}

export async function deleteTask(taskId: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const task = await db.task.findUnique({ where: { id: taskId }, select: { googleEventId: true } });
  if (task?.googleEventId) {
    const user = await db.user.findUnique({ where: { id: session.id }, select: { googleAccessToken: true } });
    if (user?.googleAccessToken) {
      try {
        const { deleteCalendarEvent } = await import("@/lib/google");
        await deleteCalendarEvent(user.googleAccessToken, task.googleEventId);
      } catch {
        // token expired, ignore
      }
    }
  }

  await db.task.delete({ where: { id: taskId } });
}

export type CommentInfo = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string; image: string | null };
};

export async function getComments(taskId: string): Promise<CommentInfo[]> {
  const session = await getSession();
  if (!session) return [];
  return db.comment.findMany({
    where: { taskId },
    include: { author: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addComment(taskId: string, content: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");
  if (!content.trim()) throw new Error("El comentario no puede estar vacío");

  return db.comment.create({
    data: { content: content.trim(), taskId, authorId: session.id },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
}

export async function updateComment(commentId: string, content: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");
  if (!content.trim()) throw new Error("El comentario no puede estar vacío");

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.authorId !== session.id) throw new Error("No autorizado");

  return db.comment.update({
    where: { id: commentId },
    data: { content: content.trim() },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
}

export async function deleteComment(commentId: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.authorId !== session.id) throw new Error("No autorizado");

  await db.comment.delete({ where: { id: commentId } });
}
