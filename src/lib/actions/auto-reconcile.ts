"use server";

/**
 * Conciliacion automatica contra el estado de cuenta.
 *
 * El usuario pega los movimientos de su banco y confirma el saldo que le
 * reporta la app del banco. Con eso la app puede:
 *   1. decir que movimientos ya tiene, cuales le faltan y cuales sobran
 *   2. crear los que faltan y fijar el saldo al valor real del banco
 *
 * Nada se escribe hasta que el usuario revisa el resumen y confirma.
 */

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseStatement, type ParsedLine } from "@/lib/statement-parser";
import { conciliar, totalEsperado, type ResultadoConciliacion } from "@/lib/statement-matcher";

const MAX_LINEAS = 500;

export type PreviewConciliacion = {
  ok: boolean;
  error?: string;
  parseadas: number;
  sinFecha: number;
  conciliadas: number;
  faltantes: number;
  sobrantes: number;
  duplicados: number;
  /** Renglones a crear: indice dentro del texto pegado, para re-analizar igual. */
  movimientos: {
    indice: number;
    date: string;
    amount: number;
    direction: "in" | "out";
    description: string;
    category: string | null;
  }[];
  detalleConciliadas: {
    fechaBanco: string;
    monto: number;
    banco: string;
    app: string;
    confianza: "alta" | "media";
    dias: number;
  }[];
  detalleSobrantes: { date: Date; amount: number; description: string; type: string }[];
  detalleDuplicados: { fecha: string; monto: number; description: string }[];
  lineasConError: { line: string; reason: string }[];
  /** Diferencia entre el saldo que dice el banco y el que impone el ancla. */
  saldoPropuesto: number;
  saldoBanco: number;
  diferencia: number;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Respuesta vacia para los casos en que ni siquiera hay algo que analizar. */
const previewVacio = (error: string, saldoBanco: number, lineasConError: { line: string; reason: string }[] = []): PreviewConciliacion => ({
  ok: false,
  error,
  parseadas: 0,
  sinFecha: 0,
  conciliadas: 0,
  faltantes: 0,
  sobrantes: 0,
  duplicados: 0,
  movimientos: [],
  detalleConciliadas: [],
  detalleSobrantes: [],
  detalleDuplicados: [],
  lineasConError,
  saldoPropuesto: 0,
  saldoBanco,
  diferencia: 0,
});

/**
 * Analiza el estado de cuenta sin escribir nada.
 * Cargar un rango amplio alrededor de las fechas del estado de cuenta evita
 * marcar como "sobrante" un movimiento de la app que simplemente no cae en el
 * periodo pegado.
 */
export async function previewStatement(
  statement: string,
  saldoBanco: number,
): Promise<PreviewConciliacion> {
  const session = await getSession();
  if (!session) return previewVacio("No autenticado", saldoBanco);

  if (!Number.isFinite(saldoBanco)) {
    return previewVacio("El saldo del banco no es un numero valido", 0);
  }

  const { lines, errors } = parseStatement(statement, { defaultDirection: "out" });
  if (lines.length === 0) {
    return previewVacio(
      "No encontre movimientos. Pega el estado de cuenta tal cual lo muestra tu banco.",
      saldoBanco,
      errors.slice(0, 10),
    );
  }

  // Solo miramos +/- 10 dias alrededor del estado de cuenta.
  const fechas = lines.map((l) => l.date).filter((d): d is Date => !!d);
  const min = fechas.length ? new Date(Math.min(...fechas.map((d) => d.getTime()))) : new Date();
  const max = fechas.length ? new Date(Math.max(...fechas.map((d) => d.getTime()))) : new Date();
  const desde = new Date(min.getTime() - 10 * 86_400_000);
  const hasta = new Date(max.getTime() + 10 * 86_400_000);

  const [registros, categorias] = await Promise.all([
    db.financeRecord.findMany({
      where: {
        userId: session.id,
        type: { in: ["income", "expense"] },
        date: { gte: desde, lte: hasta },
      },
      select: { id: true, date: true, amount: true, type: true, description: true, category: true },
      orderBy: { date: "asc" },
      take: 2000,
    }),
    db.categoryArea.findMany({
      where: { userId: session.id },
      select: { category: true },
    }),
  ]);

  const movimientos = registros
    .filter((r): r is typeof r & { type: "income" | "expense" } => r.type === "income" || r.type === "expense")
    .map((r) => ({
      id: r.id,
      date: r.date,
      amount: r.amount,
      type: r.type as "income" | "expense",
      description: r.description,
      category: r.category,
    }));

  const nombres = [...new Set(categorias.map((c) => c.category).filter((c) => !!c))];
  const r: ResultadoConciliacion = conciliar(lines, movimientos, { categorias: nombres });

  // Indices de los renglones que no se conciliaron, para poder crearlos.
  const indices: number[] = [];
  const infoPorLinea = new Map<ParsedLine, number>();
  lines.forEach((l, i) => infoPorLinea.set(l, i));
  for (const f of r.faltantesEnApp) {
    const i = infoPorLinea.get(f.linea);
    if (i !== undefined) indices.push(i);
  }

  const movimientosCrear = indices.map((i) => {
    const l = lines[i]!;
    const f = r.faltantesEnApp.find((x) => x.linea === l)!;
    return {
      indice: i,
      date: l.date ? iso(l.date) : "",
      amount: l.amount,
      direction: l.direction === "in" ? ("in" as const) : ("out" as const),
      description: l.description,
      category: f.category,
    };
  });

  const saldoPropuesto = totalEsperado(saldoBanco, lines);

  return {
    ok: true,
    parseadas: lines.length,
    sinFecha: r.sinFecha.length,
    conciliadas: r.conciliadas.length,
    faltantes: r.faltantesEnApp.length,
    sobrantes: r.sobrantesEnApp.length,
    duplicados: r.duplicadosInternos.length,
    movimientos: movimientosCrear,
    detalleConciliadas: r.conciliadas.map((c) => ({
      fechaBanco: c.linea.date ? iso(c.linea.date) : "",
      monto: c.linea.amount,
      banco: c.linea.description,
      app: c.movimientoDescription,
      confianza: c.confianza,
      dias: c.diasDeDiferencia,
    })),
    detalleSobrantes: r.sobrantesEnApp.map((s) => ({
      date: s.date,
      amount: s.amount,
      description: s.description,
      type: s.type,
    })),
    detalleDuplicados: r.duplicadosInternos.map((d) => ({
      fecha: d.date ? iso(d.date) : "",
      monto: d.amount,
      description: d.description,
    })),    lineasConError: errors.slice(0, 10),
    saldoPropuesto,
    saldoBanco,
    diferencia: Math.round(saldoPropuesto - saldoBanco),
  };
}

export type AplicarConciliacionInput = {
  statement: string;
  saldoBanco: number;
  /** Solo crear estos indices del estado de cuenta (los que el usuario dejo marcados). */
  indices: number[];
  /** Crear ademas un nuevo ancla de saldo con el valor del banco. */
  fijarSaldo: boolean;
};

/**
 * Aplica la conciliacion: crea los movimientos que faltan y, opcionalmente,
 * fija el saldo al valor confirmado por el banco.
 */
export async function applyStatement(input: AplicarConciliacionInput) {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");

  const { statement, saldoBanco, indices, fijarSaldo } = input;
  if (!Number.isFinite(saldoBanco)) throw new Error("Saldo invalido");
  if (indices.length > MAX_LINEAS) throw new Error("Demasiados movimientos a la vez");

  const { lines } = parseStatement(statement, { defaultDirection: "out" });

  // Volvemos a emparejar para no crear nada que ya exista.
  const fechas = lines.map((l) => l.date).filter((d): d is Date => !!d);
  const min = fechas.length ? new Date(Math.min(...fechas.map((d) => d.getTime()))) : new Date();
  const max = fechas.length ? new Date(Math.max(...fechas.map((d) => d.getTime()))) : new Date();

  const registros = await db.financeRecord.findMany({
    where: {
      userId: session.id,
      type: { in: ["income", "expense"] },
      date: { gte: new Date(min.getTime() - 10 * 86_400_000), lte: new Date(max.getTime() + 10 * 86_400_000) },
    },
    select: { id: true, date: true, amount: true, type: true, description: true },
    take: 2000,
  });

  const movimientos = registros
    .filter((r) => r.type === "income" || r.type === "expense")
    .map((r) => ({ id: r.id, date: r.date, amount: r.amount, type: r.type as "income" | "expense", description: r.description }));

  const r = conciliar(lines, movimientos);
  const infoPorLinea = new Map<ParsedLine, number>();
  lines.forEach((l, i) => infoPorLinea.set(l, i));

  const faltantes = r.faltantesEnApp
    .map((f) => ({ f, i: infoPorLinea.get(f.linea) }))
    .filter((x): x is { f: (typeof r.faltantesEnApp)[number]; i: number } => x.i !== undefined);

  // Solo los que el usuario aprobo explicitamente.
  const aCrear = faltantes.filter((x) => indices.includes(x.i));

  const creados = await db.$transaction(async (tx) => {
    const creadosLocal = [];
    for (const { f, i } of aCrear) {
      const l = lines[i]!;
      if (!l.date) continue;
      const nuevo = await tx.financeRecord.create({
        data: {
          type: l.direction === "in" ? "income" : "expense",
          amount: l.amount,
          description: l.description,
          category: f.category,
          date: l.date,
          // Viene del banco: si es dinero real que entro, cuenta para el saldo.
          excludeFromBalance: false,
          userId: session.id,
        },
      });
      creadosLocal.push(nuevo.id);
    }

    let anclaId: string | null = null;
    if (fijarSaldo) {
      const previa = await tx.balanceReconciliation.findFirst({
        where: { userId: session.id },
        orderBy: { date: "desc" },
      });
      const ajuste = previa ? Math.round(saldoBanco - previa.amount) : 0;
      const ancla = await tx.balanceReconciliation.create({
        data: {
          amount: saldoBanco,
          date: new Date(),
          note: `Conciliado con estado de cuenta: ${aCrear.length} movimientos creados. Ajuste ${ajuste.toLocaleString("es-CO")} vs ancla anterior.`,
          userId: session.id,
        },
      });
      anclaId = ancla.id;
    }
    return { creados: creadosLocal, anclaId };
  });

  revalidatePath("/contabilidad");
  revalidatePath("/");

  return {
    creados: creados.creados.length,
    anclaCreada: !!creados.anclaId,
    saldoBanco,
  };
}
