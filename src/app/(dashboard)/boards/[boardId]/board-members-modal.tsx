"use client";

import { useState } from "react";
import { addBoardMember, removeBoardMember } from "@/lib/actions/board";

type MemberInfo = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

export function BoardMembersModal({
  boardId,
  members,
  onClose,
  onUpdate,
}: {
  boardId: string;
  members: MemberInfo[];
  onClose: () => void;
  onUpdate: (members: MemberInfo[]) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = await addBoardMember(boardId, email.trim());
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    setEmail("");
    setBusy(false);
    const updated = await import("@/lib/actions/task").then((m) => m.getBoardMembers(boardId));
    onUpdate(updated);
  };

  const handleRemove = async (memberRecordId: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    await removeBoardMember(boardId, memberRecordId);
    const updated = await import("@/lib/actions/task").then((m) => m.getBoardMembers(boardId));
    onUpdate(updated);
    setBusy(false);
  };

  const isOwner = (role: string) => role === "OWNER";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-12 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Miembros del tablero</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email del usuario..."
              className="flex-1 rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Agregar
            </button>
          </form>
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <div
                key={m.memberId}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner(m.role) ? (
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Dueño</span>
                  ) : (
                    <button
                      onClick={() => handleRemove(m.memberId)}
                      disabled={busy}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t bg-muted/30 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Solo el dueño del tablero puede agregar o quitar miembros.
          </p>
        </div>
      </div>
    </div>
  );
}
