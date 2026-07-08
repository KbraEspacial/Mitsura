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

  const incomePct =
    summary.totalIncome + summary.totalExpenses > 0
      ? (summary.totalIncome / (summary.totalIncome + summary.totalExpenses)) * 100
      : 50;
  const expensePct = 100 - incomePct;

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
            <div className="flex flex-col gap-3">
              {monthly.map((m) => {
                const incomeW = (m.income / maxMonthly) * 100;
                const expenseW = (m.expenses / maxMonthly) * 100;
                return (
                  <div key={m.month}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {new Date(m.month + "-01").toLocaleDateString("es-ES", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(m.income - m.expenses)}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      <div
                        className="h-5 rounded-l bg-emerald-400 transition-all"
                        style={{ width: `${Math.max(incomeW, 2)}%` }}
                        title={`Ingresos: ${formatCurrency(m.income)}`}
                      />
                      <div
                        className="h-5 rounded-r bg-red-400 transition-all"
                        style={{ width: `${Math.max(expenseW, 2)}%` }}
                        title={`Gastos: ${formatCurrency(m.expenses)}`}
                      />
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatCurrency(m.income)}</span>
                      <span>{formatCurrency(m.expenses)}</span>
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
            <div className="flex flex-col gap-3">
              {categories.map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {c.category}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(c.amount)}
                    </span>
                  </div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.max(c.percentage, 1)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
                    {c.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Ingresos vs Gastos (Global)
        </h3>
        <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="flex items-center justify-center bg-emerald-500 text-[10px] font-semibold text-white transition-all"
            style={{ width: `${Math.max(incomePct, 5)}%` }}
          >
            {incomePct >= 12 ? `${Math.round(incomePct)}%` : ""}
          </div>
          <div
            className="flex items-center justify-center bg-red-400 text-[10px] font-semibold text-white transition-all"
            style={{ width: `${Math.max(expensePct, 5)}%` }}
          >
            {expensePct >= 12 ? `${Math.round(expensePct)}%` : ""}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Ingresos ({Math.round(incomePct)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
            Gastos ({Math.round(expensePct)}%)
          </span>
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
