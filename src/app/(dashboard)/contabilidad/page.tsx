"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  getFinanceSummary,
  getMonthlySummary,
  getMonthlyRecords,
  getFinanceAdvice,
  type FinanceSummary,
  type MonthlySummary,
  type MonthlyDetail,
} from "@/lib/actions/finance";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

const CATEGORY_COLORS = [
  "#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#d946ef", "#e11d48", "#0ea5e9", "#65a30d",
];

export default function ContabilidadPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyDetail[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = JSON.parse(localStorage.getItem("dismissedAlerts") ?? "[]");
      return new Set<number>(stored);
    } catch {
      return new Set();
    }
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    getFinanceSummary().then((s) => {
      setSummary(s);
      getFinanceAdvice(s).then((r) => setAlerts(r.alertas));
    });
    getMonthlySummary().then(setMonthly);
    getMonthlyRecords().then(setMonthlyDetails);
  }, []);

  const monthData = monthlyDetails.find((m) => m.month === selectedMonth);

  const monthIncome = monthData ? monthData.income : 0;
  const monthExpenses = monthData ? monthData.expenses : 0;
  const monthBalance = monthData ? monthData.balance : 0;

  const monthCategories = useMemo(() => {
    const expenseRecords = monthData?.records.filter((r) => r.type === "expense") ?? [];
    const grouped = new Map<string, number>();
    for (const r of expenseRecords) {
      if (!r.category) continue;
      grouped.set(r.category, (grouped.get(r.category) ?? 0) + r.amount);
    }
    const total = [...grouped.values()].reduce((a, b) => a + b, 0);
    return [...grouped.entries()]
      .map(([category, amount]) => ({ category, amount, percentage: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthData]);

  const persistDismissed = (updated: Set<number>) => {
    localStorage.setItem("dismissedAlerts", JSON.stringify([...updated]));
  };

  const handleDismiss = (i: number) => {
    const updated = new Set(dismissedAlerts);
    updated.add(i);
    setDismissedAlerts(updated);
    persistDismissed(updated);
  };

  const handleDismissAll = () => {
    const allIndices = new Set(alerts.map((_, i) => i));
    setDismissedAlerts(allIndices);
    persistDismissed(allIndices);
  };

  const activeAlerts = alerts.filter((_, i) => !dismissedAlerts.has(i));

  if (!summary) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  const maxMonthly = Math.max(
    ...monthly.map((m) => Math.max(m.income, m.expenses)),
    1,
  );

  return (
    <div>
      {/* Notifications panel */}
      {notifOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setNotifOpen(false)}>
          <div
            className="fixed right-6 top-4 w-80 rounded-xl border border-border bg-background shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h4 className="text-sm font-semibold text-foreground">Notificaciones</h4>
              <div className="flex items-center gap-2">
                {activeAlerts.length > 0 && (
                  <button
                    onClick={handleDismissAll}
                    className="text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Descartar todo
                  </button>
                )}
                <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-4">
              {activeAlerts.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">Sin notificaciones</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {alerts.map((a, i) => {
                    if (dismissedAlerts.has(i)) return null;
                    return (
                      <div key={i} className="group relative rounded-lg bg-amber-50 px-3 py-2 pr-8 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {a}
                        <button
                          onClick={() => handleDismiss(i)}
                          className="absolute right-1.5 top-1.5 hidden rounded p-0.5 text-amber-400 hover:bg-amber-200 hover:text-amber-700 group-hover:block"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  <Link
                    href="/contabilidad/ia"
                    className="mt-1 text-center text-xs font-medium text-blue-600 hover:underline"
                    onClick={() => setNotifOpen(false)}
                  >
                    Ver análisis completo →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Title row with controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Resumen financiero</h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Notifications bell */}
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted/30"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {activeAlerts.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {activeAlerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ingresos · {new Date(selectedMonth + "-01").toLocaleDateString("es-ES", { month: "long", timeZone: "UTC" })}
            </p>
            <p className="mt-0.5 text-xl font-bold text-emerald-600">{formatCurrency(monthIncome)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 text-red-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Gastos · {new Date(selectedMonth + "-01").toLocaleDateString("es-ES", { month: "long", timeZone: "UTC" })}
            </p>
            <p className="mt-0.5 text-xl font-bold text-red-500">{formatCurrency(monthExpenses)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${summary.balance >= 0 ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-500"}`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Balance disponible
            </p>
            <p className={`mt-0.5 text-xl font-bold ${summary.balance >= 0 ? "text-blue-600" : "text-red-500"}`}>{formatCurrency(summary.balance)}</p>
            <p className={`mt-0.5 text-[11px] ${monthBalance >= 0 ? "text-emerald-600/70" : "text-red-500/70"}`}>
              Este mes: {formatCurrency(monthBalance)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deudas activas</p>
            <p className="mt-0.5 text-xl font-bold text-amber-600">{summary.activeDebtsCount}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              {formatCurrency(summary.totalDebtRemaining)} pendiente
            </p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Ingresos vs Gastos por Mes
          </h3>
          {monthly.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay registros mensuales aún</p>
          ) : (
            <div className="flex flex-col gap-5">
              {monthly.map((m) => {
                const iw = (m.income / maxMonthly) * 100;
                const ew = (m.expenses / maxMonthly) * 100;
                const isSelected = m.month === selectedMonth;
                return (
                  <div key={m.month} className={`rounded-lg p-2 transition-colors ${isSelected ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800" : ""}`}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                        <span className={`font-semibold ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>
                          {new Date(m.month + "-01").toLocaleDateString("es-ES", {
                            month: "short",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>
                      </div>
                      <span className={m.income - m.expenses >= 0 ? "font-medium text-emerald-600" : "font-medium text-red-500"}>
                        {formatCurrency(m.income - m.expenses)}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      <div className="flex-1">
                        <div className="relative h-6 w-full rounded-md bg-muted">
                          <div className="h-full rounded-md bg-emerald-400 transition-all" style={{ width: `${iw}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-emerald-600">{formatCurrency(m.income)}</p>
                      </div>
                      <div className="flex-1">
                        <div className="relative h-6 w-full rounded-md bg-muted">
                          <div className="h-full rounded-md bg-red-400 transition-all" style={{ width: `${ew}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-red-500">{formatCurrency(m.expenses)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Gastos del mes por Concepto
          </h3>
          {monthCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay gastos registrados aún</p>
          ) : (
            <div className="flex flex-col gap-3">
              {monthCategories.map((c, i) => {
                const maxCat = monthCategories[0]!.amount || 1;
                const w = (c.amount / maxCat) * 100;
                return (
                  <div key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                        />
                        <span className="font-medium text-foreground">{c.category}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatCurrency(c.amount)} <span className="text-muted-foreground/50">({c.percentage.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-5 w-full rounded-md bg-muted">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{ width: `${w}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/contabilidad/ingresos"
          className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30"
        >
          <p className="text-sm font-medium text-foreground">Gestionar ingresos</p>
          <p className="mt-1 text-xs text-muted-foreground">Añade y revisa tus ingresos</p>
        </Link>
        <Link
          href="/contabilidad/gastos"
          className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:bg-red-50/40 dark:hover:bg-red-950/30"
        >
          <p className="text-sm font-medium text-foreground">Gestionar gastos</p>
          <p className="mt-1 text-xs text-muted-foreground">Controla tus gastos diarios</p>
        </Link>
        <Link
          href="/contabilidad/gastos-fijos"
          className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/30"
        >
          <p className="text-sm font-medium text-foreground">Gastos fijos</p>
          <p className="mt-1 text-xs text-muted-foreground">Administra tus suscripciones y facturas</p>
        </Link>
        <Link
          href="/contabilidad/deudas"
          className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-950/30"
        >
          <p className="text-sm font-medium text-foreground">Deudas</p>
          <p className="mt-1 text-xs text-muted-foreground">Haz seguimiento de tus deudas</p>
        </Link>
        <Link
          href="/contabilidad/revision-mensual"
          className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30"
        >
          <p className="text-sm font-medium text-foreground">Revisión mensual</p>
          <p className="mt-1 text-xs text-muted-foreground">Ingresos y gastos detallados por mes</p>
        </Link>
        <Link
          href="/contabilidad/ia"
          className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:bg-purple-50/40 dark:hover:bg-purple-950/30"
        >
          <p className="text-sm font-medium text-foreground">Asistente IA</p>
          <p className="mt-1 text-xs text-muted-foreground">Recibe consejos financieros personalizados</p>
        </Link>
      </div>
    </div>
  );
}
