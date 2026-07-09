"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBoardList } from "@/lib/actions/board";
import { logout } from "@/lib/actions/auth";
import ThemeToggle from "@/components/theme-toggle";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
  calendarConnected?: boolean;
};

type BoardItem = {
  id: string;
  title: string;
  color: string;
};

export default function Sidebar({ sessionUser }: { sessionUser: SessionUser }) {
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    getBoardList().then(setBoards);
  }, [pathname]);

  const isOnBoard = pathname.startsWith("/boards/") && pathname !== "/boards";

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-background shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-lg font-bold tracking-tight text-foreground">Mitsura</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <Link
          href="/boards"
          className="flex items-center gap-2.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
          </svg>
          Mis tableros
        </Link>

        {boards.length > 0 && (
          <div className="mt-2 flex flex-col gap-0.5">
            {boards.map((board) => {
              const isActive = pathname === `/boards/${board.id}`;
              return (
                <Link
                  key={board.id}
                  href={`/boards/${board.id}`}
                  className={`ml-1 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: board.color }}
                  />
                  <span className="truncate">{board.title}</span>
                  {isActive && (
                    <span
                      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: board.color }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {isOnBoard && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="ml-1 mt-1 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
          </button>
        )}

        <div className="my-2 border-t border-border" />

        <Link
          href="/contabilidad"
          className="flex items-center gap-2.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Contabilidad
        </Link>
      </nav>

      <div className="border-t border-border p-3">
        <ThemeToggle />
        <div className="mb-2 mt-1 flex items-center gap-2.5 px-1">
          {sessionUser.image ? (
            <img src={sessionUser.image} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
              {sessionUser.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{sessionUser.name}</p>
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs text-muted-foreground">{sessionUser.email}</p>
              {sessionUser.calendarConnected && (
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Calendar conectado" />
              )}
            </div>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
