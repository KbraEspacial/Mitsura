/**
 * Reglas de clasificacion automatica de movimientos.
 *
 * Motivo: los "ingresos" historicos mezclaban tres cosas distintas:
 *   1. Ingreso real (sueldo, nomina)
 *   2. Prestamos otorgados a terceros (es un receivable, no un ingreso)
 *   3. Transferencias entre cuentas propias (el dinero ya era tuyo)
 *
 * Mezclar 2 y 3 en el total hace que la suma nunca cuadre con el saldo real.
 * Estas reglas detectan 2 y 3 por patron de descripcion para no depender de
 * que el usuario marque cada registro a mano.
 *
 * Este archivo es puro (sin "use server") porque se importa desde acciones.
 */

export type Verdict = "income" | "notIncome" | "review";

export type Classification = {
  verdict: Verdict;
  label: string;
  matched: string | null;
};

/** Patrones con confianza alta: se auto-excluyen del saldo. */
const NOT_INCOME: { re: RegExp; label: string }[] = [
  { re: /pr[eé]stamo/i, label: "Prestamo otorgado: es plata que sale, no entra" },
  { re: /\bmoto\b|cuota\s+moto|moto\s+cuota/i, label: "Abono o cuota de moto: repago de deuda" },
  {
    re: /mesesito|traslado|traspaso|entre\s+mis\s+cuentas|mis\s+cuentas|cambio\s+de\s+cuenta/i,
    label: "Transferencia entre cuentas propias: el dinero ya era tuyo",
  },
  { re: /reintegro|devoluci[oó]n/i, label: "Reintegro o devolucion de un gasto" },
  { re: /saldo\s+(a\s+favor|en\s+contra)|saldo\s+inicial/i, label: "Ajuste de saldo bancario, no un ingreso" },
];

/** Patrones dudosos: se sugieren pero el usuario confirma. */
const REVIEW: { re: RegExp; label: string }[] = [
  { re: /ajuste/i, label: "Ajuste: podria ser un cobro real o un movimiento interno" },
  { re: /restante|saldo\s+a\s+ favor/i, label: "Ajuste de leftover: revisalo" },
  { re: /^pago\s+(de\s+)?\w+|^pago\s+\w+$/i, label: "Recibo de un pago a terceros: podria ser repago" },
];

/**
 * Clasifica un movimiento por su descripcion.
 * Solo aplica a ingresos: los gastos siempre cuentan negativo.
 */
export function classifyDescription(description: string | null | undefined): Classification {
  const text = (description ?? "").trim();
  if (!text) return { verdict: "income", label: "Sin descripcion", matched: null };

  for (const rule of NOT_INCOME) {
    const m = text.match(rule.re);
    if (m) return { verdict: "notIncome", label: rule.label, matched: m[0] };
  }
  for (const rule of REVIEW) {
    const m = text.match(rule.re);
    if (m) return { verdict: "review", label: rule.label, matched: m[0] };
  }
  return { verdict: "income", label: "Ingreso real", matched: null };
}

/** Cuantos movimientos de una lista quedarian excluidos con las reglas. */
export function countAutoExclusions(
  items: { description: string | null; type: string; excludeFromBalance: boolean }[],
): { toExclude: number; toRestore: number; suggestions: { description: string; amount: number; label: string }[] } {
  let toExclude = 0;
  let toRestore = 0;
  const suggestions: { description: string; amount: number; label: string }[] = [];

  for (const it of items) {
    if (it.type !== "income") continue;
    const c = classifyDescription(it.description);
    if (c.verdict === "notIncome" && !it.excludeFromBalance) {
      toExclude++;
      suggestions.push({ description: it.description ?? "(sin descripcion)", amount: (it as { amount?: number }).amount ?? 0, label: c.label });
    }
    if (c.verdict === "income" && it.excludeFromBalance && !REVIEW.some((r) => r.re.test(it.description ?? ""))) {
      toRestore++;
    }
  }
  return { toExclude, toRestore, suggestions };
}
