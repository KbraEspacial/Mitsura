/**
 * Conciliacion automatica: empareja los movimientos del banco con los que ya
 * estan en la app y dice que falta por cada lado.
 *
 * Reglas de emparejamiento (en orden de confianza):
 *   1. Mismo monto + misma direccion + fecha dentro de +/- DIAS_TOLERANCIA
 *   2. Ademas, la descripcion del banco debe parecerse a la de la app
 *      (similitud de palabras o inclusion del texto normalizado)
 *
 * Lo que NO hace: decide el saldo. El saldo siempre lo da el banco, y se
 * guarda como ancla en BalanceReconciliation.
 */

import { normalizeText, type ParsedLine } from "./statement-parser";

export const DIAS_TOLERANCIA = 3;
const MONTO_EXACTO = 1;

export type MovimientoApp = {
  id: string;
  date: Date;
  amount: number;
  type: "income" | "expense";
  description: string;
  category?: string | null;
};

export type Coincidencia = {
  linea: ParsedLine;
  movimientoId: string;
  movimientoDate: Date;
  movimientoDescription: string;
  confianza: "alta" | "media";
  diasDeDiferencia: number;
};

export type Sugerencia = {
  linea: ParsedLine;
  category: string | null;
  categoryProbable: string;
  confianza: "alta" | "media" | "baja";
};

export type ResultadoConciliacion = {
  conciliadas: Coincidencia[];
  faltantesEnApp: Sugerencia[];
  sobrantesEnApp: MovimientoApp[];
  duplicadosInternos: ParsedLine[];
  sinFecha: ParsedLine[];
};

/** Similitud por palabras compartidas: 0 = nada, 1 = identico. */
export function similitud(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const pa = new Set(na.split(" ").filter((w) => w.length > 2));
  const pb = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (pa.size === 0 || pb.size === 0) return 0;

  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return comunes / Math.min(pa.size, pb.size);
}

function diasEntre(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

function montoCoincide(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONTO_EXACTO;
}

/**
 * Un movimiento de la app ya usado no puede volver a emparejarse: evita que
 * dos renglones iguales del banco se enganchen al mismo registro.
 */
export function conciliar(
  lineas: ParsedLine[],
  movimientos: MovimientoApp[],
  opts: { categorias?: string[] } = {},
): ResultadoConciliacion {
  const categorias = opts.categorias ?? [];
  const movUsados = new Set<string>();
  const lineasUsadas = new Set<number>();

  // 1) Generamos todos los pares candidatas (mismo monto, mismo tipo, +/- N dias).
  type Candidato = { i: number; mov: MovimientoApp; sim: number; dif: number };
  const candidatos: Candidato[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]!;
    if (!l.date) continue;
    const tipo = l.direction === "in" ? "income" : "expense";
    for (const mov of movimientos) {
      if (mov.type !== tipo) continue;
      if (!montoCoincide(l.amount, mov.amount)) continue;
      const dif = diasEntre(l.date, mov.date);
      if (dif > DIAS_TOLERANCIA) continue;
      candidatos.push({ i, mov, sim: similitud(l.description, mov.description), dif });
    }
  }

  // 2) Resolvemos de mejor a peor: descripcion mas parecida y fecha mas exacta.
  //    Asi un renglon flojo no se queda con un registro que otro cubria mejor.
  candidatos.sort((a, b) => (b.sim !== a.sim ? b.sim - a.sim : a.dif - b.dif));

  const conciliadas: Coincidencia[] = [];
  const ACEPTADA = 0.45;
  for (const c of candidatos) {
    if (movUsados.has(c.mov.id) || lineasUsadas.has(c.i)) continue;
    if (c.sim < ACEPTADA) continue;
    movUsados.add(c.mov.id);
    lineasUsadas.add(c.i);
    conciliadas.push({
      linea: lineas[c.i]!,
      movimientoId: c.mov.id,
      movimientoDate: c.mov.date,
      movimientoDescription: c.mov.description,
      confianza: c.sim >= 0.7 ? "alta" : "media",
      diasDeDiferencia: c.dif,
    });
  }

  // 3) Renglones del banco sin pareja -> movimientos que faltan en la app.
  const faltantesEnApp: Sugerencia[] = [];
  const sinFecha: ParsedLine[] = [];

  for (let i = 0; i < lineas.length; i++) {
    if (lineasUsadas.has(i)) continue;
    const l = lineas[i]!;
    if (!l.date) {
      sinFecha.push(l);
      continue;
    }
    const categoryProbable = categorias.find((c) => similitud(l.description, c) >= 0.6) ?? "";
    faltantesEnApp.push({
      linea: l,
      category: categoryProbable || null,
      categoryProbable: categoryProbable || "Sin categoría",
      confianza: categoryProbable ? "media" : "baja",
    });
  }

  // 4) Movimientos de la app que el banco no muestra.
  //    Solo cuentan los que caen DENTRO del periodo del estado de cuenta: un
  //    movimiento de otra fecha simplemente no lo cubre este extracto, y
  //    reportarlo como sobra seria ruido.
  const fechas = lineas.map((l) => l.date).filter((d): d is Date => !!d);
  const desde = fechas.length ? new Date(Math.min(...fechas.map((d) => d.getTime()))) : null;
  const hasta = fechas.length ? new Date(Math.max(...fechas.map((d) => d.getTime()))) : null;
  const dentroDelPeriodo = (d: Date) =>
    !!desde && !!hasta && d.getTime() >= desde.getTime() && d.getTime() <= hasta.getTime();

  const sobrantesEnApp = movimientos.filter((m) => !movUsados.has(m.id) && dentroDelPeriodo(m.date));

  // 5) Renglones identicos repetidos dentro del propio estado de cuenta.
  const duplicadosInternos: ParsedLine[] = [];
  const vistos = new Map<string, number>();
  for (const l of lineas) {
    const clave = `${l.date?.toISOString().slice(0, 10) ?? "?"}|${l.direction}|${l.amount}|${normalizeText(l.description)}`;
    const n = vistos.get(clave) ?? 0;
    if (n === 1) duplicadosInternos.push(l);
    vistos.set(clave, n + 1);
  }

  return { conciliadas, faltantesEnApp, sobrantesEnApp, duplicadosInternos, sinFecha };
}

/** Total esperado segun el estado de cuenta, partiendo de un saldo inicial. */
export function totalEsperado(saldoInicial: number, lineas: ParsedLine[]): number {
  return lineas.reduce(
    (acc, l) => (l.direction === "in" ? acc + l.amount : l.direction === "out" ? acc - l.amount : acc),
    saldoInicial,
  );
}
