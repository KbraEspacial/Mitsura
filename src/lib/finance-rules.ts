/**
 * Reglas de clasificacion automatica de movimientos.
 *
 * Antes estas reglas mezclaban dos preguntas distintas en una sola bandera
 * ("excludeFromBalance"), y por ahi el saldo nunca cuadraba:
 *
 *   1. ¿Es dinero real que tengo ahora?        -> afecta el saldo
 *   2. ¿Es dinero que me gané trabajando?      -> cuenta como ingreso
 *
 * Un prestamo que me devolvieron SI es dinero que tengo (1 = si) pero NO es
 * ingreso ganado (2 = no). Un traspaso entre mis cuentas tampoco es ingreso,
 * pero tampoco es plata que entra: el saldo no se mueve (1 = no).
 *
 * Por eso el veredicto tiene cuatro salidas y cada una se usa distinto.
 *
 * Este archivo es puro (sin "use server") porque se importa desde acciones.
 */

export type Verdict =
  /** Ingreso ganado: suma al saldo y cuenta como ingreso. */
  | "income"
  /** Plata real que llega pero no es ingreso ganado (repago, devolucion, ajuste). */
  | "cashOnly"
  /** No toca el saldo: traspaso entre cuentas propias o plata que sale. */
  | "notIncome"
  /** Dudoso: se deja como esta y el usuario lo revisa. */
  | "review";

export type Classification = {
  verdict: Verdict;
  label: string;
  matched: string | null;
};

/** Plata que entra de verdad pero no es ingreso ganado. */
const CASH_ONLY: { re: RegExp; label: string }[] = [
  {
    re: /me\s+prestaron|pr[eé]stamos?\s+(recibidos?|que\s+me|a\s+mi|de\s+\w+)|recib[ií]\s+(el\s+)?pr[eé]stamo|pr[eé]stamos?\s+(?!otorgad|entregad|a\s+terceros)\w+/i,
    label: "Prestamo recibido: es plata que tienes, pero no es ingreso",
  },
  {
    // "Pago moto" NO entra aqui: "pago" puede ser que el pago fue hacia la moto
    // (plata que sale). Eso queda en REVIEW para que lo mire el usuario.
    re: /cuota\s+(de\s+)?moto|abono\s+(a\s+)?(moto|vehiculo)|repago|abono\s+de\s+deuda/i,
    label: "Repago de deuda: entra la plata, no es ingreso",
  },
  { re: /reintegro|devoluci[oó]n/i, label: "Devolucion de un gasto: entra la plata, no es ingreso" },
  { re: /saldo\s+(a\s+favor|en\s+contra)|saldo\s+inicial|ajuste\s+de\s+saldo/i, label: "Ajuste de saldo del banco: no es ingreso" },
];

/** No debe mover el saldo. */
const NOT_INCOME: { re: RegExp; label: string }[] = [
  {
    re: /mesesito|traslado|traspaso|entre\s+mis\s+cuentas|mis\s+cuentas|cambio\s+de\s+cuenta/i,
    label: "Transferencia entre cuentas propias: el dinero ya era tuyo",
  },
  { re: /pr[eé]stamos?\s+(otorgados?|entregados?|a\s+terceros?)|retiro\s+para\s+prestar/i, label: "Prestamo otorgado a un tercero: es un receivable, no un ingreso" },
];

/** Dudosos: se sugieren pero el usuario confirma. */
const REVIEW: { re: RegExp; label: string }[] = [
  { re: /\bprest[oó]stamos?\b/i, label: "Prestamo sin clarity: ¿lo recibiste o lo entregaste?" },
  { re: /ajuste/i, label: "Ajuste: puede ser un cobro real o un movimiento interno" },
  { re: /^pago\s+(de\s+)?\w+/i, label: "Recibo de un pago: revisa si entra o sale" },
  { re: /transferencia|trasf\./i, label: "Transferencia: ¿entre tus cuentas o de otra persona?" },
];

const coincide = (rules: { re: RegExp; label: string }[], text: string) => {
  for (const rule of rules) {
    const m = text.match(rule.re);
    if (m) return { label: rule.label, matched: m[0] };
  }
  return null;
};

/**
 * Clasifica un movimiento por su descripcion.
 * Solo tiene sentido para ingresos: los gastos siempre cuentan negativo.
 */
export function classifyDescription(description: string | null | undefined): Classification {
  const text = (description ?? "").trim();
  if (!text) return { verdict: "income", label: "Sin descripcion", matched: null };

  // "notIncome" va primero: un traspaso entre cuentas propias no es ingreso
  // ganado, pero tampoco es plata que entra.
  const fuera = coincide(NOT_INCOME, text);
  if (fuera) return { verdict: "notIncome", ...fuera };

  const efectivo = coincide(CASH_ONLY, text);
  if (efectivo) return { verdict: "cashOnly", ...efectivo };

  const dudoso = coincide(REVIEW, text);
  if (dudoso) return { verdict: "review", ...dudoso };

  return { verdict: "income", label: "Ingreso real", matched: null };
}

/** Solo estos movimientos deben quedar fuera del saldo real. */
export function affectsCashBalance(description: string | null | undefined): boolean {
  return classifyDescription(description).verdict !== "notIncome";
}

/** Solo estos cuentan como ingreso ganado. */
export function countsAsEarnedIncome(description: string | null | undefined): boolean {
  return classifyDescription(description).verdict === "income";
}

export type ConteoClasificacion = {
  toExclude: number;
  toRestore: number;
  /** Platan que llega pero no es ingreso: conviene distinguirla en el resumen. */
  cashOnly: number;
  suggestions: { description: string; amount: number; label: string }[];
};

/** Cuantos movimientos de una lista cambiarian de bandera con las reglas. */
export function countAutoExclusions(
  items: { description: string | null; type: string; excludeFromBalance: boolean; amount?: number }[],
): ConteoClasificacion {
  let toExclude = 0;
  let toRestore = 0;
  let cashOnly = 0;
  const suggestions: { description: string; amount: number; label: string }[] = [];

  for (const it of items) {
    if (it.type !== "income") continue;
    const c = classifyDescription(it.description);

    if (c.verdict === "notIncome" && !it.excludeFromBalance) {
      toExclude++;
      suggestions.push({
        description: it.description ?? "(sin descripcion)",
        amount: it.amount ?? 0,
        label: c.label,
      });
    }
    if (c.verdict !== "notIncome" && it.excludeFromBalance) {
      toRestore++;
    }
    if (c.verdict === "cashOnly") cashOnly++;
  }
  return { toExclude, toRestore, cashOnly, suggestions };
}
