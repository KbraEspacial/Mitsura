"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAreaSpending,
  getAreaHistory,
  getBudgetOverview,
  getUnmappedCategories,
  getCategoryMappings,
  createLifeArea,
  setAreaBudget,
  setMonthlyTotal,
  deleteLifeArea,
  assignCategory,
  type AreaSpending,
} from "@/lib/actions/areas";
import { currentMonthKey, monthLabel, shiftMonth } from "@/lib/finance-utils";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

/** Versión corta para tablas: 1.234.567 -> "1,23M" */
const compactCurrency = (amount: number) => {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",")}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
};

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

type Overview = Awaited<ReturnType<typeof getBudgetOverview>>;

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
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getAreaHistory>> | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  /** input del tope total; null mientras no se está editando */
  const [totalInput, setTotalInput] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [spending, overviewData, hist, unmappedCats, mappingsList] = await Promise.all([
      getAreaSpending(month),
      getBudgetOverview(month),
      getAreaHistory(6),
      getUnmappedCategories(),
      getCategoryMappings(),
    ]);
    setAreas(spending);
    setOverview(overviewData);
    setHistory(hist);
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

  const count = areas.filter((a) => a.monthlyBudget > 0).length;
  const overCount = areas.filter((a) => a.overBudget).length;

  function notify(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  /** Guarda el tope de gasto del mes. Vacío o 0 = sin tope. */
  async function saveTotal() {
    if (totalInput === null) return;
    const value = Number(totalInput.replace(/[^0-9.]/g, "")) || 0;
    setTotalInput(null);
    try {
      await setMonthlyTotal(month, value);
      notify(value > 0 ? `Tope de ${monthLabel(month)}: ${formatCurrency(value)}` : "Tope eliminado");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", "err");
    }
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

      {/* Resumen global: tope total del mes + reparto entre areas */}
      <div className="mb-6 rounded-xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Presupuesto total de {monthLabel(month)}
            </p>
            {totalInput === null ? (
              <button
                onClick={() =>
                  setTotalInput(overview && overview.plannedTotal > 0 ? String(overview.plannedTotal) : "")
                }
                className="group mt-1 flex items-center gap-2 text-left"
                title="Definir el tope de gasto del mes"
              >
                <span className="text-2xl font-bold text-foreground">
                  {overview && overview.plannedTotal > 0
                    ? formatCurrency(overview.plannedTotal)
                    : "Sin tope"}
                </span>
                <span className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  editar
                </span>
              </button>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <input
                  autoFocus
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTotal();
                    if (e.key === "Escape") setTotalInput(null);
                  }}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-40 rounded-lg border border-border bg-background px-2.5 py-1 text-2xl font-bold text-foreground outline-none focus:border-foreground/40"
                />
                <button
                  onClick={saveTotal}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setTotalInput(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            )}
            {overview && overview.plannedTotal > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {overview.unallocated > 0
                  ? `Faltan ${formatCurrency(overview.unallocated)} por repartir entre las áreas`
                  : overview.unallocated < 0
                    ? `Las áreas suman ${formatCurrency(Math.abs(overview.unallocated))} más que tu tope`
                    : "Todo el tope está repartido entre las áreas"}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">Gastado real</p>
            <p className="text-lg font-bold text-red-500">
              {formatCurrency(overview?.spentReal ?? 0)}
            </p>
            {overview && overview.unassignedSpent > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                incluye {formatCurrency(overview.unassignedSpent)} sin área asignada
              </p>
            )}
          </div>

          {overview && overview.plannedTotal > 0 ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {overview.remainingVsPlan >= 0 ? "Te queda" : "Te excediste"}
              </p>
              <p
                className={`text-lg font-bold ${
                  overview.remainingVsPlan >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500"
                }`}
              >
                {formatCurrency(Math.abs(overview.remainingVsPlan))}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {overview && overview.totalRemaining >= 0 ? "Te queda" : "Te excediste"}
              </p>
              <p
                className={`text-lg font-bold ${
                  overview && overview.totalRemaining >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500"
                }`}
              >
                {formatCurrency(Math.abs(overview?.totalRemaining ?? 0))}
              </p>
            </div>
          )}

          {overCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-400">
              {overCount} área(s) excedida(s)
            </span>
          )}
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              (overview?.planRatio ?? 0) > 1
                ? "bg-red-500"
                : (overview?.planRatio ?? 0) > 0.8
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            style={{
              width: `${Math.min(100, (overview?.planRatio ?? overview?.ratio ?? 0) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {overview && overview.plannedTotal > 0
            ? `${Math.round(overview.planRatio * 100)}% del tope de ${monthLabel(month)}`
            : count > 0
              ? `${Math.round((overview?.ratio ?? 0) * 100)}% de ${count} áreas con presupuesto (sin tope general)`
              : "Define un tope o ponle presupuesto a tus áreas"}
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

      {/* Resumen mensual por área */}
      <div className="mb-6 rounded-xl border border-border bg-background shadow-sm">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-semibold">Resumen mensual por área</h3>
            <p className="text-[11px] text-muted-foreground">
              Los últimos {history?.months.length ?? 0} meses, para ver qué áreas crecen y cuáles ya no gastas
            </p>
          </div>
          <span className="text-muted-foreground">{showHistory ? "−" : "+"}</span>
        </button>

        {showHistory && (
          <div className="border-t border-border px-5 py-4">
            {!history || history.areas.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Todavía no hay historial suficiente.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Área</th>
                      {history.months.map((m) => (
                        <th key={m} className="px-2 py-2 text-right font-medium">
                          {monthLabel(m).split(" ")[0]?.slice(0, 3)}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-medium">Promedio</th>
                      <th className="px-2 py-2 text-right font-medium">vs. presupuesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.areas.map((a) => {
                      const diff = a.monthlyBudget - a.average;
                      return (
                        <tr key={a.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3 text-foreground">
                            {a.emoji} {a.name}
                          </td>
                          {a.series.map((s) => {
                            const over = a.monthlyBudget > 0 && s.amount > a.monthlyBudget;
                            return (
                              <td
                                key={s.month}
                                className={`px-2 py-2 text-right ${
                                  s.amount === 0
                                    ? "text-muted-foreground/50"
                                    : over
                                      ? "text-red-500"
                                      : "text-foreground"
                                }`}
                              >
                                {s.amount === 0 ? "—" : compactCurrency(s.amount)}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-right text-muted-foreground">
                            {a.average > 0 ? compactCurrency(a.average) : "—"}
                          </td>
                          <td
                            className={`px-2 py-2 text-right ${
                              a.monthlyBudget <= 0
                                ? "text-muted-foreground"
                                : diff >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-500"
                            }`}
                          >
                            {a.monthlyBudget <= 0
                              ? "sin tope"
                              : `${diff >= 0 ? "−" : "+"}${compactCurrency(Math.abs(diff))}`}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-border font-medium">
                      <td className="py-2 pr-3 text-muted-foreground">Sin área</td>
                      {history.unassignedByMonth.map((u) => (
                        <td key={u.month} className="px-2 py-2 text-right text-amber-600 dark:text-amber-400">
                          {u.amount === 0 ? "—" : compactCurrency(u.amount)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {(() => {
                          const withS = history.unassignedByMonth.filter((u) => u.amount > 0);
                          if (withS.length === 0) return "—";
                          return compactCurrency(
                            withS.reduce((s, u) => s + u.amount, 0) / withS.length,
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  El promedio solo cuenta los meses en que sí gastaste, para que un mes sin gasto no te baje
                  la referencia. En rojo, el mes que pasó el presupuesto de esa área.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

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
