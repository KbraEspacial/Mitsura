"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createTask, reorderTasks } from "@/lib/actions/task";
import { Column } from "./column";
import { TaskCard } from "./task-card";
import { TaskModal } from "./task-modal";
import { AgileView } from "./agile-view";
import { BoardMembersModal } from "./board-members-modal";

type Member = { memberId: string; userId: string; name: string; email: string; role: string };
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

export function BoardKanban({
  board,
  tasks: initialTasks,
  members: initialMembers,
}: {
  board: { id: string; title: string; columns: ColumnDef[] };
  tasks: TaskDef[];
  members: Member[];
}) {
  const [tasks, setTasks] = useState<TaskDef[]>(initialTasks);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [view, setView] = useState<"kanban" | "agile">("kanban");
  const [activeTask, setActiveTask] = useState<TaskDef | null>(null);
  const [modalTask, setModalTask] = useState<TaskDef | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    let newColumnId: string;
    let targetTasks: TaskDef[];

    const overTask = tasks.find((t) => t.id === over.id);

    if (overTask) {
      newColumnId = overTask.columnId;
      targetTasks = tasks
        .filter((t) => t.columnId === newColumnId && t.id !== active.id);
      const overIndex = targetTasks.findIndex((t) => t.id === over.id);
      targetTasks.splice(overIndex >= 0 ? overIndex : targetTasks.length, 0, {
        ...draggedTask,
        columnId: newColumnId,
      });
    } else {
      const overColumn = board.columns.find((c) => c.id === over.id);
      if (!overColumn) return;
      newColumnId = overColumn.id;
      targetTasks = tasks.filter((t) => t.columnId === newColumnId);
      targetTasks.push({ ...draggedTask, columnId: newColumnId });
    }

    const reordered = targetTasks.map((t, i) => ({ ...t, order: i }));
    const withoutDragged = tasks.filter((t) => t.id !== draggedTask.id);
    const finalTasks = [
      ...withoutDragged.filter((t) => t.columnId !== newColumnId),
      ...reordered,
    ];

    setTasks(finalTasks);
    await reorderTasks(
      finalTasks.map((t) => ({ id: t.id, order: t.order, columnId: t.columnId }))
    );
  }, [tasks, board.columns]);

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const firstColumn = board.columns[0];
    if (!firstColumn) return;
    setNewTaskTitle("");
    const task = await createTask(board.id, firstColumn.id, title);
    setTasks((prev) => [
      ...prev,
      { ...task, description: null, priority: "media", dueDate: null, assignee: null, statusOrder: 0, commentCount: 0, order: prev.filter((t) => t.columnId === firstColumn.id).length },
    ]);
  };

  const handleUpdateTask = (updated: TaskDef) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { deleteTask } = await import("@/lib/actions/task");
    await deleteTask(id);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/boards" className="text-sm text-muted-foreground hover:text-foreground">
          Tableros
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{board.title}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowMembers(true)}
            className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Miembros
          </button>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "kanban"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("agile")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "agile"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ágil
            </button>
          </div>

          {view === "kanban" && (
            <div className="flex items-center gap-2 rounded-lg border border-input pl-3">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
                placeholder="Nueva tarea..."
                className="min-w-0 py-1.5 text-sm focus:outline-none"
              />
              <button
                onClick={handleAddTask}
                className="rounded-r-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
              >
                + Agregar
              </button>
            </div>
          )}
        </div>
      </div>

      {view === "kanban" ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {board.columns.map((column) => {
              const columnTasks = tasks
                .filter((t) => t.columnId === column.id)
                .sort((a, b) => a.order - b.order);

              return (
                <Column key={column.id} column={column} tasks={columnTasks}>
                  <SortableContext
                    items={columnTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2 p-3">
                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={(t) => setModalTask(t)}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </Column>
              );
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rounded-lg border bg-white p-3 text-sm shadow-xl">
                {activeTask.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <AgileView columns={board.columns} tasks={tasks} onTaskClick={(t) => setModalTask(t)} />
      )}

      {modalTask && (
        <TaskModal
          task={modalTask}
          members={members.map((m) => ({ id: m.userId, name: m.name, email: m.email }))}
          onClose={() => setModalTask(null)}
          onUpdate={handleUpdateTask}
        />
      )}

      {showMembers && (
        <BoardMembersModal
          boardId={board.id}
          members={members}
          onClose={() => setShowMembers(false)}
          onUpdate={(updated) => setMembers(updated)}
        />
      )}
    </div>
  );
}
