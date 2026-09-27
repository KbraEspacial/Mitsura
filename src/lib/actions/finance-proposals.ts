"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { currentMonthKey, monthKey, monthLabel, monthRange } from "@/lib/finance-utils";
import { similitud } from "@/lib/statement-matcher";

const formatCurrency = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/**
 * Cambio concreto que la IA propone y el usuario aprueba con un clic.
 *
 * Las propuestas se calculan con reglas, no con el modelo: si el LLM inventara
 * un número y la app lo escribiera en la base, un error de alucinación
 *raitaría directo a tus datos. El modelo solo explica la propuesta.
 */
export type Proposal = {
  /** estable para poder aplicarla por id y deduplicarla */
  id: string;
  kind: "assign_category" | "adjust_budget" | "set_total";
  title: string;
  detail: string;
  /** qué gana el usuario si acepta */
  impact: string;
  /** la app puede aplicarlo; false = solo es consejo */
  actionable: boolean;
  areaId: string | null;
  areaName: string | null;
  category: string | null;
  month: string;
  current: number | null;
  suggested: number | null;
};

type AreaRow = {
  id: string;
  name: string;
  emoji: string | null;
  monthlyBudget: number;
};

/** Categorías que ya están dentro de cada área: sirven de ejemplo para sugerir. */
async function getAreaCategories(
  uid: string,
): Promise<Map<string, string[]>> {
  const mappings = await db.categoryArea.findMany({
    where: { userId: uid },
    select: { category: true, areaId: true },
  });
  const out = new Map<string, string[]>();
  for (const m of mappings) {
    if (!out.has(m.areaId)) out.set(m.areaId, []);
    out.get(m.areaId)!.push(m.category);
  }
  return out;
}

/**
 * Propone a qué área pertenece una categoría huérfana comparando su nombre con
 * el nombre del área y con las categorías que ya tiene. No adivina si el
 * margen es bajo: es mejor pedir que la elijas tú.
 */
function guessArea(category: string, areas: AreaRow[], byCat: Map<string, string[]>): AreaRow | null {
  let best: { area: AreaRow; score: number } | null = null;

  for (const area of areas) {
    let score = similitud(category, area.name);

    for (const c of byCat.get(area.id) ?? []) {
      score = Math.max(score, similitud(category, c) * 0.9);
    }

    if (!best || score > best.score) best = { area, score };
  }

  return best && best.score >= 0.45 ? best.area : null;
}

/** Redondea a un múltiplo de 10.000 para que los números sean manejables. */
const round = (n: number) => Math.max(0, Math.round(n / 10_000) * 10_000);

export async function getFinanceProposals(month?: string): Promise<Proposal[]> {
  const session = await getSession();
  if (!session) return [];

  const target = month ?? currentMonthKey();
  const { start, end } = monthRange(target);

  const [areas, mappings, expenses, plans, history] = await Promise.all([
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
    db.monthlyBudget.findMany({
      where: { userId: session.id },
      select: { month: true, amount: true },
    }),
    getHistory(session.id, target),
  ]);

  const proposals: Proposal[] = [];
  const areaByCategory = new Map<string, string>();
  for (const m of mappings) areaByCategory.set(m.category.trim().toLowerCase(), m.areaId);
  const byCat = await getAreaCategories(session.id);

  // --- 1. categorías del mes que no caen en ninguna área -------------------
  const orphans = new Map<string, number>();
  for (const e of expenses) {
    const cat = (e.category ?? "").trim();
    const areaId = cat ? areaByCategory.get(cat.toLowerCase()) : undefined;
    if (areaId) continue;
    const label = cat || "(sin categoría)";
    orphans.set(label, (orphans.get(label) ?? 0) + e.amount);
  }

  for (const [category, amount] of [...orphans].sort((a, b) => b[1] - a[1])) {
    const guess = category === "(sin categoría)" ? null : guessArea(category, areas, byCat);
    proposals.push({
      id: `assign:${category}:${target}`,
      kind: "assign_category",
      title: guess
        ? `"${category}" parece de ${guess.name}`
        : `"${category}" no está en ninguna área`,
      detail: guess
        ? `Llevas ${formatCurrency(amount)} en ${category} en ${monthLabel(target)} y el nombre se parece a ${guess.name}, que ya tiene ${(byCat.get(guess.id) ?? []).length} categoría(s).`
        : `Llevas ${formatCurrency(amount)} en ${category} en ${monthLabel(target)} y no puedo adivinar a qué área pertenece.`,
      impact: `Esos ${formatCurrency(amount)} empiezan a contar dentro de un presupuesto.`,
      actionable: guess !== null,
      areaId: guess?.id ?? null,
      areaName: guess?.name ?? null,
      category,
      month: target,
      current: null,
      suggested: null,
    });
  }

  // --- 2. gasto por área y contra presupuesto -----------------------------
  const spend = new Map<string, number>();
  for (const e of expenses) {
    const cat = (e.category ?? "").trim();
    const areaId = cat ? areaByCategory.get(cat.toLowerCase()) : undefined;
    if (!areaId) continue;
    spend.set(areaId, (spend.get(areaId) ?? 0) + e.amount);
  }

  const plannedTotal = plans.find((p) => p.month === target)?.amount ?? 0;
  const totalBudget = areas.reduce((s, a) => s + a.monthlyBudget, 0);

  for (const area of areas) {
    const spent = spend.get(area.id) ?? 0;
    const hist = history.get(area.id) ?? [];

    // presupuesto 0 pero con gasto real: no hay contra qué medirse
    if (area.monthlyBudget <= 0 && spent > 0) {
      const avg = averageOf(hist, target);
      if (avg > 0) {
        const suggested = round(avg * 1.1);
        proposals.push({
          id: `budget-missing:${area.id}:${target}`,
          kind: "adjust_budget",
          title: `${area.name} no tiene presupuesto`,
          detail: `Ya gastaste ${formatCurrency(spent)} en ${area.name} este mes y no hay límite definido.`,
          impact: `Te propongo ${formatCurrency(suggested)} (un 10% sobre tu promedio de ${formatCurrency(avg)}).`,
          actionable: true,
          areaId: area.id,
          areaName: area.name,
          category: null,
          month: target,
          current: 0,
          suggested,
        });
      }
      continue;
    }

    if (area.monthlyBudget <= 0) continue;

    // excedida: si se repite varios meses el límite es irreal, no el gasto
    const overMonths = hist.filter((h) => h.month !== target && h.amount > area.monthlyBudget).length;
    if (spent > area.monthlyBudget) {
      const avg = averageOf(hist, target);
      if (overMonths >= 2 && avg > area.monthlyBudget) {
        const suggested = round(avg * 1.05);
        proposals.push({
          id: `budget-low:${area.id}:${target}`,
          kind: "adjust_budget",
          title: `El presupuesto de ${area.name} está muy bajo`,
          detail: `Te excediste ${overMonths} meses seguidos y promedias ${formatCurrency(avg)}, por encima de tu límite de ${formatCurrency(area.monthlyBudget)}.`,
          impact: `Subirlo a ${formatCurrency(suggested)} para que sea un tope realista.`,
          actionable: true,
          areaId: area.id,
          areaName: area.name,
          category: null,
          month: target,
          current: area.monthlyBudget,
          suggested,
        });
      } else {
        proposals.push({
          id: `budget-over:${area.id}:${target}`,
          kind: "adjust_budget",
          title: `${area.name} se pasó este mes`,
          detail: `Gastaste ${formatCurrency(spent)} de ${formatCurrency(area.monthlyBudget)}. ${topCategory(hist)}`,
          impact: `Si vuelve a pasar, el límite sí está muy bajo. Por ahora el problema es el gasto, no el presupuesto.`,
          actionable: false,
          areaId: area.id,
          areaName: area.name,
          category: null,
          month: target,
          current: area.monthlyBudget,
          suggested: null,
        });
      }
    }
  }

  // --- 3. tope general ----------------------------------------------------
  if (plannedTotal <= 0 && totalBudget > 0) {
    proposals.push({
      id: `total:${target}`,
      kind: "set_total",
      title: "No tienes un tope general de gasto",
      detail: `Tus áreas suman ${formatCurrency(totalBudget)} al mes, pero no hay un tope propio que compare contra el total.`,
      impact: `Fijar ${formatCurrency(totalBudget)} como tope de ${monthLabel(target)}.`,
      actionable: true,
      areaId: null,
      areaName: null,
      category: null,
      month: target,
      current: 0,
      suggested: totalBudget,
    });
  } else if (plannedTotal > 0 && totalBudget < plannedTotal) {
    proposals.push({
      id: `total-unallocated:${target}`,
      kind: "set_total",
      title: "Te falta repartir parte del tope",
      detail: `Tu tope de ${monthLabel(target)} es ${formatCurrency(plannedTotal)} pero las áreas solo cubren ${formatCurrency(totalBudget)}.`,
      impact: `${formatCurrency(plannedTotal - totalBudget)} no está asignado a ningún área.`,
      actionable: false,
      areaId: null,
      areaName: null,
      category: null,
      month: target,
      current: plannedTotal,
      suggested: null,
    });
  }

  return proposals;
}

function topCategory(hist: { month: string; amount: number }[]): string {
  const last = hist.filter((h) => h.amount > 0).slice(-3);
  if (last.length === 0) return "";
  return `En los últimos ${last.length} meses con gasto: ${last.map((h) => `${monthLabel(h.month)} ${formatCurrency(h.amount)}`).join(", ")}.`;
}

/** Promedio de los meses con gasto, sin contar los meses en cero. */
function averageOf(hist: { month: string; amount: number }[], currentMonth: string): number {
  const withSpending = hist.filter((h) => h.month !== currentMonth && h.amount > 0);
  if (withSpending.length === 0) return 0;
  return withSpending.reduce((s, h) => s + h.amount, 0) / withSpending.length;
}

/**
 * Últimos 6 meses de gasto por área terminando en `targetMonth`, para ver si un
 * exceso se repite. La ventana se ancla en el mes que se está mirando, no en
 * hoy: al navegar a un mes pasado no debe promediar meses que aún no ocurren.
 */
async function getHistory(
  uid: string,
  targetMonth: string,
): Promise<Map<string, { month: string; amount: number }[]>> {
  const [areas, mappings] = await Promise.all([
    db.lifeArea.findMany({ where: { userId: uid }, select: { id: true } }),
    db.categoryArea.findMany({ where: { userId: uid }, select: { category: true, areaId: true } }),
  ]);

  const areaByCategory = new Map<string, string>();
  for (const m of mappings) areaByCategory.set(m.category.trim().toLowerCase(), m.areaId);

  const [ty = 1970, tm = 1] = targetMonth.split("-").map(Number);
  const keys: string[] = [];
  for (let i = -5; i <= 0; i++) {
    keys.push(monthKey(new Date(ty, tm - 1 + i, 1)));
  }

  const first = monthRange(keys[0]!).start;
  const end = monthRange(targetMonth).end;

  const expenses = await db.financeRecord.findMany({
    where: { userId: uid, type: "expense", date: { gte: first, lt: end } },
    select: { category: true, amount: true, date: true },
  });

  const out = new Map<string, { month: string; amount: number }[]>();
  for (const a of areas) out.set(a.id, keys.map((k) => ({ month: k, amount: 0 })));

  for (const e of expenses) {
    const key = monthKey(e.date);
    const cat = (e.category ?? "").trim();
    const areaId = cat ? areaByCategory.get(cat.toLowerCase()) : undefined;
    if (!areaId) continue;
    const series = out.get(areaId);
    if (!series) continue;
    const slot = series.find((s) => s.month === key);
    if (slot) slot.amount += e.amount;
  }

  return out;
}

/**
 * Aplica una propuesta. Vuelve a derivarla desde la base en vez de confiar en
 * los datos queία NAF Envió el cliente: si el estado ya cambió, la propuesta
 * caducó y se rechaza en vez de escribir algo obsoleto.
 */
export async function applyFinanceProposal(id: string): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: "No autenticado" };

  const proposals = await getFinanceProposals();
  const p = proposals.find((x) => x.id === id);

  if (!p) return { ok: false, message: "Esta propuesta ya no aplica, los datos cambiaron." };
  if (!p.actionable) return { ok: false, message: "Esto es solo una sugerencia, no se puede aplicar." };

  try {
    if (p.kind === "assign_category") {
      if (!p.areaId || !p.category) return { ok: false, message: "Propuesta incompleta" };
      const cat = p.category;
      await db.categoryArea.deleteMany({
        where: { userId: session.id, category: { equals: cat, mode: "insensitive" } },
      });
      await db.categoryArea.create({
        data: { userId: session.id, category: cat, areaId: p.areaId },
      });
    } else if (p.kind === "adjust_budget") {
      if (!p.areaId || p.suggested === null) return { ok: false, message: "Propuesta incompleta" };
      await db.lifeArea.updateMany({
        where: { id: p.areaId, userId: session.id },
        data: { monthlyBudget: p.suggested },
      });
    } else if (p.kind === "set_total") {
      if (p.suggested === null) return { ok: false, message: "Propuesta incompleta" };
      await db.monthlyBudget.upsert({
        where: { userId_month: { userId: session.id, month: p.month } },
        create: { userId: session.id, month: p.month, amount: p.suggested },
        update: { amount: p.suggested },
      });
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo aplicar" };
  }

  revalidatePath("/contabilidad/areas");
  revalidatePath("/contabilidad/ia");
  revalidatePath("/contabilidad");
  return { ok: true, message: "Aplicado" };
}
