"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { monthKey, currentMonthKey } from "@/lib/finance-utils";

export type FinanceSummary = {
  /** Suma de ingresos NO marcados como excludeFromBalance (histórico) */
  totalIncome: number;
  totalExpenses: number;
  totalFixedExpenses: number;
  /** Alias de saldoReal. Se mantiene por compatibilidad con la UI y la IA. */
  balance: number;
  activeDebtsCount: number;
  totalDebtRemaining: number;
  /** Ingresos excluidos por ser transferencias / préstamos / ingresos de terceros */
  excludedIncome: number;
  /** Abonos a deudas (type = "debt_payment") */
  debtPayments: number;
  /** Última línea base confirmada por el usuario */
  reconciliationBase: number;
  reconciliationDate: Date | null;
  /** Delta de movimientos posterior a la conciliación */
  movementsSinceReconciliation: number;
  /** Dinero real: línea base + movimientos */
  saldoReal: number;
};

export type FinanceRecordData = {
  type: "income" | "expense" | "fixed" | "debt_payment";
  amount: number;
  description: string;
  category?: string;
  date?: Date;
};

export type FixedExpenseData = {
  name: string;
  amount: number;
  category?: string;
  dayDue: number;
  notes?: string;
};

export type DebtData = {
  name: string;
  totalAmount: number;
  paidAmount?: number;
  interestRate?: number;
  dueDate?: Date;
  notes?: string;
};

export type MonthlySummary = {
  month: string;
  income: number;
  expenses: number;
};

export type MonthlyRecord = {
  id: string;
  type: string;
  amount: number;
  description: string;
  category: string | null;
  date: Date;
  excludeFromBalance: boolean;
};

export type MonthlyDetail = {  month: string;
  income: number;
  expenses: number;
  balance: number;
  records: MonthlyRecord[];
};

export type CategoryBreakdown = {
  category: string;
  amount: number;
  percentage: number;
};

export async function getMonthlySummary(): Promise<MonthlySummary[]> {
  const session = await getSession();
  if (!session) return [];

  const records = await db.financeRecord.findMany({
    where: { userId: session.id },
    select: { type: true, amount: true, date: true, excludeFromBalance: true },
  });

  const monthlyMap: Record<string, { income: number; expenses: number }> = {};

  for (const r of records) {
    const key = monthKey(r.date);
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 };
    if (r.type === "income" && !r.excludeFromBalance) monthlyMap[key].income += r.amount;
    else if (r.type === "expense") monthlyMap[key].expenses += r.amount;
  }

  return Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
    }));
}

export async function getMonthlyRecords(): Promise<MonthlyDetail[]> {
  const session = await getSession();
  if (!session) return [];

  const records = await db.financeRecord.findMany({
    where: { userId: session.id },
    orderBy: { date: "desc" },
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      category: true,
      date: true,
      excludeFromBalance: true,
    },
  });

  const grouped: Record<string, MonthlyDetail> = {};

  for (const r of records) {
    const key = monthKey(r.date);
    if (!grouped[key]) {
      grouped[key] = { month: key, income: 0, expenses: 0, balance: 0, records: [] };
    }
    if (r.type === "income" && !r.excludeFromBalance) grouped[key].income += r.amount;
    else if (r.type === "expense") grouped[key].expenses += r.amount;
    grouped[key].records.push(r);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([_, detail]) => ({
      ...detail,
      balance: detail.income - detail.expenses,
    }));
}

export async function getExpensesByCategory(month?: string): Promise<CategoryBreakdown[]> {
  const session = await getSession();
  if (!session) return [];

  const target = month ?? currentMonthKey();

  const expenses = await db.financeRecord.findMany({
    where: { userId: session.id, type: "expense" },
    select: { category: true, amount: true, date: true },
  });

  const categoryMap: Record<string, number> = {};

  for (const e of expenses) {
    if (monthKey(e.date) !== target) continue;
    const cat = e.category || "Sin categoría";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + e.amount;
  }

  const total = Object.values(categoryMap).reduce((sum, a) => sum + a, 0);

  return Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }));
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const records = await db.financeRecord.findMany({
    where: { userId: session.id },
    select: { type: true, amount: true, date: true, excludeFromBalance: true },
  });

  const totalIncome = records
    .filter((r) => r.type === "income" && !r.excludeFromBalance)
    .reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);

  const fixedExpenses = await db.fixedExpense.findMany({
    where: { userId: session.id, isActive: true },
    select: { amount: true },
  });
  const totalFixedExpenses = fixedExpenses.reduce((sum, f) => sum + f.amount, 0);

  const activeDebts = await db.debt.findMany({
    where: { userId: session.id, isActive: true },
    select: { totalAmount: true, paidAmount: true },
  });
  const activeDebtsCount = activeDebts.length;
  const totalDebtRemaining = activeDebts.reduce(
    (sum, d) => sum + (d.totalAmount - d.paidAmount),
    0,
  );

  // --- Saldo real: línea base de conciliación + delta de movimientos ---
  // Históricamente los "ingresos" incluían transferencias entre cuentas propias
  // y préstamos recibidos, por lo que la suma bruta nunca cuadró con el dinero
  // real. Se exclusieron vía `excludeFromBalance` sin tocar los registros.
  const lastReconciliation = await db.balanceReconciliation.findFirst({
    where: { userId: session.id },
    orderBy: { date: "desc" },
    select: { amount: true, date: true },
  });

  const base = lastReconciliation?.amount ?? 0;
  const since = lastReconciliation?.date ?? new Date(0);
  const movementsSince = records
    .filter((r) => r.excludeFromBalance === false)
    .filter((r) => r.date > since)
    .reduce((sum, r) => {
      if (r.type === "income") return sum + r.amount;
      if (r.type === "expense" || r.type === "debt_payment") return sum - r.amount;
      return sum;
    }, 0);

  const debtPayments = records
    .filter((r) => r.type === "debt_payment")
    .reduce((sum, r) => sum + r.amount, 0);

  const excludedIncome = records
    .filter((r) => r.type === "income" && r.excludeFromBalance)
    .reduce((sum, r) => sum + r.amount, 0);

  const saldoReal = base + movementsSince;

  return {
    totalIncome,
    totalExpenses,
    totalFixedExpenses,
    balance: saldoReal,
    activeDebtsCount,
    totalDebtRemaining,
    excludedIncome,
    debtPayments,
    reconciliationBase: base,
    reconciliationDate: lastReconciliation?.date ?? null,
    movementsSinceReconciliation: movementsSince,
    saldoReal,
  };
}

/** Marca / desmarca un registro para que no cuente en el saldo real. */
export async function toggleExcludeFromBalance(id: string, exclude: boolean) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.financeRecord.updateMany({
    where: { id, userId: session.id },
    data: { excludeFromBalance: exclude },
  });
}

/** Registra la línea base del saldo: "tengo $X hoy". */
export async function reconcileBalance(amount: number, date?: Date, note?: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  if (!Number.isFinite(amount)) throw new Error("Monto inválido");

  return db.balanceReconciliation.create({
    data: { amount, date: date ?? new Date(), note, userId: session.id },
  });
}

export async function getReconciliations(limit = 20) {
  const session = await getSession();
  if (!session) return [];

  return db.balanceReconciliation.findMany({
    where: { userId: session.id },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function getFinanceRecords(type?: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.financeRecord.findMany({
    where: {
      userId: session.id,
      ...(type ? { type } : {}),
    },
    orderBy: { date: "desc" },
    take: 100,
  });
}

export async function createFinanceRecord(data: FinanceRecordData) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.financeRecord.create({
    data: {
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category,
      date: data.date ?? new Date(),
      userId: session.id,
    },
  });
}

export async function updateFinanceRecord(
  id: string,
  data: { amount?: number; description?: string; category?: string | null; date?: Date },
) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.financeRecord.updateMany({
    where: { id, userId: session.id },
    data,
  });
}

export async function deleteFinanceRecord(id: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.financeRecord.deleteMany({
    where: { id, userId: session.id },
  });
}

export type CategoryInfo = { name: string; count: number };

export async function getCategories(): Promise<CategoryInfo[]> {
  const session = await getSession();
  if (!session) return [];
  const records = await db.financeRecord.findMany({
    where: { userId: session.id },
    select: { category: true, type: true },
  });
  const map: Record<string, number> = {};
  for (const r of records) {
    const cat = r.category || "Sin categoría";
    map[cat] = (map[cat] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function exportFinanceToCSV(type?: string): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");
  const records = await db.financeRecord.findMany({
    where: {
      userId: session.id,
      ...(type ? { type } : {}),
    },
    orderBy: { date: "desc" },
  });
  const header = "Fecha,Tipo,Descripción,Categoría,Importe\n";
  const rows = records
    .map(
      (r) =>
        `${r.date.toISOString().split("T")[0]},${r.type},"${r.description.replace(/"/g, '""')}",${r.category ?? ""},${r.amount}`,
    )
    .join("\n");
  return header + rows;
}

export async function getFixedExpenses() {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.fixedExpense.findMany({
    where: { userId: session.id },
    orderBy: { dayDue: "asc" },
  });
}

export async function createFixedExpense(data: FixedExpenseData) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.fixedExpense.create({
    data: {
      name: data.name,
      amount: data.amount,
      category: data.category,
      dayDue: data.dayDue,
      notes: data.notes,
      userId: session.id,
    },
  });
}

export async function updateFixedExpense(
  id: string,
  data: Partial<FixedExpenseData> & { isActive?: boolean },
) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.fixedExpense.updateMany({
    where: { id, userId: session.id },
    data,
  });
}

export async function deleteFixedExpense(id: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.fixedExpense.deleteMany({
    where: { id, userId: session.id },
  });
}

export async function getDebts() {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.debt.findMany({
    where: { userId: session.id },
    include: {
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDebt(data: DebtData) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.debt.create({
    data: {
      name: data.name,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount ?? 0,
      interestRate: data.interestRate,
      dueDate: data.dueDate,
      notes: data.notes,
      userId: session.id,
    },
  });
}

export async function updateDebt(
  id: string,
  data: Partial<DebtData> & { isActive?: boolean },
) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  return db.debt.updateMany({
    where: { id, userId: session.id },
    data,
  });
}

export async function deleteDebt(id: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.financeRecord.deleteMany({
    where: { debtId: id, userId: session.id },
  });
  await db.debt.deleteMany({
    where: { id, userId: session.id },
  });
}

export async function addDebtPayment(debtId: string, amount: number) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const debt = await db.debt.findFirst({
    where: { id: debtId, userId: session.id },
  });
  if (!debt) throw new Error("Deuda no encontrada");

  const newPaidAmount = debt.paidAmount + amount;

  await db.debt.update({
    where: { id: debtId },
    data: { paidAmount: newPaidAmount },
  });

  await db.financeRecord.create({
    data: {
      type: "debt_payment",
      amount,
      description: `Pago a: ${debt.name}`,
      userId: session.id,
      debtId,
    },
  });

  return { success: true };
}

export async function getFinanceAdvice(summary: FinanceSummary): Promise<{
  resumen: string;
  recomendaciones: string[];
  alertas: string[];
}> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const ratio = summary.totalIncome > 0
    ? summary.totalExpenses / summary.totalIncome
    : 1;
  const hasDebts = summary.activeDebtsCount > 0;

  // Flujo del período: ingresos reales - gastos - abonos a deudas.
  // No es lo mismo que el saldo actual (la plata que tienes en el bolsillo).
  const flujoNeto = summary.totalIncome - summary.totalExpenses - summary.debtPayments;

  let resumen: string;
  if (flujoNeto > 0) {
    resumen = `Ingresaste ${formatForAdvice(summary.totalIncome)} y gastaste ${formatForAdvice(summary.totalExpenses)}, dejando un superávit de ${formatForAdvice(flujoNeto)}. Tu saldo real actual es de ${formatForAdvice(summary.saldoReal)}.`;
  } else if (flujoNeto === 0) {
    resumen = `Tus finanzas están equilibradas: ingresaste y gastaste exactamente ${formatForAdvice(summary.totalIncome)}. Tu saldo real actual es de ${formatForAdvice(summary.saldoReal)}.`;
  } else {
    resumen = `Ingresaste ${formatForAdvice(summary.totalIncome)} pero gastaste ${formatForAdvice(summary.totalExpenses)}, generando un déficit de ${formatForAdvice(Math.abs(flujoNeto))}. Tu saldo real actual es de ${formatForAdvice(summary.saldoReal)}.`;
  }

  const recomendaciones: string[] = [];
  if (ratio > 0.7) {
    recomendaciones.push("Tus gastos representan más del 70% de tus ingresos. Considera reducir gastos discrecionales para mejorar tu margen de ahorro.");
  } else {
    recomendaciones.push("Mantienes una buena relación ingresos/gastos. Sigue así y considera aumentar tu porcentaje de ahorro.");
  }
  if (summary.saldoReal < 0) {
    recomendaciones.push("Tu saldo real es negativo. Concilia tu cuenta en la sección Resumen para que el cálculo vuelva a reflejar la realidad.");
  }
  if (summary.excludedIncome > 0) {
    recomendaciones.push(`Hay ${formatForAdvice(summary.excludedIncome)} registrados como ingresos que en realidad son transferencias, préstamos o ingresos de terceros. No cuentan como sueldo.`);
  }
  if (summary.totalFixedExpenses > 0) {
    recomendaciones.push(`Tienes ${formatForAdvice(summary.totalFixedExpenses)} en gastos fijos mensuales. Revisa si puedes negociar mejores tarifas en servicios o suscripciones.`);
  }
  if (hasDebts) {
    recomendaciones.push(`Tienes ${summary.activeDebtsCount} deuda(s) activa(s) por un total de ${formatForAdvice(summary.totalDebtRemaining)} pendiente. Prioriza el pago de las deudas con mayor interés.`);
  }
  recomendaciones.push("Establece un fondo de emergencia equivalente a 3-6 meses de tus gastos fijos.");

  const alertas: string[] = [];
  if (flujoNeto < 0) {
    alertas.push("Estás gastando más de lo que ingresas. Esto es insostenible a largo plazo. Revisa tu presupuesto urgentemente.");
  }
  if (hasDebts && summary.totalDebtRemaining > summary.totalIncome * 0.5) {
    alertas.push("El total de tus deudas representa más de la mitad de tus ingresos. Considera un plan de consolidación o renegociación.");
  }
  if (summary.totalFixedExpenses > summary.totalIncome * 0.5) {
    alertas.push("Tus gastos fijos superan el 50% de tus ingresos, lo que limita tu capacidad de ahorro e inversión.");
  }
  if (summary.saldoReal < 0) {
    alertas.push(`Tu saldo real es negativo (${formatForAdvice(summary.saldoReal)}). Concilia tu cuenta para corregir el cálculo.`);
  }
  if (alertas.length === 0) {
    alertas.push("No se detectan alertas críticas. Tus finanzas están bajo control.");
  }

  return { resumen, recomendaciones, alertas };
}

function formatForAdvice(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
