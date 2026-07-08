"use client";

import { useState } from "react";
import { createBoard } from "@/lib/actions/board";

export function NewBoardButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        + Nuevo tablero
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Nuevo tablero</h2>
            <form
              action={async (form) => {
                await createBoard(undefined, form);
                setOpen(false);
              }}
              className="flex flex-col gap-4"
            >
              <input
                name="title"
                placeholder="Nombre del tablero"
                required
                className="rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
