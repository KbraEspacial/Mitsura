import { getBoards } from "@/lib/actions/board";
import { getSession } from "@/lib/auth";
import { NewBoardButton } from "./new-board-button";
import { BoardCard } from "./board-card";

function groupByMonth(boards: Awaited<ReturnType<typeof getBoards>>) {
  const groups: Record<string, typeof boards> = {};
  for (const b of boards) {
    const key = `${b.createdAt.getFullYear()}-${String(b.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, items]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      }),
      items,
    }));
}

export default async function BoardsPage() {
  const session = await getSession();
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
        <div className="flex flex-col gap-8">
          {groupByMonth(boards).map((group) => (
            <div key={group.month}>
              <h2 className="mb-4 text-sm font-semibold capitalize text-muted-foreground">
                {group.label}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((board) => (
                  <BoardCard key={board.id} board={board} userId={session?.id ?? ""} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
