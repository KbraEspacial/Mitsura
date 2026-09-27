/**
 * Parser de estado de cuenta bancaria pegado como texto.
 *
 * Objetivo: que el usuario copie las transacciones desde la app de su banco
 * y la app las concilie sola, sin que tenga que inventar el saldo.
 *
 * Formatos tolerados por linea (uno por movimiento):
 *   26/09/2026  -40.000  Pinchos
 *   2026-09-26  40,000.00  PAQUERO
 *   26/09  +150.000  Prestamo Mami
 *   2026-09-26; 14550; D1 Snacks
 *   26/09/2026 | 1.300.000 | Quincena | credito
 *
 * La deteccion de ingreso/egreso usa, en orden: signo explicito, palabra clave
 * (credito/abono/ingreso/deposito vs debito/gasto/cargo/retiro), o el valor
 * por defecto que elija el usuario.
 */

export type ParsedLine = {
  raw: string;
  date: Date | null;
  amount: number;
  direction: "in" | "out" | "unknown";
  description: string;
  matchedText: string[];
};

export type ParseResult = {
  lines: ParsedLine[];
  errors: { line: string; reason: string }[];
};

/**
 * Convierte montos con formato colombiano o anglosajon.
 * "1.300.000" -> 1300000   "1,300,000.50" -> 1300000.5   "40.000" -> 40000
 * "1.300,50" -> 1300.5
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/\s*COP\s*$/i, "").replace(/[$\s ]/g, "");
  if (!s) return null;

  const neg = s.startsWith("-");
  if (neg || s.startsWith("+")) s = s.slice(1);

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  let decimalSep: string | null = null;
  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? "." : ",";
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const occurrences = s.split(sep).length - 1;
    const decimals = s.length - s.lastIndexOf(sep) - 1;
    // Varias separaciones, o una sola seguida de 3 digitos -> millares.
    decimalSep = occurrences > 1 || decimals === 3 ? null : sep;
  }

  let normalized: string;
  if (decimalSep) {
    const thousands = decimalSep === "." ? "," : ".";
    normalized = s.split(thousands).join("");
    normalized = normalized.replace(decimalSep, ".");
  } else {
    normalized = s.split(".").join("").split(",").join("");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Detecta una fecha en formatos dd/mm, dd-mm, aaaa-mm-dd, dd/mm/aaaa. */
function parseDate(raw: string): Date | null {
  const m = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const dm = raw.match(/(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?/);
  if (dm) {
    const a = Number(dm[1]);
    const b = Number(dm[2]);
    const dia = a;
    const mes = b;
    // Si el segundo numero no puede ser mes, es formato USA (mm/dd/aaaa).
    const usa = b > 12 && a <= 12;
    const diaFinal = usa ? b : dia;
    const mesFinal = usa ? a : mes;
    if (mesFinal < 1 || mesFinal > 12 || diaFinal < 1 || diaFinal > 31) return null;
    let anio = dm[3] ? Number(dm[3]) : new Date().getFullYear();
    if (anio < 100) anio += 2000;
    const d = new Date(anio, mesFinal - 1, diaFinal);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const IN_KEYS = /\b(credito|abono|ingreso|deposito|entrada|recibido|transferencia\s+in|mas)\b/i;
const OUT_KEYS = /\b(debito|gasto|cargo|retiro|salida|pago|compra|menos|transaccion)\b/i;

/** Localiza y arranca una fecha de la linea, devolviendo el resto sin ella. */
function extractDate(line: string): { date: Date | null; rest: string } {
  const cortar = (match: RegExpMatchArray) => {
    const ini = match.index ?? 0;
    return (line.slice(0, ini) + " " + line.slice(ini + match[0].length)).trim();
  };

  const iso = line.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
  if (iso) {
    const d = parseDate(iso[0]);
    if (d) return { date: d, rest: cortar(iso) };
  }
  const dmy = line.match(/\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b/);
  if (dmy) {
    const d = parseDate(dmy[0]);
    if (d) return { date: d, rest: cortar(dmy) };
  }
  return { date: null, rest: line };
}

/**
 * Busca el monto en la linea. Se llama DESPUES de quitar la fecha, porque si
 * no "26/09/2026" se interpretaria como el monto 26.
 *
 * Prioridad: monto con signo explicito > monto con separador de millares >
 * primer numero suelto. Asi "PIN 1234 - 40.000" toma 40.000 y no 1234.
 */
function findAmount(line: string): { amount: number; sign: "-" | "+" | ""; span: [number, number] } | null {
  const re = /([+-]?)\s*(?:COP\s*)?[$]?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d.,])/g;
  const candidatos: { amount: number; sign: "-" | "+" | ""; span: [number, number]; millares: boolean }[] = [];

  let mm: RegExpExecArray | null;
  while ((mm = re.exec(line)) !== null) {
    const signo = mm[1] ?? "";
    const digitos = mm[2] ?? "";
    const valor = parseAmount(signo + digitos);
    if (valor === null) continue;
    candidatos.push({
      amount: Math.abs(valor),
      sign: signo as "-" | "+" | "",
      span: [mm.index, mm.index + mm[0].length],
      millares: /\d{1,3}[.,]\d{3}/.test(digitos),
    });
  }

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => {
    if ((a.sign !== "") !== (b.sign !== "")) return a.sign !== "" ? -1 : 1;
    if (a.millares !== b.millares) return a.millares ? -1 : 1;
    return 0;
  });

  const mejor = candidatos[0]!;
  return { amount: mejor.amount, sign: mejor.sign, span: mejor.span };
}

const SEPARADORES = /\s{2,}|\s*[|;]\s*|\s*,\s*|\t+/;

/** Parte una linea en campos respetando el separador mas consistente. */
function splitFields(line: string): string[] {
  return line
    .split(SEPARADORES)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseStatement(
  text: string,
  opts: { defaultDirection?: "in" | "out" } = {},
): ParseResult {
  const defaultDirection = opts.defaultDirection ?? "out";
  const lines: ParsedLine[] = [];
  const errors: { line: string; reason: string }[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // 1) Encabezados: "Fecha | Descripcion | Valor"
    if (/^(fecha|date|transacci|detalle|concepto|movimiento|valor|monto)/i.test(line)) {
      const sinEncabezado = extractDate(line).rest;
      if (!findAmount(sinEncabezado)) continue;
    }

    // 2) La fecha se aparta primero: si no, "26/09/2026" se lee como monto 26.
    const { date, rest: sinFecha } = extractDate(line);

    // 3) Monto sobre el resto de la linea.
    const found = findAmount(sinFecha);
    if (!found) {
      errors.push({ line, reason: "no encontre un monto en la linea" });
      continue;
    }

    const [ini, fin] = found.span;
    const resto = (sinFecha.slice(0, ini) + " " + sinFecha.slice(fin)).replace(/\s{2,}/g, " ").trim();

    const campos = splitFields(resto);
    const descripcion =
      campos
        .filter((c) => c.length > 1 && !/^(debit|credito|debito|ingreso|gasto|abono|retiro|compra|pago)$/i.test(c))
        .join(" ") ||
      resto.replace(/[\d/.,|-]+/g, " ").trim() ||
      "Sin descripcion";

    let direction: ParsedLine["direction"] = "unknown";
    if (found.sign === "-") direction = "out";
    else if (found.sign === "+") direction = "in";
    else if (IN_KEYS.test(resto)) direction = "in";
    else if (OUT_KEYS.test(resto)) direction = "out";
    else direction = defaultDirection;

    lines.push({ raw: line, date, amount: found.amount, direction, description: descripcion, matchedText: campos });
  }

  return { lines, errors };
}

/** Normaliza para comparar descripciones: sin acentos, sin ruido. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
