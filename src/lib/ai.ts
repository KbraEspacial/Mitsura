import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export type AiMode = "gemini" | "rules";

export function getAiMode(): AiMode {
  return process.env.GEMINI_API_KEY ? "gemini" : "rules";
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  GEMINI_MODEL +
  ":generateContent";

export type ChatTurn = { role: "user" | "model"; content: string };

export type FinanceContext = {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalFixedExpenses: number;
    balance: number;
    activeDebtsCount: number;
    totalDebtRemaining: number;
  };
  currentMonth: { month: string; income: number; expenses: number };
  lastMonth: { month: string; income: number; expenses: number };
  monthly: { month: string; income: number; expenses: number }[];
  monthCategories: { category: string; amount: number; percentage: number }[];
  fixedExpenses: { name: string; amount: number; dayDue: number; isActive: boolean }[];
  debts: {
    name: string;
    totalAmount: number;
    paidAmount: number;
    interestRate: number | null;
    dueDate: string | null;
    isActive: boolean;
  }[];
  recentRecords: {
    type: string;
    amount: number;
    description: string;
    category: string | null;
    date: string;
  }[];
};

export async function buildFinanceContext(userId?: string): Promise<FinanceContext> {
  const session = userId ? null : await getSession();
  const uid = userId ?? session?.id;
  if (!uid) throw new Error("No autenticado");

  const records = await db.financeRecord.findMany({
    where: { userId: uid },
    orderBy: { date: "desc" },
    select: { type: true, amount: true, description: true, category: true, date: true },
  });

  const fixedExpenses = await db.fixedExpense.findMany({
    where: { userId: uid },
    orderBy: { dayDue: "asc" },
    select: { name: true, amount: true, dayDue: true, isActive: true },
  });

  const debts = await db.debt.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      totalAmount: true,
      paidAmount: true,
      interestRate: true,
      dueDate: true,
      isActive: true,
    },
  });

  const totalIncome = records
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amount, 0);
  const totalExpenses = records
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);
  const totalFixedExpenses = fixedExpenses
    .filter((f) => f.isActive)
    .reduce((s, f) => s + f.amount, 0);
  const activeDebts = debts.filter((d) => d.isActive);
  const totalDebtRemaining = activeDebts.reduce(
    (s, d) => s + (d.totalAmount - d.paidAmount),
    0,
  );

  const monthlyMap: Record<string, { income: number; expenses: number }> = {};
  for (const r of records) {
    const key = `${r.date.getUTCFullYear()}-${String(r.date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 };
    if (r.type === "income") monthlyMap[key].income += r.amount;
    else if (r.type === "expense") monthlyMap[key].expenses += r.amount;
  }
  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  const now = new Date();
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const lastDate = new Date(now);
  lastDate.setUTCMonth(lastDate.getUTCMonth() - 1);
  const lastKey = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const currentMonth = monthlyMap[currentKey] ?? { income: 0, expenses: 0 };
  const lastMonth = monthlyMap[lastKey] ?? { income: 0, expenses: 0 };

  const catMap: Record<string, number> = {};
  for (const r of records) {
    if (r.type !== "expense") continue;
    const cat = r.category || "Sin categoría";
    catMap[cat] = (catMap[cat] ?? 0) + r.amount;
  }
  const catTotal = Object.values(catMap).reduce((s, a) => s + a, 0);
  const monthCategories = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: catTotal > 0 ? (amount / catTotal) * 100 : 0,
    }));

  return {
    summary: {
      totalIncome,
      totalExpenses,
      totalFixedExpenses,
      balance: totalIncome - totalExpenses,
      activeDebtsCount: activeDebts.length,
      totalDebtRemaining,
    },
    currentMonth: { month: currentKey, ...currentMonth },
    lastMonth: { month: lastKey, ...lastMonth },
    monthly,
    monthCategories,
    fixedExpenses,
    debts: debts.map((d) => ({
      ...d,
      dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null,
    })),
    recentRecords: records.slice(0, 20).map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
    })),
  };
}

export function contextToPrompt(ctx: FinanceContext): string {
  const monthLabel = (m: string) =>
    new Date(m + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

  const lines: string[] = [];
  lines.push(`# Datos financieros del usuario`);
  lines.push(`- Ingresos totales: ${formatCurrency(ctx.summary.totalIncome)}`);
  lines.push(`- Gastos totales: ${formatCurrency(ctx.summary.totalExpenses)}`);
  lines.push(`- Balance histórico: ${formatCurrency(ctx.summary.balance)}`);
  lines.push(`- Gastos fijos activos: ${formatCurrency(ctx.summary.totalFixedExpenses)}/mes`);
  lines.push(`- Deudas activas: ${ctx.summary.activeDebtsCount} (${formatCurrency(ctx.summary.totalDebtRemaining)} pendiente)`);

  if (ctx.monthly.length > 0) {
    lines.push(`- Ingresos de ${monthLabel(ctx.currentMonth.month)}: ${formatCurrency(ctx.currentMonth.income)}`);
    lines.push(`- Gastos de ${monthLabel(ctx.currentMonth.month)}: ${formatCurrency(ctx.currentMonth.expenses)}`);
    lines.push(`- Mes anterior: ingresos ${formatCurrency(ctx.lastMonth.income)}, gastos ${formatCurrency(ctx.lastMonth.expenses)}`);
  }

  if (ctx.monthCategories.length > 0) {
    lines.push(`- Gastos por categoría (total histórico):`);
    for (const c of ctx.monthCategories.slice(0, 6)) {
      lines.push(`  - ${c.category}: ${formatCurrency(c.amount)} (${c.percentage.toFixed(1)}%)`);
    }
  }

  if (ctx.fixedExpenses.some((f) => f.isActive)) {
    lines.push(`- Gastos fijos activos:`);
    for (const f of ctx.fixedExpenses.filter((x) => x.isActive)) {
      lines.push(`  - ${f.name}: ${formatCurrency(f.amount)} (día ${f.dayDue})`);
    }
  }

  const activeDebts = ctx.debts.filter((d) => d.isActive);
  if (activeDebts.length > 0) {
    lines.push(`- Deudas:`);
    for (const d of activeDebts) {
      const interest = d.interestRate != null ? `, interés ${d.interestRate}%` : "";
      const due = d.dueDate ? `, vence ${d.dueDate}` : "";
      lines.push(`  - ${d.name}: restante ${formatCurrency(d.totalAmount - d.paidAmount)}${interest}${due}`);
    }
  }

  return lines.join("\n");
}

export const FINANCE_SYSTEM_PROMPT = `Eres Mitsura AI, un asistente financiero personal experto que ayuda a personas en Colombia con su dinero.
Respondes SIEMPRE en español, de forma clara, práctica y empática.
Usas los datos financieros del usuario que se te proporcionan para responder con números reales.
Si no tienes datos suficientes para responder, dilo honestamente.
Formatea montos en pesos colombianos (COP) con formato de moneda colombiana.
Sé conciso: responde en máximo 3-4 párrafos o listas breves.
Puedes dar recomendaciones de ahorro, orden de pago de deudas (prioriza mayor interés), reducción de gastos y planificación.`;

async function geminiRequest(
  systemInstruction: string,
  contents: { role: "user" | "model"; parts: { text: string }[] }[],
): Promise<string> {
  const key = process.env.GEMINI_API_KEY!;
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    "No pude generar una respuesta. Intenta de nuevo."
  );
}

export async function runGeminiChat(
  question: string,
  history: ChatTurn[],
): Promise<string> {
  const ctx = await buildFinanceContext();
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [
    { role: "user", parts: [{ text: contextToPrompt(ctx) }] },
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.content }] })),
    { role: "user", parts: [{ text: question }] },
  ];
  return geminiRequest(FINANCE_SYSTEM_PROMPT, contents);
}

export async function runGeminiAnalysis(ctx: FinanceContext): Promise<{
  resumen: string;
  recomendaciones: string[];
  alertas: string[];
}> {
  const prompt = `${contextToPrompt(ctx)}\n\nAnaliza las finanzas del usuario y responde en JSON estricto con esta estructura (sin markdown, solo JSON):\n{"resumen": "...", "recomendaciones": ["..."], "alertas": ["..."]}\n\nIncluye: resumen del estado financiero actual, 2-4 recomendaciones accionables y 0-4 alertas detectadas.`;
  const raw = await geminiRequest(FINANCE_SYSTEM_PROMPT, [
    { role: "user", parts: [{ text: prompt }] },
  ]);
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      resumen: String(parsed.resumen ?? ""),
      recomendaciones: Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones.map(String) : [],
      alertas: Array.isArray(parsed.alertas) ? parsed.alertas.map(String) : [],
    };
  } catch {
    return { resumen: raw, recomendaciones: [], alertas: [] };
  }
}
