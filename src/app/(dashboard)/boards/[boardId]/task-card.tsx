"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PriorityBadge } from "./task-modal";

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

export function TaskCard({
  task,
  onClick,
  onDelete,
}: {
  task: TaskDef;
  onClick: (t: TaskDef | null) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const overdue =
    task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
  const dueLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="group cursor-grab rounded-lg border border-border bg-white text-sm shadow-sm transition-all hover:shadow-md hover:border-blue-200 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2 p-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground leading-snug">{task.title}</p>
          {task.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          title="Eliminar tarea"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
        <span className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
          #{task.statusOrder + 1}
        </span>
        <PriorityBadge priority={task.priority} />
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {task.commentCount}
          </span>
        )}
        {task.assignee && (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
            {task.assignee.image ? (
              <img src={task.assignee.image} alt="" className="h-3.5 w-3.5 rounded-full" />
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
            {task.assignee.name.split(" ")[0]}
          </span>
        )}
        {dueLabel && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
              overdue
                ? "bg-red-50 text-red-600"
                : "bg-gray-50 text-muted-foreground"
            }`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {dueLabel}
          </span>
        )}
      </div>
    </div>
  );
}
