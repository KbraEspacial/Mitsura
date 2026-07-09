"use client";

import { useState, useCallback, useMemo } from "react";
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
import { createTask, reorderTasks, archiveTask, restoreTask } from "@/lib/actions/task";
import { reorderColumns } from "@/lib/actions/board";
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
  archived?: boolean;
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
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!showArchived && t.archived) return false;
      if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assignee?.id !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, showArchived, searchText, priorityFilter, assigneeFilter]);

  const handleArchiveTask = async (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (t.archived) {
      await restoreTask(taskId);
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, archived: false } : x)));
    } else {
      await archiveTask(taskId);
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, archived: true } : x)));
    }
  };

  const handleMoveColumn = useCallback(async (colId: string, direction: "left" | "right") => {
    const cols = [...board.columns];
    const idx = cols.findIndex((c) => c.id === colId);
    if (idx === -1) return;
    const newIdx = direction === "left" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= cols.length) return;
    [cols[idx], cols[newIdx]] = [cols[newIdx]!, cols[idx]!];
    const reordered = cols.map((c, i) => ({ ...c, order: i }));
    board.columns = reordered;
    setTasks((prev) => prev.map((t) => {
      const col = reordered.find((c) => c.id === t.columnId);
      return col ? { ...t, statusOrder: col.order } : t;
    }));
    await reorderColumns(reordered.map((c) => ({ id: c.id, order: c.order })));
  }, [board]);

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

  const handleTaskModalDelete = async (taskId: string) => {
    await handleDeleteTask(taskId);
    setModalTask(null);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/boards" className="text-sm text-muted-foreground hover:text-foreground">
          Tableros
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{board.title}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2 shadow-sm">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar tareas..."
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Todas las prioridades</option>
          <option value="crítica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Todos los asignados</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.name}</option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={() => setShowArchived(!showArchived)}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Archivadas
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowMembers(true)}
            className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Miembros
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === "kanban"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("agile")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === "agile"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ágil
            </button>
          </div>

          {view === "kanban" && (
            <div className="flex items-center gap-0 rounded-lg border border-input">
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
                className="min-w-0 bg-background px-2.5 py-1.5 text-xs focus:outline-none"
              />
              <button
                onClick={handleAddTask}
                className="rounded-r-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background hover:opacity-90"
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
            {board.columns.map((column, idx) => {
              const columnTasks = filteredTasks
                .filter((t) => t.columnId === column.id)
                .sort((a, b) => a.order - b.order);

              return (
                <Column
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  isFirst={idx === 0}
                  isLast={idx === board.columns.length - 1}
                  onMoveLeft={() => handleMoveColumn(column.id, "left")}
                  onMoveRight={() => handleMoveColumn(column.id, "right")}
                >
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
        <AgileView columns={board.columns} tasks={filteredTasks} onTaskClick={(t) => setModalTask(t)} />
      )}

      {modalTask && (
        <TaskModal
          task={modalTask}
          members={members.map((m) => ({ id: m.userId, name: m.name, email: m.email }))}
          onClose={() => setModalTask(null)}
          onUpdate={handleUpdateTask}
          onArchive={handleArchiveTask}
          onDelete={handleTaskModalDelete}
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
