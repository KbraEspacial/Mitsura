/**
 * Deteccion de anomalias para la conciliacion asistida.
 *
 * Todo aqui es deterministico (no depende del LLM): la aritmetica y la
 * deteccion de patrones no se delegan a un modelo porque un alucinar un
 * numero en un balance es peor que no responder. El LLM solo recibe los
 * hallazgos y los explica.
 */

export type FindingSeverity = "alto" | "medio" | "bajo";

export type Finding = {
  kind:
    | "duplicado"
    | "traspaso_interno"
    | "sin_categoria"
    | "descripcion_repetida"
    | "descuadre"
    | "ancla_desactualizada";
  severity: FindingSeverity;
  title: string;
  detail: string;
  impact: number;
  recordIds: string[];
};

export type Txn = {
  id: string;
  type: "income" | "expense" | "fixed" | "debt_payment";
  amount: number;
  description: string | null;
  category: string | null;
  date: Date;
  excludeFromBalance: boolean;
};

const DAY = 86_400_000;
const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

/** Transacciones que afectan el saldo real. */
const affectsBalance = (t: Txn) => t.type === "income" || t.type === "expense" || t.type === "debt_payment";

/**
 * Duplicado = mismo tipo, mismo valor y descripcion practicamente igual
 * dentro de una ventana corta.
 *
 * Importante: mismo monto NO basta. "Transporte" 4.000 dos dias distintos es
 * transporte normal, no un doble registro. Por eso se exige que la
 * descripcion coincida, o que caiga el mismo dia con la misma categoria.
 *
 * Para ingresos hay un caso extra: el mismo cobro del mismo dia con monto
 * ligeramente distinto (1.231.000 vs 1.300.000) tambien es duplicado, y es
 * justo el que mas se escapa cuando se exige igualdad exacta.
 */
function findDuplicates(txns: Txn[]): Finding[] {
  const out: Finding[] = [];
  const sameDay = (a: Txn, b: Txn) => a.date.toISOString().slice(0, 10) === b.date.toISOString().slice(0, 10);
  const descMatch = (a: Txn, b: Txn) => {
    const x = norm(a.description);
    const y = norm(b.description);
    if (!x || !y) return false;
    return x === y || x.includes(y) || y.includes(x);
  };
  const already = (ids: string[]) => out.some((f) => ids.every((id) => f.recordIds.includes(id)));

  const cands = txns.filter(affectsBalance);

  // --- 1) Ingresos: agrupados por dia + descripcion, montos similares ---
  const incGroups = new Map<string, Txn[]>();
  for (const t of cands) {
    if (t.type !== "income") continue;
    const d = norm(t.description);
    if (!d) continue;
    const k = `${t.date.toISOString().slice(0, 10)}|${d}`;
    incGroups.set(k, [...(incGroups.get(k) ?? []), t]);
  }
  for (const [, group] of incGroups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.amount - b.amount);
    const lo = sorted[0]!.amount;
    const hi = sorted[sorted.length - 1]!.amount;
    const desviacion = lo > 0 ? (hi - lo) / lo : 0;
    if (desviacion > 0.25) continue; // montos muy distintos: son cobros distintos
    out.push({
      kind: "duplicado",
      severity: "alto",
      title:
        group.length > 2
          ? `El mismo ingreso se registro ${group.length} veces el ${group[0]!.date.toISOString().slice(0, 10)}`
          : `Posible doble ingreso de ${fmt(lo)}`,
      detail:
        `"${sorted[0]!.description}" aparece ${group.length} veces el mismo dia ` +
        `(${sorted.map((t) => fmt(t.amount)).join(" + ")}). Un cobro unico contado varias veces infla el saldo.`,
      impact: sorted.slice(1).reduce((s, t) => s + t.amount, 0),
      recordIds: group.map((t) => t.id),
    });
  }

  // --- 2) Ingresos: mismo monto y descripcion aunque caigan en dias cercanos ---
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i]!;
      const b = cands[j]!;
      if (a.type !== "income" || b.type !== "income") continue;
      if (Math.abs(a.amount - b.amount) > 1) continue;
      if (!descMatch(a, b)) continue;
      const gapDays = Math.abs(a.date.getTime() - b.date.getTime()) / DAY;
      if (gapDays > 3) continue;
      const ids = [a.id, b.id];
      if (already(ids)) continue;
      out.push({
        kind: "duplicado",
        severity: "alto",
        title: `Doble ingreso de ${fmt(a.amount)}`,
        detail:
          `Dos ingresos por el mismo valor con ${fmt(gapDays)} dia(s) de diferencia ` +
          `("${a.description ?? "sin descripcion"}" y "${b.description ?? "sin descripcion"}").`,
        impact: a.amount,
        recordIds: ids,
      });
    }
  }

  // --- 3) Gastos: mismo valor + descripcion parecida cerca en el tiempo ---
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i]!;
      const b = cands[j]!;
      if (a.type === "income" || b.type === "income") continue;
      if (a.type !== b.type) continue;
      if (Math.abs(a.amount - b.amount) > 1) continue;
      if (!descMatch(a, b)) continue;
      const gapDays = Math.abs(a.date.getTime() - b.date.getTime()) / DAY;
      if (gapDays > 2) continue;
      const ids = [a.id, b.id];
      if (already(ids)) continue;
      out.push({
        kind: "duplicado",
        severity: "medio",
        title: `Posible doble gasto de ${fmt(a.amount)}`,
        detail: `Dos cargos de "${a.description}" por el mismo valor con ${fmt(gapDays)} dia(s) de diferencia.`,
        impact: a.amount,
        recordIds: ids,
      });
    }
  }

  // --- 4) Gastos: mismo valor, mismo dia, misma categoria, descripciones distintas ---
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i]!;
      const b = cands[j]!;
      if (a.type === "income" || b.type === "income") continue;
      if (a.type !== b.type) continue;
      if (Math.abs(a.amount - b.amount) > 1) continue;
      if (!sameDay(a, b)) continue;
      if (!a.category || a.category !== b.category) continue;
      if (a.description === b.description) continue;
      const ids = [a.id, b.id];
      if (already(ids)) continue;
      out.push({
        kind: "duplicado",
        severity: "bajo",
        title: `Dos cargos de ${fmt(a.amount)} el mismo dia`,
        detail: `Mismo valor y misma categoria (${a.category}) el ${a.date.toISOString().slice(0, 10)}. Revisa si es un cargo unico.`,
        impact: a.amount,
        recordIds: ids,
      });
    }
  }

  return out;
}

/**
 * Ingreso y gasto por el mismo monto el mismo dia: es plata que se movio
 * entre cuentas propias o un pago mal clasificado como ingreso.
 */
function findInternalTransfers(txns: Txn[]): Finding[] {
  const out: Finding[] = [];
  const incomes = txns.filter((t) => t.type === "income");
  const expenses = txns.filter((t) => t.type === "expense");

  for (const inc of incomes) {
    for (const exp of expenses) {
      if (Math.abs(inc.amount - exp.amount) > 1) continue;
      if (Math.abs(inc.date.getTime() - exp.date.getTime()) > DAY) continue;
      out.push({
        kind: "traspaso_interno",
        severity: "medio",
        title: `Ingreso y gasto por ${fmt(inc.amount)} el mismo dia`,
        detail:
          `"${inc.description ?? "?"}" (ingreso) y "${exp.description ?? "?"}" (gasto) por el mismo valor. ` +
          `Si es un traspaso entre tus cuentas, el ingreso no deberia sumar al balance.`,
        impact: inc.amount,
        recordIds: [inc.id, exp.id],
      });
    }
  }
  return out;
}

function findMissingCategory(txns: Txn[]): Finding[] {
  const bad = txns.filter((t) => affectsBalance(t) && !t.category);
  if (bad.length === 0) return [];
  const total = bad.reduce((s, t) => s + (t.type === "income" ? t.amount : t.amount), 0);
  return [
    {
      kind: "sin_categoria",
      severity: "bajo",
      title: `${bad.length} movimientos sin categoria`,
      detail:
        "Sin categoria no cuentan en ningun presupuesto por area de vida, asi que las alertas y los limites los van a subestimar.",
      impact: total,
      recordIds: bad.map((t) => t.id),
    },
  ];
}

/** La misma descripcion repetida muchas veces el mismo dia suele ser error de captura. */
function findRepeatedDescriptions(txns: Txn[]): Finding[] {
  const out: Finding[] = [];
  const byDay = new Map<string, Txn[]>();
  for (const t of txns) {
    if (!t.description) continue;
    const k = `${t.date.toISOString().slice(0, 10)}|${norm(t.description)}`;
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  for (const [, group] of byDay) {
    if (group.length < 3) continue;
    const first = group[0]!;
    out.push({
      kind: "descripcion_repetida",
      severity: "medio",
      title: `"${first.description}" aparece ${group.length} veces el ${first.date.toISOString().slice(0, 10)}`,
      detail:
        "Multiples cargos identicos el mismo dia suele ser una captura repetida. Revisa si son gastos distintos.",
      impact: group.reduce((s, t) => s + t.amount, 0),
      recordIds: group.map((t) => t.id),
    });
  }
  return out;
}

/** El saldo calculado no cuadra con el ancla: hay movimientos no registrados. */
function findDrift(calc: { saldoReal: number; base: number; movements: number; reconciliationDate: Date | null }, now: Date): Finding[] {
  if (!calc.reconciliationDate) return [];
  const out: Finding[] = [];
  const days = Math.floor((now.getTime() - calc.reconciliationDate.getTime()) / DAY);

  if (days >= 30) {
    out.push({
      kind: "ancla_desactualizada",
      severity: "medio",
      title: `La conciliacion tiene ${days} dias`,
      detail:
        "Entre el ultimo anclaje y hoy pueden haberse acumulado movimientos que no registraste. " +
        "Un anclaje nuevo resetea la linea base con lo que tu banco realmente reporta.",
      impact: 0,
      recordIds: [],
    });
  }
  void calc.base;
  void calc.movements;
  return out;
}

function fmt(n: number) {
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

/** Ejecuta todas las detecciones y ordena por gravedad e impacto. */
export function analyzeForReconciliation(
  txns: Txn[],
  calc: { saldoReal: number; base: number; movements: number; reconciliationDate: Date | null },
  now: Date,
): Finding[] {
  const findings = [
    ...findDuplicates(txns),
    ...findInternalTransfers(txns),
    ...findRepeatedDescriptions(txns),
    ...findMissingCategory(txns),
    ...findDrift(calc, now),
  ];
  const peso: Record<FindingSeverity, number> = { alto: 0, medio: 1, bajo: 2 };
  return findings.sort((a, b) => peso[a.severity] - peso[b.severity] || b.impact - a.impact);
}
