import Link from "next/link";
import { getBoards } from "@/lib/actions/board";
import { NewBoardButton } from "./new-board-button";

const BOARD_COLORS = [
  { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
  { bg: "bg-violet-50", text: "text-violet-600", dot: "bg-violet-500" },
  { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
  { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-500" },
  { bg: "bg-cyan-50", text: "text-cyan-600", dot: "bg-cyan-500" },
];

function getBoardColor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BOARD_COLORS[Math.abs(hash) % BOARD_COLORS.length]!;
}

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
                {group.items.map((board) => {
                  const color = getBoardColor(board.title);
                  return (
                    <Link
                      key={board.id}
                      href={`/boards/${board.id}`}
                      className="rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color.bg}`}>
                          <span className={`text-sm font-bold ${color.text}`}>
                            {board.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">{board.title}</h3>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{board._count.members + 1} miembros</span>
                            <span className={`flex items-center gap-1`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${color.dot}`} />
                              {board._count.tasks} tareas
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
