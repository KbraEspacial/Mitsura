import { useDroppable } from "@dnd-kit/core";

const COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

export function Column({
  column,
  tasks,
  children,
}: {
  column: { id: string; title: string; order: number };
  tasks: { id: string }[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-72 flex-col rounded-xl border bg-muted/30 transition-all ${
        isOver
          ? "border-blue-400 bg-blue-50/50 shadow-md shadow-blue-200/50"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: COLORS[column.order % COLORS.length],
            boxShadow: `0 0 0 2px white, 0 0 0 3px ${COLORS[column.order % COLORS.length]}`,
          }}
        />
        <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      {children}
    </div>
  );
}
