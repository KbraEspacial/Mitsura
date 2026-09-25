"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAreaSpending,
  getUnmappedCategories,
  getCategoryMappings,
  createLifeArea,
  setAreaBudget,
  deleteLifeArea,
  assignCategory,
  type AreaSpending,
} from "@/lib/actions/areas";
import { currentMonthKey, monthLabel, shiftMonth } from "@/lib/finance-utils";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

/** Paleta segura para Tailwind (clases completas, no dinámicas). */
const BAR_TONES: Record<string, string> = {
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  lime: "bg-lime-500",
  cyan: "bg-cyan-500",
  slate: "bg-slate-500",
};

const EMOJI_CHOICES = ["🍔", "🚌", "🏠", "💡", "🏥", "🎬", "💼", "🎓", "🏦", "📱", "🤝", "📦", "🐾", "🎁"];

type Mappings = Record<string, string>;

export default function AreasPage() {
  const [areas, setAreas] = useState<AreaSpending[]>([]);
  const [unmapped, setUnmapped] = useState<{ category: string; amount: number }[]>([]);
  const [mappings, setMappings] = useState<Mappings>({});
  const [month, setMonth] = useState(currentMonthKey());
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [newArea, setNewArea] = useState({ name: "", emoji: "🍔", budget: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async () => {
    const [spending, unmappedCats, mappingsList] = await Promise.all([
      getAreaSpending(month),
      getUnmappedCategories(),
      getCategoryMappings(),
    ]);
    setAreas(spending);
    setUnmapped(unmappedCats);
    setMappings(
      mappingsList.reduce<Mappings>((acc, m) => {
        acc[m.category.toLowerCase()] = m.areaId;
        return acc;
      }, {}),
    );
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const overview = getBudgetOverviewLocal(areas);

  function getBudgetOverviewLocal(list: AreaSpending[]) {
    const withBudget = list.filter((a) => a.monthlyBudget > 0);
    const totalBudget = withBudget.reduce((s, a) => s + a.monthlyBudget, 0);
    const totalSpent = withBudget.reduce((s, a) => s + a.spent, 0);
    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      ratio: totalBudget > 0 ? totalSpent / totalBudget : 0,
      count: withBudget.length,
      overCount: withBudget.filter((a) => a.overBudget).length,
    };
  }

  function notify(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  async function saveBudget(area: AreaSpending) {
    const raw = editing[area.id];
    if (raw === undefined) return;
    const value = Number(raw.replace(/[^0-9.]/g, "")) || 0;
    setEditing((p) => {
      const next = { ...p };
      delete next[area.id];
      return next;
    });
    try {
      await setAreaBudget(area.id, value);
      notify(`Presupuesto de ${area.name}: ${formatCurrency(value)}`);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", "err");
    }
  }

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newArea.name.trim()) return notify("Ponle un nombre al área", "err");
    setSaving(true);
    try {
      await createLifeArea({
        name: newArea.name,
        emoji: newArea.emoji,
        monthlyBudget: Number(newArea.budget.replace(/[^0-9.]/g, "")) || 0,
      });
      setNewArea({ name: "", emoji: "🍔", budget: "" });
      notify("Área creada");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", "err");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteArea(id: string, name: string) {
    if (!confirm(`¿Eliminar el área "${name}"? Las categorías asignadas quedarán sin área.`)) return;
    await deleteLifeArea(id);
    notify("Área eliminada");
    await load();
  }

  async function handleAssign(category: string, areaId: string) {
    try {
      await assignCategory(category, areaId || null);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", "err");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Presupuestos por área</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Organiza tus gastos por áreas de la vida y ponle un límite mensual a cada una.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            ‹
          </button>
          <span className="min-w-[130px] text-center text-xs font-medium">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            ›
          </button>
        </div>
      </div>

      {/* Resumen global */}
      <div className="mb-6 rounded-xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Presupuesto total
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatCurrency(overview.totalBudget)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Gastado</p>
            <p className="text-lg font-bold text-red-500">{formatCurrency(overview.totalSpent)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {overview.totalRemaining >= 0 ? "Te queda" : "Te excediste"}
            </p>
            <p
              className={`text-lg font-bold ${
                overview.totalRemaining >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500"
              }`}
            >
              {formatCurrency(Math.abs(overview.totalRemaining))}
            </p>
          </div>
          {overview.overCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-400">
              {overview.overCount} área(s) excedida(s)
            </span>
          )}
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              overview.ratio > 1 ? "bg-red-500" : overview.ratio > 0.8 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, overview.ratio * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {overview.count > 0
            ? `${Math.round(overview.ratio * 100)}% de ${overview.count} áreas con presupuesto`
            : "Todavía no definiste presupuestos"}
        </p>
      </div>

      {/* Tarjetas de áreas */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border px-5 py-10 text-center text-xs text-muted-foreground">
            Crea tu primera área de vida abajo para empezar a organising tus presupuestos.
          </p>
        )}
        {areas.map((area) => {
          const pct = Math.min(100, area.ratio * 100);
          const tone = BAR_TONES[area.color ?? "emerald"] ?? BAR_TONES.emerald;
          return (
            <div
              key={area.id}
              className={`flex flex-col rounded-xl border bg-background p-5 shadow-sm ${
                area.overBudget ? "border-red-300 dark:border-red-500/40" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span aria-hidden>{area.emoji ?? "•"}</span>
                    <span className="truncate">{area.name}</span>
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatCurrency(area.spent)} gastado
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteArea(area.id, area.name)}
                  className="shrink-0 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-red-500"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3">
                {area.monthlyBudget > 0 ? (
                  <>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${area.overBudget ? "bg-red-500" : tone}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {Math.round(area.ratio * 100)}% de {formatCurrency(area.monthlyBudget)}
                      </span>
                      <span
                        className={
                          area.overBudget
                            ? "font-medium text-red-500"
                            : "font-medium text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {area.overBudget
                          ? `+${formatCurrency(area.spent - area.monthlyBudget)}`
                          : `-${formatCurrency(area.remaining)}`}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Sin presupuesto definido</p>
                )}
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Presupuesto"
                  value={editing[area.id] ?? (area.monthlyBudget > 0 ? String(area.monthlyBudget) : "")}
                  onChange={(e) => setEditing((p) => ({ ...p, [area.id]: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                />
                <button
                  onClick={() => saveBudget(area)}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Guardar
                </button>
              </div>

              {area.categories.length > 0 && (
                <div className="mt-3 border-t border-border pt-2.5">
                  {area.categories.slice(0, 3).map((c) => (
                    <div key={c.category} className="flex justify-between py-0.5 text-[11px]">
                      <span className="truncate text-muted-foreground">{c.category}</span>
                      <span className="ml-2 shrink-0 text-foreground">{formatCurrency(c.amount)}</span>
                    </div>
                  ))}
                  {area.categories.length > 3 && (
                    <p className="pt-0.5 text-[10px] text-muted-foreground/70">
                      +{area.categories.length - 3} categoría(s) más
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nueva área */}
      <form
        onSubmit={handleCreateArea}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4 shadow-sm"
      >
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Área</label>
          <input
            type="text"
            value={newArea.name}
            onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
            placeholder="Mascotas"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Emoji</label>
          <select
            value={newArea.emoji}
            onChange={(e) => setNewArea({ ...newArea, emoji: e.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            {EMOJI_CHOICES.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
            Presupuesto mensual
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={newArea.budget}
            onChange={(e) => setNewArea({ ...newArea, budget: e.target.value })}
            placeholder="500000"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          Crear área
        </button>
      </form>

      {/* Mapeo de categorías */}
      <div className="rounded-xl border border-border bg-background shadow-sm">
        <button
          onClick={() => setShowMap((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-semibold">Organizar categorías</h3>
            <p className="text-[11px] text-muted-foreground">
              {unmapped.length > 0
                ? `${unmapped.length} categoría(s) sin área asignada`
                : "Todas tus categorías tienen área"}
            </p>
          </div>
          <span className="text-muted-foreground">{showMap ? "−" : "+"}</span>
        </button>
        {showMap && (
          <div className="border-t border-border px-5 py-4">
            {unmapped.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No hay categorías pendientes.
              </p>
            ) : (
              <ul className="space-y-2">
                {unmapped.map((u) => (
                  <li key={u.category} className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {u.category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatCurrency(u.amount)} histórico
                    </span>
                    <select
                      value={mappings[u.category.toLowerCase()] ?? ""}
                      onChange={(e) => handleAssign(u.category, e.target.value)}
                      className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-blue-400"
                    >
                      <option value="">Sin área</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.emoji} {a.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}

            {Object.keys(mappings).length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                  Categorías ya asignadas
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {Object.entries(mappings).map(([cat, areaId]) => {
                    const area = areas.find((a) => a.id === areaId);
                    return (
                      <li
                        key={cat}
                        className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground"
                      >
                        {area?.emoji} {cat}
                        <button
                          onClick={() => handleAssign(cat, "")}
                          className="text-muted-foreground transition-colors hover:text-red-500"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-xs font-medium text-white shadow-lg ${
            toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
