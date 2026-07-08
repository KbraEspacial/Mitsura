"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getFinanceSummary,
  getMonthlySummary,
  getExpensesByCategory,
  type FinanceSummary,
  type MonthlySummary,
  type CategoryBreakdown,
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

  useEffect(() => {
    getFinanceSummary().then(setSummary);
    getMonthlySummary().then(setMonthly);
    getExpensesByCategory().then(setCategories);
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

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Resumen financiero</h2>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Ingresos
          </p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-600">
            {formatCurrency(summary.totalIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Gastos
          </p>
          <p className="mt-1.5 text-2xl font-bold text-red-500">
            {formatCurrency(summary.totalExpenses)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Balance
          </p>
          <p
            className={`mt-1.5 text-2xl font-bold ${
              summary.balance >= 0 ? "text-blue-600" : "text-red-500"
            }`}
          >
            {formatCurrency(summary.balance)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Deudas Activas
          </p>
          <p className="mt-1.5 text-2xl font-bold text-amber-600">
            {summary.activeDebtsCount}
          </p>
        </div>
      </div>

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
            <div className="flex flex-col gap-4">
              {monthly.map((m) => {
                const max = maxMonthly;
                return (
                  <div key={m.month}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {new Date(m.month + "-01").toLocaleDateString("es-ES", {
                          month: "long",
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
                    <div className="relative h-7 w-full rounded-lg bg-gray-100">
                      <div
                        className="absolute left-0 top-0 h-full rounded-l-lg bg-emerald-400 transition-all"
                        style={{ width: `${(m.income / max) * 100}%` }}
                      />
                      <div
                        className="absolute right-0 top-0 h-full rounded-r-lg bg-red-400 transition-all"
                        style={{ width: `${(m.expenses / max) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span className="text-emerald-600">{formatCurrency(m.income)}</span>
                      <span className="text-red-500">{formatCurrency(m.expenses)}</span>
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
