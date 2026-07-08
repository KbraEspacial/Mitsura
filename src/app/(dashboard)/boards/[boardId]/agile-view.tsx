"use client";

import { PriorityBadge } from "./task-modal";

type ColumnDef = { id: string; title: string; order: number };
type TaskDef = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  order: number;
  columnId: string;
  assignee: { id: string; name: string; image?: string | null } | null;
  statusOrder: number;
  commentCount: number;
};

export function AgileView({
  columns,
  tasks,
  onTaskClick,
}: {
  columns: ColumnDef[];
  tasks: TaskDef[];
  onTaskClick: (task: TaskDef | null) => void;
}) {
  const columnMap = Object.fromEntries(columns.map((c) => [c.id, c.title]));

  const getStatusStyle = (status: string) => {
    const idx = columns.findIndex((c) => c.title === status);
    const colors = [
      "bg-blue-50 text-blue-700",
      "bg-amber-50 text-amber-700",
      "bg-green-50 text-green-700",
    ];
    return colors[idx % colors.length] ?? "bg-gray-50 text-gray-700";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/70 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="w-12 px-4 py-3.5 text-center">#</th>
            <th className="px-5 py-3.5">Tarea</th>
            <th className="px-5 py-3.5">Estado</th>
            <th className="px-5 py-3.5">Prioridad</th>
            <th className="px-5 py-3.5">Asignado</th>
            <th className="px-5 py-3.5">Fecha límite</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                No hay tareas en este tablero
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="cursor-pointer border-b last:border-0 transition-colors hover:bg-blue-50/40"
              >
                <td className="px-4 py-3.5 text-center text-xs font-medium text-muted-foreground">
                  {task.statusOrder + 1}
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-foreground">{task.title}</div>
                  {task.description && (
                    <div className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                      {task.description}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyle(columnMap[task.columnId] ?? "")}`}
                  >
                    {columnMap[task.columnId] ?? "—"}
                  </span>
                </td>
                <td className="px-5 py-3.5"><PriorityBadge priority={task.priority} /></td>
                <td className="px-5 py-3.5">
                  {task.assignee ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {task.assignee.image ? (
                        <img src={task.assignee.image} alt="" className="h-6 w-6 rounded-full" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {task.assignee.name}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/60">Sin asignar</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {task.dueDate ? (
                    <span className={new Date(task.dueDate) < new Date(new Date().toDateString()) ? "font-medium text-red-500" : ""}>
                      {new Date(task.dueDate).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/60">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
