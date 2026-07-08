"use client";

import { useState, useEffect } from "react";
import { updateTask, getComments, addComment, type CommentInfo } from "@/lib/actions/task";

type Member = { id: string; name: string; email: string };

type TaskData = {
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

const PRIORITIES = ["crítica", "alta", "media", "baja"];
const PRIORITY_COLORS: Record<string, string> = {
  crítica: "bg-red-100 text-red-700 border-red-200 ring-red-400",
  alta: "bg-orange-100 text-orange-700 border-orange-200 ring-orange-400",
  media: "bg-blue-100 text-blue-700 border-blue-200 ring-blue-400",
  baja: "bg-gray-100 text-gray-600 border-gray-200 ring-gray-400",
};

export function TaskModal({
  task,
  members,
  onClose,
  onUpdate,
}: {
  task: TaskData;
  members: Member[];
  onClose: () => void;
  onUpdate: (t: TaskData) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? "");
  const [comments, setComments] = useState<CommentInfo[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    getComments(task.id).then((data) => {
      setComments(data);
      setLoadingComments(false);
    });
  }, [task.id]);

  const handleSave = async () => {
    const updated = await updateTask(task.id, {
      title: title.trim() || task.title,
      description: description.trim() || null,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeId: assigneeId || null,
    });
    onUpdate({
      ...task,
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      dueDate: updated.dueDate?.toISOString() ?? null,
      assignee: updated.assigneeId
        ? members.find((m) => m.id === updated.assigneeId) ?? null
        : null,
    });
    onClose();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const comment = await addComment(task.id, newComment);
    setComments((prev) => [...prev, comment]);
    setNewComment("");
    onUpdate({ ...task, commentCount: task.commentCount + 1 });
  };

  const formatDate = (d: Date) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "ahora";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-12 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-2xl gap-0 rounded-xl border border-border bg-white shadow-xl">
        <div className="flex-1">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Detalle de tarea</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Agrega una descripción..."
                className="w-full rounded-lg border border-input px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Prioridad
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fecha límite
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Asignado a
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex w-80 flex-col border-l border-border">
          <div className="border-b px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Comentarios ({comments.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {loadingComments ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin comentarios</p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      {c.author.image ? (
                        <img src={c.author.image} alt="" className="h-5 w-5 rounded-full" />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-700">
                          {c.author.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="text-xs font-medium text-foreground">{c.author.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground" title={new Date(c.createdAt).toLocaleString("es-ES")}>
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-foreground/80 whitespace-pre-wrap">{c.content}</p>
                    {c.updatedAt.getTime() !== c.createdAt.getTime() && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        Editado {formatDate(c.updatedAt)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder="Escribe un comentario..."
                className="min-w-0 flex-1 rounded-lg border border-input px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 right-12 flex gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-input bg-white px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors shadow-lg"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity shadow-lg"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {priority}
    </span>
  );
}
