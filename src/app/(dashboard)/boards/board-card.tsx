"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteBoard, leaveBoard } from "@/lib/actions/board";
import { useRouter } from "next/navigation";

type BoardItem = {
  id: string;
  title: string;
  color: string;
  ownerId: string;
  _count: { tasks: number; members: number };
};

export function BoardCard({ board, userId }: { board: BoardItem; userId: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "leave" | null>(null);
  const router = useRouter();
  const isOwner = board.ownerId === userId;

  const handleDelete = async () => {
    await deleteBoard(board.id);
    setConfirmAction(null);
    router.refresh();
  };

  const handleLeave = async () => {
    const result = await leaveBoard(board.id);
    setConfirmAction(null);
    if (result.success) router.refresh();
  };

  return (
    <div className="group relative rounded-xl border bg-background p-5 shadow-sm transition-all hover:shadow-md">
      <Link href={`/boards/${board.id}`} className="block">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: board.color }}
          >
            <span className="text-sm font-bold">
              {board.title.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium truncate">{board.title}</h3>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{board._count.members + 1} miembros</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: board.color }} />
                {board._count.tasks} tareas
              </span>
            </div>
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-3 top-10 z-50 w-44 rounded-lg border border-border bg-background shadow-lg">
            {isOwner ? (
              <button
                onClick={() => { setMenuOpen(false); setConfirmAction("delete"); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-500 transition-colors hover:bg-red-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar tablero
              </button>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); setConfirmAction("leave"); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-amber-600 transition-colors hover:bg-amber-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Salir del tablero
              </button>
            )}
          </div>
        </>
      )}

      {confirmAction === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground">Eliminar tablero</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Estás seguro? Se eliminarán todas las tareas, comentarios y miembros asociados. Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction === "leave" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground">Salir del tablero</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tus tareas asignadas serán reasignadas al dueño del tablero. Puedes volver a unirte si el dueño te agrega de nuevo.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLeave}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
