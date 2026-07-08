"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getFinanceSummary,
  getMonthlySummary,
  getMonthlyRecords,
  getExpensesByCategory,
  type FinanceSummary,
  type MonthlySummary,
  type MonthlyDetail,
  type CategoryBreakdown,
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
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyDetail[]>([]);
  const [queryMonth, setQueryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [queryResult, setQueryResult] = useState<{ income: number; expenses: number; balance: number } | null>(null);

  useEffect(() => {
    getFinanceSummary().then(setSummary);
    getMonthlySummary().then(setMonthly);
    getMonthlyRecords().then(setMonthlyDetails);
    getExpensesByCategory().then(setCategories);
  }, []);

  useEffect(() => {
    const detail = monthlyDetails.find((m) => m.month === queryMonth);
    if (detail) {
      setQueryResult({ income: detail.income, expenses: detail.expenses, balance: detail.balance });
    } else {
      setQueryResult({ income: 0, expenses: 0, balance: 0 });
    }
  }, [queryMonth, monthlyDetails]);

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
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Resumen financiero</h2>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ingresos</p>
            <p className="mt-0.5 text-xl font-bold text-emerald-600">{formatCurrency(summary.totalIncome)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 text-red-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gastos</p>
            <p className="mt-0.5 text-xl font-bold text-red-500">{formatCurrency(summary.totalExpenses)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${summary.balance >= 0 ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-500"}`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Balance</p>
            <p className={`mt-0.5 text-xl font-bold ${summary.balance >= 0 ? "text-blue-600" : "text-red-500"}`}>{formatCurrency(summary.balance)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deudas</p>
            <p className="mt-0.5 text-xl font-bold text-amber-600">{summary.activeDebtsCount}</p>
          </div>
        </div>
        {/* Month query card */}
        <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm ring-1 ring-blue-100">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
              {queryMonth
                ? new Date(queryMonth + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric" })
                : "Consulta por mes"}
            </p>
            <input
              type="month"
              value={queryMonth}
              onChange={(e) => setQueryMonth(e.target.value)}
              className="w-36 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-blue-100 pt-3 text-center text-xs">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Ingresos</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-600">{formatCurrency(queryResult?.income ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-red-500">Gastos</p>
              <p className="mt-0.5 text-sm font-bold text-red-500">{formatCurrency(queryResult?.expenses ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Balance</p>
              <p className={`mt-0.5 text-sm font-bold ${(queryResult?.balance ?? 0) >= 0 ? "text-blue-600" : "text-red-500"}`}>
                {formatCurrency(queryResult?.balance ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
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
                return (
                  <div key={m.month}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {new Date(m.month + "-01").toLocaleDateString("es-ES", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className={m.income - m.expenses >= 0 ? "font-medium text-emerald-600" : "font-medium text-red-500"}>
                        {formatCurrency(m.income - m.expenses)}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      <div className="flex-1">
                        <div className="relative h-6 w-full rounded-md bg-gray-100">
                          <div className="h-full rounded-md bg-emerald-400 transition-all" style={{ width: `${iw}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-emerald-600">{formatCurrency(m.income)}</p>
                      </div>
                      <div className="flex-1">
                        <div className="relative h-6 w-full rounded-md bg-gray-100">
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

        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Gastos por Concepto
          </h3>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay gastos registrados aún</p>
          ) : (
            <div className="flex flex-col gap-3">
              {categories.map((c, i) => {
                const maxCat = categories[0]!.amount || 1;
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
                    <div className="h-5 w-full rounded-md bg-gray-100">
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
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-emerald-50/40"
        >
          <p className="text-sm font-medium text-foreground">Gestionar ingresos</p>
          <p className="mt-1 text-xs text-muted-foreground">Añade y revisa tus ingresos</p>
        </Link>
        <Link
          href="/contabilidad/gastos"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-red-50/40"
        >
          <p className="text-sm font-medium text-foreground">Gestionar gastos</p>
          <p className="mt-1 text-xs text-muted-foreground">Controla tus gastos diarios</p>
        </Link>
        <Link
          href="/contabilidad/gastos-fijos"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-foreground">Gastos fijos</p>
          <p className="mt-1 text-xs text-muted-foreground">Administra tus suscripciones y facturas</p>
        </Link>
        <Link
          href="/contabilidad/deudas"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-amber-50/40"
        >
          <p className="text-sm font-medium text-foreground">Deudas</p>
          <p className="mt-1 text-xs text-muted-foreground">Haz seguimiento de tus deudas</p>
        </Link>
        <Link
          href="/contabilidad/revision-mensual"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-indigo-50/40"
        >
          <p className="text-sm font-medium text-foreground">Revisión mensual</p>
          <p className="mt-1 text-xs text-muted-foreground">Ingresos y gastos detallados por mes</p>
        </Link>
        <Link
          href="/contabilidad/ia"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-purple-50/40"
        >
          <p className="text-sm font-medium text-foreground">Asistente IA</p>
          <p className="mt-1 text-xs text-muted-foreground">Recibe consejos financieros personalizados</p>
        </Link>
      </div>
    </div>
  );
}
