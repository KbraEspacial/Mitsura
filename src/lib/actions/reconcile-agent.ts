"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { analyzeForReconciliation, type Finding, type Txn } from "@/lib/reconcile-checks";
import { getFinanceSummary } from "@/lib/actions/finance";
import { geminiText } from "@/lib/ai";

export type ReconcileReport = {
  saldoReal: number;
  base: number;
  movements: number;
  reconciliationDate: Date | null;
  findings: Finding[];
  agentComment: string | null;
  agentAvailable: boolean;
};

const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/**
 * Corre el analisis deterministico y pide al agente que lo explique.
 * No aplica cambios: propone. El usuario decide.
 */
export async function runReconcileAgent(): Promise<ReconcileReport> {
  const session = await getSession();
  if (!session) {
    return {
      saldoReal: 0, base: 0, movements: 0, reconciliationDate: null,
      findings: [], agentComment: null, agentAvailable: false,
    };
  }

  const [summary, raw] = await Promise.all([
    getFinanceSummary(),
    db.financeRecord.findMany({
      where: { userId: session.id },
      select: {
        id: true, type: true, amount: true, description: true,
        category: true, date: true, excludeFromBalance: true,
      },
      orderBy: { date: "desc" },
      take: 500,
    }),
  ]);

  const txns: Txn[] = raw.map((r) => ({
    id: r.id,
    type: r.type as Txn["type"],
    amount: r.amount,
    description: r.description,
    category: r.category,
    date: r.date,
    excludeFromBalance: r.excludeFromBalance,
  }));

  const findings = analyzeForReconciliation(
    txns,
    {
      saldoReal: summary.saldoReal,
      base: summary.reconciliationBase,
      movements: summary.movementsSinceReconciliation,
      reconciliationDate: summary.reconciliationDate,
    },
    new Date(),
  );

  const report: ReconcileReport = {
    saldoReal: summary.saldoReal,
    base: summary.reconciliationBase,
    movements: summary.movementsSinceReconciliation,
    reconciliationDate: summary.reconciliationDate,
    findings,
    agentComment: null,
    agentAvailable: Boolean(process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY),
  };

  if (!report.agentAvailable || findings.length === 0) return report;

  const contexto = [
    `Saldo real actual: ${money(report.saldoReal)}`,
    `Ancla de conciliacion: ${money(report.base)}`,
    `Movimientos desde el ancla: ${money(report.movements)}`,
    `Hallazgos automaticos: ${findings.length}`,
    ...findings.map(
      (f, i) =>
        `${i + 1}. [${f.severity}] ${f.title} — impacto ${money(f.impact)}. ${f.detail}`,
    ),
  ].join("\n");

  try {
    report.agentComment = await geminiText(
      `Eres un analista de finanzas personales. Te paso hallazgos ya detectados por reglas deterministicas sobre las transacciones de un usuario. Tu trabajo es explicarlos con criterio y decir que conviene hacer primero.

Reglas:
- No recalcules ni inventes cifras: usa solo los numeros que te doy.
- Se concreto: maximo 3 parrafos cortos.
- Prioriza por gravedad e impacto economico.
- Cierra con una frase de que hacer en el app (anclar de nuevo, excluir registros, completar categorias).
- Responde en español colombiano, sin emojis.`,
      [
        { role: "user", parts: [{ text: contexto }] },
      ],
    );
  } catch (e) {
    report.agentComment = null;
    report.agentAvailable = false;
    void e;
  }

  return report;
}
