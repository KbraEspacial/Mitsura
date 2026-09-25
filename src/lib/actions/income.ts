"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { monthRange } from "@/lib/finance-utils";
import { paydaysForSource } from "@/lib/income-plan";

export type IncomeSourceData = {
  name: string;
  amount: number;
  frequency: "monthly" | "biweekly" | "weekly";
  dayOfMonth: number;
  secondDay?: number | null;
  category?: string;
  isActive?: boolean;
  notes?: string;
};

export type IncomeSourceInfo = {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  dayOfMonth: number;
  secondDay: number | null;
  category: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
};

export type PaydayInfo = {
  sourceId: string;
  sourceName: string;
  date: Date;
  amount: number;
  generated: boolean;
  recordId: string | null;
  isPast: boolean;
};

export async function getIncomeSources(): Promise<IncomeSourceInfo[]> {
  const session = await getSession();
  if (!session) return [];

  return db.incomeSource.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function createIncomeSource(data: IncomeSourceData) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  if (!data.name.trim()) throw new Error("El nombre es obligatorio");
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("El monto debe ser mayor que cero");
  }
  if (data.frequency === "biweekly" && data.secondDay === data.dayOfMonth) {
    throw new Error("El segundo día debe ser distinto del primero");
  }

  return db.incomeSource.create({
    data: {
      name: data.name.trim(),
      amount: data.amount,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      secondDay: data.frequency === "biweekly" ? (data.secondDay ?? 30) : null,
      category: data.category?.trim() || null,
      isActive: data.isActive ?? true,
      notes: data.notes?.trim() || null,
      userId: session.id,
    },
  });
}

export async function updateIncomeSource(id: string, data: Partial<IncomeSourceData>) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const existing = await db.incomeSource.findFirst({
    where: { id, userId: session.id },
  });
  if (!existing) throw new Error("Fuente de ingreso no encontrada");

  const merged = {
    name: data.name?.trim() ?? existing.name,
    amount: data.amount ?? existing.amount,
    frequency: data.frequency ?? existing.frequency,
    dayOfMonth: data.dayOfMonth ?? existing.dayOfMonth,
    secondDay: data.secondDay !== undefined ? data.secondDay : existing.secondDay,
  };

  if (!merged.name) throw new Error("El nombre es obligatorio");
  if (!Number.isFinite(merged.amount) || merged.amount <= 0) {
    throw new Error("El monto debe ser mayor que cero");
  }
  if (merged.frequency === "biweekly" && merged.secondDay === merged.dayOfMonth) {
    throw new Error("El segundo día debe ser distinto del primero");
  }

  await db.incomeSource.updateMany({
    where: { id, userId: session.id },
    data: {
      name: merged.name,
      amount: merged.amount,
      frequency: merged.frequency,
      dayOfMonth: merged.dayOfMonth,
      secondDay: merged.frequency === "biweekly" ? (merged.secondDay ?? 30) : null,
      ...(data.category !== undefined ? { category: data.category?.trim() || null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
    },
  });
}

export async function deleteIncomeSource(id: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.incomeSource.deleteMany({ where: { id, userId: session.id } });
}

export async function toggleIncomeSource(id: string, isActive: boolean) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.incomeSource.updateMany({
    where: { id, userId: session.id },
    data: { isActive },
  });
}

/**
 * Crea los registros de ingreso de una fuente para un mes.
 * Idempotente: si ya existe un registro de esa fuente con ese día, no duplica.
 */
export async function generateIncomeForMonth(sourceId: string, key: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const source = await db.incomeSource.findFirst({
    where: { id: sourceId, userId: session.id },
  });
  if (!source) throw new Error("Fuente de ingreso no encontrada");

  const { start } = monthRange(key);
  const year = start.getFullYear();
  const month = start.getMonth();
  const days = paydaysForSource(source, key);

  const created: string[] = [];
  const skipped: number[] = [];

  for (const day of days) {
    // Mediodía local para que el día nunca se desplace por zona horaria.
    const date = new Date(year, month, day, 12);

    const existing = await db.financeRecord.findFirst({
      where: {
        userId: session.id,
        sourceId: source.id,
        date: { gte: new Date(year, month, day, 0), lt: new Date(year, month, day + 1) },
      },
      select: { id: true },
    });
    if (existing) {
      skipped.push(day);
      continue;
    }

    const rec = await db.financeRecord.create({
      data: {
        type: "income",
        amount: source.amount,
        description: source.name,
        category: source.category || "Nómina",
        date,
        isRecurring: true,
        userId: session.id,
        sourceId: source.id,
      },
      select: { id: true },
    });
    created.push(rec.id);
  }

  return { created: created.length, skipped: skipped.length, total: days.length };
}

/** Genera todas las fuentes activas del mes. */
export async function generateAllIncomeForMonth(key: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const sources = await db.incomeSource.findMany({
    where: { userId: session.id, isActive: true },
  });

  let created = 0;
  let skipped = 0;
  for (const source of sources) {
    const r = await generateIncomeForMonth(source.id, key);
    created += r.created;
    skipped += r.skipped;
  }
  return { created, skipped, sources: sources.length };
}

/** Estado de cobro del mes: qué días hay y si ya se registró el ingreso. */
export async function getPaydayStatus(key: string): Promise<PaydayInfo[]> {
  const session = await getSession();
  if (!session) return [];

  const sources = await db.incomeSource.findMany({
    where: { userId: session.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (sources.length === 0) return [];

  const { start, end } = monthRange(key);
  const records = await db.financeRecord.findMany({
    where: { userId: session.id, sourceId: { not: null }, date: { gte: start, lt: end } },
    select: { id: true, sourceId: true, amount: true, date: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result: PaydayInfo[] = [];
  for (const source of sources) {
    for (const day of paydaysForSource(source, key)) {
      const year = start.getFullYear();
      const monthIndex = start.getMonth();
      const dayStart = new Date(year, monthIndex, day);
      const dayEnd = new Date(year, monthIndex, day + 1);

      const match = records.find(
        (r) => r.sourceId === source.id && r.date >= dayStart && r.date < dayEnd,
      );

      result.push({
        sourceId: source.id,
        sourceName: source.name,
        date: dayStart,
        amount: source.amount,
        generated: Boolean(match),
        recordId: match?.id ?? null,
        isPast: dayStart < today,
      });
    }
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Ingresos esperados vs registrados del mes. */
export async function getIncomePlanSummary(key: string) {
  const paydays = await getPaydayStatus(key);
  const expected = paydays.reduce((s, p) => s + p.amount, 0);
  const received = paydays.filter((p) => p.generated).reduce((s, p) => s + p.amount, 0);
  return {
    expected,
    received,
    pending: expected - received,
    paydays,
  };
}
