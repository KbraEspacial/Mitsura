"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFinanceSummary, type FinanceSummary } from "@/lib/actions/finance";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

export default function ContabilidadPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);

  useEffect(() => {
    getFinanceSummary().then(setSummary);
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

      <div className="mb-8 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Ingresos vs Gastos
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
