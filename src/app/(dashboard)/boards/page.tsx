import Link from "next/link";
import { getBoards } from "@/lib/actions/board";
import { NewBoardButton } from "./new-board-button";

export default async function BoardsPage() {
  const boards = await getBoards();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mis tableros</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona un tablero para empezar a trabajar
          </p>
        </div>
        <NewBoardButton />
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <p className="text-sm text-muted-foreground">Aún no tienes tableros</p>
          <p className="mt-1 text-xs text-muted-foreground">Crea tu primer tablero para empezar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <h3 className="font-medium">{board.title}</h3>
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span>{board._count.members + 1} miembros</span>
                <span>{board._count.tasks} tareas</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
