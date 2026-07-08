import { notFound } from "next/navigation";
import { BoardKanban } from "./board-kanban";
import { getBoard } from "@/lib/actions/board";
import { getBoardMembers } from "@/lib/actions/task";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const board = await getBoard(boardId);
  if (!board) notFound();

  const members = await getBoardMembers(boardId);

  return (
    <BoardKanban
      board={{ id: board.id, title: board.title, columns: board.columns }}
      tasks={board.tasks.map((t) => {
        const col = board.columns.find((c) => c.id === t.columnId);
        return {
          ...t,
          dueDate: t.dueDate?.toISOString() ?? null,
          statusOrder: col?.order ?? 0,
          commentCount: t._count?.comments ?? 0,
        };
      })}
      members={members}
    />
  );
}
