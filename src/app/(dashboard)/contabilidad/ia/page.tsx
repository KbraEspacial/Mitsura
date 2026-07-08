"use client";

import { useEffect, useState } from "react";
import {
  getFinanceSummary,
  getFinanceAdvice,
  type FinanceSummary,
} from "@/lib/actions/finance";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP" });

type Advice = {
  resumen: string;
  recomendaciones: string[];
  alertas: string[];
};

export default function IaPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    getFinanceSummary().then(async (s) => {
      setSummary(s);
      const a = await getFinanceAdvice(s);
      setAdvice(a);
      setBusy(false);
    });
  }, []);

  if (busy) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Analizando tus finanzas...
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Asistente financiero IA</h2>

      <div className="mb-6 rounded-xl border border-border bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg">
            🤖
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Mitsura AI</p>
            <p className="text-xs text-muted-foreground">
              Analizado sobre {formatCurrency(summary!.totalIncome)} en ingresos y{" "}
              {summary!.activeDebtsCount} deuda(s) activa(s)
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-white/80 p-4 text-sm leading-relaxed text-foreground shadow-sm">
          {advice?.resumen}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recomendaciones
        </h3>
        <div className="flex flex-col gap-2">
          {advice?.recomendaciones.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-sm"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {i + 1}
              </span>
              <p className="text-sm text-foreground leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Alertas
        </h3>
        <div className="flex flex-col gap-2">
          {advice?.alertas.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-sm"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm">
                ⚠️
              </span>
              <p className="text-sm text-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
