"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  getAiMode,
  buildFinanceContext,
  runGeminiChat,
  runGeminiAnalysis,
  type ChatTurn,
  type FinanceContext,
} from "@/lib/ai";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export type AiAlertInfo = {
  id: string;
  title: string;
  message: string;
  category: string;
  source: string;
  isRead: boolean;
  createdAt: Date;
};

type DetectedAlert = {
  title: string;
  message: string;
  category: string;
  dedupeKey: string;
};

function monthLabel(m: string): string {
  return new Date(m + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export async function getAiModeAction(): Promise<"gemini" | "rules"> {
  const session = await getSession();
  if (!session) return "rules";
  return getAiMode();
}

function detectRuleAlerts(ctx: FinanceContext): DetectedAlert[] {
  const alerts: DetectedAlert[] = [];
  const cur = ctx.currentMonth;
  const last = ctx.lastMonth;
  const cm = cur.month;
  const pm = prevMonthKey(cm);

  if (last.income > 0 && last.expenses > 0 && cur.expenses > last.expenses * 1.2) {
    alerts.push({
      title: "Gasto del mes en aumento",
      message: `En ${monthLabel(cm)} llevas ${formatCurrency(cur.expenses)} gastados, un ${Math.round((cur.expenses / last.expenses - 1) * 100)}% más que en ${monthLabel(pm)} (${formatCurrency(last.expenses)}). Revisa tus gastos discrecionales.`,
      category: "spending",
      dedupeKey: `spending-${cm}`,
    });
  }

  const totalMonthExpenses = cur.expenses;
  if (totalMonthExpenses > 0) {
    const top = ctx.monthCategories[0];
    if (top && top.percentage > 40) {
      alerts.push({
        title: "Gasto concentrado en una categoría",
        message: `La categoría "${top.category}" representa el ${top.percentage.toFixed(0)}% de tus gastos totales. Considera reducirla.`,
        category: "budget",
        dedupeKey: `budget-${cm}-${top.category}`,
      });
    }
  }

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const f of ctx.fixedExpenses) {
    if (!f.isActive) continue;
    let due = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), f.dayDue);
    if (due < today) {
      const next = new Date(due);
      next.setUTCMonth(next.getUTCMonth() + 1);
      due = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), f.dayDue);
    }
    const days = Math.round((due - today) / 86400000);
    if (days >= 0 && days <= 3) {
      alerts.push({
        title: `Vence pronto: ${f.name}`,
        message: `El gasto fijo "${f.name}" de ${formatCurrency(f.amount)} vence en ${days === 0 ? "hoy" : days === 1 ? "1 día" : `${days} días`} (día ${f.dayDue}).`,
        category: "fixed_due",
        dedupeKey: `fixed-${f.name}`,
      });
    }
  }

  for (const d of ctx.debts) {
    if (!d.isActive || !d.dueDate) continue;
    const due = Date.parse(d.dueDate + "T00:00:00Z");
    const days = Math.round((due - today) / 86400000);
    if (days >= 0 && days <= 7) {
      const remaining = d.totalAmount - d.paidAmount;
      alerts.push({
        title: `Deuda por vencer: ${d.name}`,
        message: `La deuda "${d.name}" vence en ${days === 0 ? "hoy" : `${days} día(s)`}. Te restan ${formatCurrency(remaining)}.`,
        category: "debt_due",
        dedupeKey: `debt-${d.name}`,
      });
    }
  }

  if (cur.expenses > cur.income) {
    alerts.push({
      title: "Déficit este mes",
      message: `En ${monthLabel(cm)} gastaste ${formatCurrency(cur.expenses)} e ingresaste ${formatCurrency(cur.income)}: déficit de ${formatCurrency(cur.expenses - cur.income)}.`,
      category: "deficit",
      dedupeKey: `deficit-${cm}`,
    });
  }

  if (cur.income > 0 && cur.expenses / cur.income > 0.85) {
    alerts.push({
      title: "Margen de ahorro muy bajo",
      message: `En ${monthLabel(cm)} tus gastos representan el ${Math.round((cur.expenses / cur.income) * 100)}% de tus ingresos. Queda poco margen para ahorrar.`,
      category: "budget",
      dedupeKey: `budget-${cm}`,
    });
  }

  return alerts;
}

async function runDetector(ctx: FinanceContext) {
  const mode = getAiMode();
  if (mode === "gemini") {
    try {
      const analysis = await runGeminiAnalysis(ctx);
      return analysis.alertas.map((a, i): DetectedAlert => ({
        title: "Alerta de IA",
        message: a,
        category: "insight",
        dedupeKey: `gemini-${currentMonthKey()}-${i}-${simpleHash(a.slice(0, 60))}`,
      }));
    } catch {
      return detectRuleAlerts(ctx);
    }
  }
  return detectRuleAlerts(ctx);
}

export async function getActiveAIAlerts(): Promise<AiAlertInfo[]> {
  const session = await getSession();
  if (!session) return [];

  const ctx = await buildFinanceContext();
  const detected = await runDetector(ctx);

  for (const a of detected) {
    await db.aiAlert.upsert({
      where: {
        userId_category_dedupeKey: {
          userId: session.id,
          category: a.category,
          dedupeKey: a.dedupeKey,
        },
      },
      update: {},
      create: { ...a, userId: session.id },
    });
  }

  const alerts = await db.aiAlert.findMany({
    where: { userId: session.id, isRead: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return alerts.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    category: a.category,
    source: a.source,
    isRead: a.isRead,
    createdAt: a.createdAt,
  }));
}

export async function getUnreadAIAlertCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;
  return db.aiAlert.count({ where: { userId: session.id, isRead: false } });
}

export async function markAIAlertRead(id: string) {
  const session = await getSession();
  if (!session) return;
  await db.aiAlert.updateMany({ where: { id, userId: session.id }, data: { isRead: true } });
}

export async function markAllAIAlertsRead() {
  const session = await getSession();
  if (!session) return;
  await db.aiAlert.updateMany({ where: { userId: session.id, isRead: false }, data: { isRead: true } });
}

function rulesReply(question: string, ctx: FinanceContext): string {
  const q = question.toLowerCase();
  const lines: string[] = [];

  if (q.includes("deuda") || q.includes("pagar")) {
    const active = ctx.debts.filter((d) => d.isActive);
    if (active.length === 0) {
      lines.push("¡Buenas noticias! No tienes deudas activas. Puedes enfocar tu dinero en ahorro e inversión.");
    } else {
      lines.push(`Tienes ${active.length} deuda(s) activa(s). Esta es mi recomendación de orden de pago:`);
      const sorted = [...active].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
      sorted.forEach((d, i) => {
        const remaining = d.totalAmount - d.paidAmount;
        lines.push(
          `${i + 1}. ${d.name} — restan ${formatCurrency(remaining)}${d.interestRate != null ? ` con interés del ${d.interestRate}%` : ""}.`,
        );
      });
      lines.push("Prioriza la de mayor interés. Destina pagos adicionales en cuanto tengas superávit.");
    }
  } else if (q.includes("ahorr") || q.includes("recort") || q.includes("reducir")) {
    if (ctx.monthCategories.length === 0) {
      lines.push("Aún no registras gastos categorizados. Registra tus gastos para que pueda sugerirte dónde recortar.");
    } else {
      lines.push("Tus mayores categorías de gasto son:");
      ctx.monthCategories.slice(0, 4).forEach((c) => {
        lines.push(`- ${c.category}: ${formatCurrency(c.amount)} (${c.percentage.toFixed(1)}%)`);
      });
      lines.push("Sugerencias: revisa suscripciones o servicios que no uses (gastos fijos) y negocia tarifas recurrentes.");
    }
  } else if (q.includes("mes") || q.includes("marzo") || q.includes("julio") || q.includes("agosto")) {
    lines.push(`Estado de ${monthLabel(ctx.currentMonth.month)}:`);
    lines.push(`- Ingresos: ${formatCurrency(ctx.currentMonth.income)}`);
    lines.push(`- Gastos: ${formatCurrency(ctx.currentMonth.expenses)}`);
    lines.push(`- Balance del mes: ${formatCurrency(ctx.currentMonth.income - ctx.currentMonth.expenses)}`);
    if (ctx.lastMonth.income > 0 || ctx.lastMonth.expenses > 0) {
      lines.push(
        `El mes anterior (${monthLabel(ctx.lastMonth.month)}): ingresos ${formatCurrency(ctx.lastMonth.income)}, gastos ${formatCurrency(ctx.lastMonth.expenses)}.`,
      );
    }
  } else if (q.includes("balance") || q.includes("cómo voy") || q.includes("estado")) {
    lines.push(`Resumen general:`);
    lines.push(`- Ingresos totales: ${formatCurrency(ctx.summary.totalIncome)}`);
    lines.push(`- Gastos totales: ${formatCurrency(ctx.summary.totalExpenses)}`);
    lines.push(`- Balance histórico: ${formatCurrency(ctx.summary.balance)}`);
    lines.push(`- Gastos fijos activos: ${formatCurrency(ctx.summary.totalFixedExpenses)}/mes`);
    if (ctx.summary.activeDebtsCount > 0) {
      lines.push(`- Deudas activas: ${ctx.summary.activeDebtsCount} (${formatCurrency(ctx.summary.totalDebtRemaining)} pendiente)`);
    }
    if (ctx.summary.balance < 0) {
      lines.push("Tu balance es negativo. Prioriza reducir gastos y saldar deudas.");
    } else {
      lines.push("Tienes balance positivo. Considera destinar un porcentaje al ahorro.");
    }
  } else {
    lines.push(`Tu estado financiero: ingresaste ${formatCurrency(ctx.summary.totalIncome)} y gastaste ${formatCurrency(ctx.summary.totalExpenses)} (balance ${formatCurrency(ctx.summary.balance)}).`);
    if (ctx.monthCategories[0]) {
      lines.push(`Tu mayor gasto está en "${ctx.monthCategories[0].category}" con ${formatCurrency(ctx.monthCategories[0].amount)} (${ctx.monthCategories[0].percentage.toFixed(1)}%).`);
    }
    if (ctx.summary.totalFixedExpenses > 0) {
      lines.push(`Tienes ${formatCurrency(ctx.summary.totalFixedExpenses)} en gastos fijos mensuales.`);
    }
    lines.push("Puedes preguntarme: \"¿cómo voy este mes?\", \"¿qué deuda pago primero?\" o \"¿dónde puedo recortar gastos?\".");
  }

  return lines.join("\n");
}

export async function askFinanceAI(
  question: string,
  history: ChatTurn[],
): Promise<{ reply: string; mode: "gemini" | "rules" }> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const mode = getAiMode();
  if (mode === "gemini") {
    try {
      const reply = await runGeminiChat(question, history);
      return { reply, mode };
    } catch {
      // fallback a reglas si Gemini falla
    }
  }

  const ctx = await buildFinanceContext();
  return { reply: rulesReply(question, ctx), mode: "rules" };
}

export async function runWeeklyAnalysis() {
  const session = await getSession();
  if (!session) return { ok: false, error: "No autenticado" };
  const count = await runDetectorForUser(session.id);
  return { ok: true, created: count };
}

export async function runDetectorForUser(userId: string): Promise<number> {
  const ctx = await buildFinanceContext(userId);
  const detected = await runDetector(ctx);

  for (const a of detected) {
    await db.aiAlert.upsert({
      where: {
        userId_category_dedupeKey: {
          userId,
          category: a.category,
          dedupeKey: a.dedupeKey,
        },
      },
      update: {},
      create: { ...a, userId },
    });
  }

  return detected.length;
}
