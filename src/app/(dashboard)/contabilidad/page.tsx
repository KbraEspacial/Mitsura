"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getFinanceSummary,
  getMonthlySummary,
  getExpensesByCategory,
  getMonthlyRecords,
  type FinanceSummary,
  type MonthlySummary,
  type CategoryBreakdown,
  type MonthlyDetail,
} from "@/lib/actions/finance";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

const CATEGORY_COLORS = [
  "#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#d946ef", "#e11d48", "#0ea5e9", "#65a30d",
];

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = 120;
  const cy = 120;
  const r = 90;
  const strokeW = 28;

  let currentAngle = -90;

  const slices = data.map((d) => {
    const pct = d.value / total;
    const angle = pct * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;

    const sr = ((start * Math.PI) / 180);
    const er = ((end * Math.PI) / 180);
    const x1 = cx + r * Math.cos(sr);
    const y1 = cy + r * Math.sin(sr);
    const x2 = cx + r * Math.cos(er);
    const y2 = cy + r * Math.sin(er);
    const large = angle > 180 ? 1 : 0;

    return {
      path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      color: d.color,
      label: d.label,
      value: d.value,
      pct,
    };
  });

  return (
    <svg viewBox="0 0 240 240" className="h-48 w-48">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth={strokeW} strokeLinecap="butt" />
      ))}
      <circle cx={cx} cy={cy} r={r - strokeW / 2} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" className="text-lg font-bold" fill="currentColor">
        {data.length}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="text-[10px]" fill="#6b7280">
        conceptos
      </text>
    </svg>
  );
}

export default function ContabilidadPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyDetail[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    getFinanceSummary().then(setSummary);
    getMonthlySummary().then(setMonthly);
    getExpensesByCategory().then(setCategories);
    getMonthlyRecords().then((data) => {
      setMonthlyDetails(data);
      if (data.length > 0 && !selectedMonth) setSelectedMonth(data[0]!.month);
    });
  }, []);

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

  const activeDetail = monthlyDetails.find((m) => m.month === selectedMonth);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Resumen financiero</h2>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ingresos
            </p>
            <p className="mt-0.5 text-xl font-bold text-emerald-600">
              {formatCurrency(summary.totalIncome)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 text-red-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Gastos
            </p>
            <p className="mt-0.5 text-xl font-bold text-red-500">
              {formatCurrency(summary.totalExpenses)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${summary.balance >= 0 ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-500"}`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Balance
            </p>
            <p className={`mt-0.5 text-xl font-bold ${summary.balance >= 0 ? "text-blue-600" : "text-red-500"}`}>
              {formatCurrency(summary.balance)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Deudas activas
            </p>
            <p className="mt-0.5 text-xl font-bold text-amber-600">
              {summary.activeDebtsCount}
            </p>
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
            <p className="text-xs text-muted-foreground">
              No hay registros mensuales aún
            </p>
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
                      <span className={
                        m.income - m.expenses >= 0
                          ? "font-medium text-emerald-600"
                          : "font-medium text-red-500"
                      }>
                        {formatCurrency(m.income - m.expenses)}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      <div className="flex-1">
                        <div className="relative h-6 w-full rounded-md bg-gray-100">
                          <div
                            className="h-full rounded-md bg-emerald-400 transition-all"
                            style={{ width: `${iw}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-[11px] text-emerald-600">{formatCurrency(m.income)}</p>
                      </div>
                      <div className="flex-1">
                        <div className="relative h-6 w-full rounded-md bg-gray-100">
                          <div
                            className="h-full rounded-md bg-red-400 transition-all"
                            style={{ width: `${ew}%` }}
                          />
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
            <p className="text-xs text-muted-foreground">
              No hay gastos registrados aún
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <DonutChart
                data={categories.map((c, i) => ({
                  label: c.category,
                  value: c.amount,
                  color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
                }))}
              />
              <div className="flex w-full flex-col gap-1.5">
                {categories.map((c, i) => (
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    <span className="flex-1 text-foreground">{c.category}</span>
                    <span className="text-muted-foreground">{formatCurrency(c.amount)}</span>
                    <span className="w-10 text-right text-muted-foreground/60">{c.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly review - selector + detail */}
      <div className="mb-8 rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Revisión mensual</h3>
        </div>
        {monthlyDetails.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            No hay registros mensuales aún
          </div>
        ) : (
          <>
            {/* Month selector pills */}
            <div className="flex flex-wrap gap-2 border-b px-5 py-3">
              {monthlyDetails.map((m) => {
                const active = m.month === selectedMonth;
                return (
                  <button
                    key={m.month}
                    onClick={() => setSelectedMonth(m.month)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
                    }`}
                  >
                    {new Date(m.month + "-01").toLocaleDateString("es-ES", {
                      month: "long",
                      year: "numeric",
                    })}
                  </button>
                );
              })}
            </div>

            {/* Selected month detail */}
            {activeDetail && (
              <div className="p-5">
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Ingresos</p>
                    <p className="mt-0.5 text-lg font-bold text-emerald-600">{formatCurrency(activeDetail.income)}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-red-500">Gastos</p>
                    <p className="mt-0.5 text-lg font-bold text-red-500">{formatCurrency(activeDetail.expenses)}</p>
                  </div>
                  <div className={`rounded-lg border px-4 py-3 ${
                    activeDetail.balance >= 0
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-red-200 bg-red-50/50"
                  }`}>
                    <p className={`text-[10px] font-medium uppercase tracking-wider ${
                      activeDetail.balance >= 0 ? "text-blue-600" : "text-red-500"
                    }`}>Balance</p>
                    <p className={`mt-0.5 text-lg font-bold ${
                      activeDetail.balance >= 0 ? "text-blue-600" : "text-red-500"
                    }`}>{formatCurrency(activeDetail.balance)}</p>
                  </div>
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Descripción</th>
                      <th className="py-2 pr-3">Categoría</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDetail.records.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 pr-3 text-muted-foreground">
                          {new Date(r.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="py-2 pr-3 font-medium text-foreground">{r.description}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {r.category || "—"}
                          </span>
                        </td>
                        <td className={`py-2 text-right font-medium ${r.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                          {r.type === "income" ? "+" : "-"}{formatCurrency(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/contabilidad/ingresos"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-emerald-50/40"
        >
          <p className="text-sm font-medium text-foreground">Gestionar ingresos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Añade y revisa tus ingresos
          </p>
        </Link>
        <Link
          href="/contabilidad/gastos"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-red-50/40"
        >
          <p className="text-sm font-medium text-foreground">Gestionar gastos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Controla tus gastos diarios
          </p>
        </Link>
        <Link
          href="/contabilidad/gastos-fijos"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-foreground">Gastos fijos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Administra tus suscripciones y facturas
          </p>
        </Link>
        <Link
          href="/contabilidad/deudas"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-amber-50/40"
        >
          <p className="text-sm font-medium text-foreground">Deudas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Haz seguimiento de tus deudas
          </p>
        </Link>
        <Link
          href="/contabilidad/ia"
          className="rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:bg-purple-50/40"
        >
          <p className="text-sm font-medium text-foreground">Asistente IA</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Recibe consejos financieros personalizados
          </p>
        </Link>
      </div>
    </div>
  );
}
