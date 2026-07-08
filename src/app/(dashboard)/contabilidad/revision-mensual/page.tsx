"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMonthlyRecords,
  type MonthlyDetail,
} from "@/lib/actions/finance";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

export default function RevisionMensualPage() {
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyDetail[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    getMonthlyRecords().then((data) => {
      setMonthlyDetails(data);
      if (data.length > 0) setSelectedMonth(data[0]!.month);
    });
  }, []);

  const activeDetail = monthlyDetails.find((m) => m.month === selectedMonth);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/contabilidad"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Revisión mensual</h2>
          <p className="text-xs text-muted-foreground">Ingresos y gastos detallados por mes</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm">
        {monthlyDetails.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            No hay registros mensuales aún
          </div>
        ) : (
          <>
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
                        <td className="py-2 pr-3">
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
    </div>
  );
}
