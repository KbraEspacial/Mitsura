"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export type FinanceSummary = {
  totalIncome: number;
  totalExpenses: number;
  totalFixedExpenses: number;
  balance: number;
  activeDebtsCount: number;
  totalDebtRemaining: number;
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

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const records = await db.financeRecord.findMany({
    where: { userId: session.id },
    select: { type: true, amount: true },
  });

  const totalIncome = records
    .filter((r) => r.type === "income")
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

  return {
    totalIncome,
    totalExpenses,
    totalFixedExpenses,
    balance: totalIncome - totalExpenses,
    activeDebtsCount,
    totalDebtRemaining,
  };
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

export async function deleteFinanceRecord(id: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.financeRecord.deleteMany({
    where: { id, userId: session.id },
  });
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

  let resumen: string;
  if (summary.balance > 0) {
    resumen = `Tus finanzas están en positivo. Ingresaste ${formatForAdvice(summary.totalIncome)} y gastaste ${formatForAdvice(summary.totalExpenses)}, generando un superávit de ${formatForAdvice(summary.balance)}.`;
  } else if (summary.balance === 0) {
    resumen = `Tus finanzas están equilibradas. Ingresaste y gastaste exactamente ${formatForAdvice(summary.totalIncome)}.`;
  } else {
    resumen = `Tus finanzas están en negativo. Ingresaste ${formatForAdvice(summary.totalIncome)} pero gastaste ${formatForAdvice(summary.totalExpenses)}, generando un déficit de ${formatForAdvice(Math.abs(summary.balance))}.`;
  }

  const recomendaciones: string[] = [];
  if (ratio > 0.7) {
    recomendaciones.push("Tus gastos representan más del 70% de tus ingresos. Considera reducir gastos discrecionales para mejorar tu margen de ahorro.");
  } else {
    recomendaciones.push("Mantienes una buena relación ingresos/gastos. Sigue así y considera aumentar tu porcentaje de ahorro.");
  }
  if (summary.totalFixedExpenses > 0) {
    recomendaciones.push(`Tienes ${formatForAdvice(summary.totalFixedExpenses)} en gastos fijos mensuales. Revisa si puedes negociar mejores tarifas en servicios o suscripciones.`);
  }
  if (hasDebts) {
    recomendaciones.push(`Tienes ${summary.activeDebtsCount} deuda(s) activa(s) por un total de ${formatForAdvice(summary.totalDebtRemaining)} pendiente. Prioriza el pago de las deudas con mayor interés.`);
  }
  recomendaciones.push("Establece un fondo de emergencia equivalente a 3-6 meses de tus gastos fijos.");

  const alertas: string[] = [];
  if (summary.balance < 0) {
    alertas.push("Estás gastando más de lo que ingresas. Esto es insostenible a largo plazo. Revisa tu presupuesto urgentemente.");
  }
  if (hasDebts && summary.totalDebtRemaining > summary.totalIncome * 0.5) {
    alertas.push("El total de tus deudas representa más de la mitad de tus ingresos. Considera un plan de consolidación o renegociación.");
  }
  if (summary.totalFixedExpenses > summary.totalIncome * 0.5) {
    alertas.push("Tus gastos fijos superan el 50% de tus ingresos, lo que limita tu capacidad de ahorro e inversión.");
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
