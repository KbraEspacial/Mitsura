"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getIncomeSources,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
  toggleIncomeSource,
  generateIncomeForMonth,
  generateAllIncomeForMonth,
  getIncomePlanSummary,
  type IncomeSourceInfo,
  type PaydayInfo,
} from "@/lib/actions/income";
import { frequencyLabel, paydaySummaryText } from "@/lib/income-plan";
import { currentMonthKey, monthLabel, shiftMonth } from "@/lib/finance-utils";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

const formatDay = (d: Date) =>
  d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });

type Form = {
  name: string;
  amount: string;
  frequency: "monthly" | "biweekly" | "weekly";
  dayOfMonth: string;
  secondDay: string;
  category: string;
};

const emptyForm = (): Form => ({
  name: "",
  amount: "",
  frequency: "biweekly",
  dayOfMonth: "15",
  secondDay: "30",
  category: "Nómina",
});

export default function SueldoPage() {
  const [sources, setSources] = useState<IncomeSourceInfo[]>([]);
  const [paydays, setPaydays] = useState<PaydayInfo[]>([]);
  const [month, setMonth] = useState(currentMonthKey());
  const [form, setForm] = useState<Form>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const load = useCallback(async () => {
    const [srcs, plan] = await Promise.all([
      getIncomeSources(),
      getIncomePlanSummary(month),
    ]);
    setSources(srcs);
    setPaydays(plan.paydays);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const expected = paydays.reduce((s, p) => s + p.amount, 0);
  const received = paydays.filter((p) => p.generated).reduce((s, p) => s + p.amount, 0);
  const pending = expected - received;
  const allGenerated = paydays.length > 0 && paydays.every((p) => p.generated);

  function notify(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount.replace(/[^0-9.]/g, ""));
    if (!form.name.trim()) return notify("Ponle un nombre al sueldo", "err");
    if (!amount || amount <= 0) return notify("El monto debe ser mayor que cero", "err");

    setSaving(true);
    try {
      const data = {
        name: form.name,
        amount,
        frequency: form.frequency,
        dayOfMonth: Number(form.dayOfMonth) || 1,
        secondDay: form.frequency === "biweekly" ? Number(form.secondDay) || 30 : null,
        category: form.category,
      };
      if (editingId) {
        await updateIncomeSource(editingId, data);
        notify("Sueldo actualizado");
      } else {
        await createIncomeSource(data);
        notify("Sueldo agregado");
      }
      setForm(emptyForm());
      setEditingId(null);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo guardar", "err");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: IncomeSourceInfo) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      amount: String(s.amount),
      frequency: s.frequency as Form["frequency"],
      dayOfMonth: String(s.dayOfMonth),
      secondDay: String(s.secondDay ?? 30),
      category: s.category ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleGenerate(sourceId: string) {
    setBusy(sourceId);
    try {
      const r = await generateIncomeForMonth(sourceId, month);
      notify(
        r.created > 0
          ? `Se registraron ${r.created} de ${r.total} cobros del mes`
          : "Ya estaban registrados los cobros de este mes",
      );
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", "err");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateAll() {
    setBusy("all");
    try {
      const r = await generateAllIncomeForMonth(month);
      notify(
        r.created > 0
          ? `${r.created} ingreso(s) nuevo(s) de ${r.sources} fuente(s)`
          : "Todo el mes ya estaba generado",
      );
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", "err");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    await deleteIncomeSource(id);
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm());
    }
    notify("Sueldo eliminado");
    await load();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurador de sueldo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Programa cuándo entra tu plata y genera los ingresos del mes con un clic.
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
          {month !== currentMonthKey() && (
            <button
              onClick={() => setMonth(currentMonthKey())}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Estado del mes */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Esperado
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(expected)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            {paydays.length} cobro(s) programados
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ya registrado
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(received)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            {expected > 0 ? Math.round((received / expected) * 100) : 0}% del mes
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pendiente
          </p>
          <p className={`mt-1 text-xl font-bold ${pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {formatCurrency(pending)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            {allGenerated ? "Mes completo" : "Faltan registros"}
          </p>
        </div>
      </div>

      {/* Calendario de cobros */}
      <div className="mb-6 rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Cobros de {monthLabel(month)}</h3>
          <button
            onClick={handleGenerateAll}
            disabled={busy === "all" || sources.length === 0}
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            {busy === "all" ? "Generando..." : "Generar mes completo"}
          </button>
        </div>
        {paydays.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-muted-foreground">
            Configura tu sueldo abajo para ver aquí los días de cobro.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {paydays.map((p) => (
              <li key={`${p.sourceId}-${p.date.getTime()}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    p.generated
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : p.isPast
                        ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                  }`}
                >
                  {p.date.getDate()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.sourceName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDay(p.date)}
                    {p.isPast && !p.generated && " · pasó y no está registrado"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(p.amount)}
                </span>
                {p.generated ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    Registrado
                  </span>
                ) : (
                  <button
                    onClick={() => handleGenerate(p.sourceId)}
                    disabled={busy === p.sourceId}
                    className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    {busy === p.sourceId ? "..." : "Registrar"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4 shadow-sm"
      >
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
            Nombre
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Quincena"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
            Monto
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="1300000"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
            Frecuencia
          </label>
          <select
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as Form["frequency"] })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
            Día 1
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={form.dayOfMonth}
            onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>
        {form.frequency === "biweekly" && (
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
              Día 2
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={form.secondDay}
              onChange={(e) => setForm({ ...form, secondDay: e.target.value })}
              className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
            Categoría
          </label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Nómina"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {editingId ? "Guardar cambios" : "Agregar"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm());
            }}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancelar
          </button>
        )}
      </form>

      {/* Fuentes configuradas */}
      <div className="rounded-xl border border-border bg-background shadow-sm">
        <h3 className="border-b border-border px-5 py-4 text-sm font-semibold">
          Fuentes de ingreso ({sources.length})
        </h3>
        {sources.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-muted-foreground">
            Todavía no configuraste ningún sueldo.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {frequencyLabel(s.frequency)}
                    </span>
                    {!s.isActive && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        pausado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {paydaySummaryText(s)} · {s.category ?? "Nómina"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">
                  {formatCurrency(s.amount)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleIncomeSource(s.id, !s.isActive)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {s.isActive ? "Pausar" : "Activar"}
                  </button>
                  <button
                    onClick={() => startEdit(s)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
