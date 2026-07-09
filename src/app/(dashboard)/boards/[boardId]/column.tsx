import { useDroppable } from "@dnd-kit/core";

export const COLUMN_COLORS = [
  { dot: "#3b82f6", border: "border-blue-400", bg: "bg-blue-50/50", shadow: "shadow-blue-200/50" },
  { dot: "#f59e0b", border: "border-amber-400", bg: "bg-amber-50/50", shadow: "shadow-amber-200/50" },
  { dot: "#10b981", border: "border-emerald-400", bg: "bg-emerald-50/50", shadow: "shadow-emerald-200/50" },
];

export function Column({
  column,
  tasks,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
  children,
}: {
  column: { id: string; title: string; order: number };
  tasks: { id: string }[];
  isFirst?: boolean;
  isLast?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const color = COLUMN_COLORS[column.order % COLUMN_COLORS.length]!;

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-72 flex-col rounded-xl border bg-muted/30 transition-all ${
        isOver ? `${color.border} ${color.bg} shadow-md ${color.shadow}` : "border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 border-b px-4 py-3.5">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: color.dot,
            boxShadow: `0 0 0 2px white, 0 0 0 3px ${color.dot}`,
          }}
        />
        {!isFirst && (
          <button onClick={onMoveLeft} className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="Mover izquierda">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {!isLast && (
          <button onClick={onMoveRight} className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="Mover derecha">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      {children}
    </div>
  );
}
