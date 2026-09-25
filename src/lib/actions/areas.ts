"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { monthKey, monthRange } from "@/lib/finance-utils";

export type LifeAreaInfo = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  monthlyBudget: number;
  sortOrder: number;
  isActive: boolean;
};

export type AreaSpending = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  monthlyBudget: number;
  sortOrder: number;
  spent: number;
  /** presupuesto - gastado (puede ser negativo) */
  remaining: number;
  /** 0..1+ (100% = agotado) */
  ratio: number;
  overBudget: boolean;
  categories: { category: string; amount: number }[];
};

export type AreaData = {
  name: string;
  emoji?: string;
  color?: string;
  monthlyBudget?: number;
  sortOrder?: number;
};

export async function getLifeAreas(): Promise<LifeAreaInfo[]> {
  const session = await getSession();
  if (!session) return [];

  return db.lifeArea.findMany({
    where: { userId: session.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Todas las áreas con lo gastado del mes, agrupado por categoría mapeada. */
export async function getAreaSpending(key?: string): Promise<AreaSpending[]> {
  const session = await getSession();
  if (!session) return [];

  const target = key ?? monthKey(new Date());
  const { start, end } = monthRange(target);

  const [areas, mappings, expenses] = await Promise.all([
    db.lifeArea.findMany({
      where: { userId: session.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.categoryArea.findMany({
      where: { userId: session.id },
      select: { category: true, areaId: true },
    }),
    db.financeRecord.findMany({
      where: { userId: session.id, type: "expense", date: { gte: start, lt: end } },
      select: { category: true, amount: true },
    }),
  ]);

  // normaliza para casar "PRESTAMO" con "Prestamo"
  const areaByCategory = new Map<string, string>();
  for (const m of mappings) {
    areaByCategory.set(m.category.trim().toLowerCase(), m.areaId);
  }

  const totals = new Map<string, Map<string, number>>();
  const unmapped: Map<string, number> = new Map();

  for (const e of expenses) {
    const cat = (e.category ?? "").trim();
    if (!cat) continue;
    const areaId = areaByCategory.get(cat.toLowerCase());
    if (!areaId) {
      unmapped.set(cat, (unmapped.get(cat) ?? 0) + e.amount);
      continue;
    }
    if (!totals.has(areaId)) totals.set(areaId, new Map());
    const bucket = totals.get(areaId)!;
    bucket.set(cat, (bucket.get(cat) ?? 0) + e.amount);
  }

  return areas.map((area) => {
    const bucket = totals.get(area.id) ?? new Map<string, number>();
    const spent = [...bucket.values()].reduce((s, v) => s + v, 0);
    const remaining = area.monthlyBudget - spent;
    return {
      id: area.id,
      name: area.name,
      emoji: area.emoji,
      color: area.color,
      monthlyBudget: area.monthlyBudget,
      sortOrder: area.sortOrder,
      spent,
      remaining,
      ratio: area.monthlyBudget > 0 ? spent / area.monthlyBudget : 0,
      overBudget: area.monthlyBudget > 0 && spent > area.monthlyBudget,
      categories: [...bucket.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  });
}

/** Categorías que existen en los movimientos pero todavía no tienen área. */
export async function getUnmappedCategories(): Promise<{ category: string; amount: number }[]> {
  const session = await getSession();
  if (!session) return [];

  const [mappings, expenses] = await Promise.all([
    db.categoryArea.findMany({ where: { userId: session.id }, select: { category: true } }),
    db.financeRecord.findMany({
      where: { userId: session.id, type: "expense" },
      select: { category: true, amount: true },
    }),
  ]);

  const mapped = new Set(mappings.map((m) => m.category.trim().toLowerCase()));
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const cat = (e.category ?? "").trim();
    if (!cat || mapped.has(cat.toLowerCase())) continue;
    totals.set(cat, (totals.get(cat) ?? 0) + e.amount);
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getCategoryMappings() {
  const session = await getSession();
  if (!session) return [];

  return db.categoryArea.findMany({
    where: { userId: session.id },
    select: { category: true, areaId: true },
  });
}

export async function createLifeArea(data: AreaData) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  if (!data.name.trim()) throw new Error("El nombre es obligatorio");

  const count = await db.lifeArea.count({ where: { userId: session.id } });

  return db.lifeArea.create({
    data: {
      name: data.name.trim(),
      emoji: data.emoji?.trim() || null,
      color: data.color?.trim() || null,
      monthlyBudget: data.monthlyBudget ?? 0,
      sortOrder: data.sortOrder ?? count,
      userId: session.id,
    },
  });
}

export async function updateLifeArea(
  id: string,
  data: Partial<AreaData> & { isActive?: boolean },
) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.lifeArea.updateMany({
    where: { id, userId: session.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.emoji !== undefined ? { emoji: data.emoji?.trim() || null } : {}),
      ...(data.color !== undefined ? { color: data.color?.trim() || null } : {}),
      ...(data.monthlyBudget !== undefined ? { monthlyBudget: data.monthlyBudget } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

export async function setAreaBudget(id: string, monthlyBudget: number) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0) {
    throw new Error("Presupuesto inválido");
  }

  await db.lifeArea.updateMany({
    where: { id, userId: session.id },
    data: { monthlyBudget },
  });
}

export async function deleteLifeArea(id: string) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  await db.lifeArea.deleteMany({ where: { id, userId: session.id } });
}

export async function assignCategory(category: string, areaId: string | null) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const cat = category.trim();
  if (!cat) throw new Error("Categoría vacía");

  // una categoría solo puede pertenecer a un área (unique userId+category)
  await db.categoryArea.deleteMany({
    where: { userId: session.id, category: { equals: cat, mode: "insensitive" } },
  });

  if (areaId) {
    const area = await db.lifeArea.findFirst({ where: { id: areaId, userId: session.id } });
    if (!area) throw new Error("Área no encontrada");
    await db.categoryArea.create({
      data: { category: cat, areaId, userId: session.id },
    });
  }
}

/** Resumen global de presupuestos para el badge / IA. */
export async function getBudgetOverview(key?: string) {
  const areas = await getAreaSpending(key);
  const withBudget = areas.filter((a) => a.monthlyBudget > 0);
  const totalBudget = withBudget.reduce((s, a) => s + a.monthlyBudget, 0);
  const totalSpent = withBudget.reduce((s, a) => s + a.spent, 0);
  const over = withBudget.filter((a) => a.overBudget);

  return {
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    ratio: totalBudget > 0 ? totalSpent / totalBudget : 0,
    overBudgetAreas: over.map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      spent: a.spent,
      budget: a.monthlyBudget,
      excess: a.spent - a.monthlyBudget,
    })),
    // 80%+ del presupuesto consumido
    nearBudgetAreas: withBudget
      .filter((a) => !a.overBudget && a.ratio >= 0.8)
      .map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        spent: a.spent,
        budget: a.monthlyBudget,
        ratio: a.ratio,
      })),
  };
}
