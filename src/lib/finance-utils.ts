/**
 * Helpers de fecha para el módulo financiero.
 * Viven fuera de "use server" porque los Server Actions solo pueden exportar
 * funciones async.
 */

/**
 * Clave de mes "YYYY-MM" en hora LOCAL.
 * Usar getUTCMonth()/getUTCFullYear() movía al mes anterior los registros
 * Bogota de madrugada (ej: 1 oct 00:00 local = 30 sept UTC).
 */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

/** "2026-09" -> "Septiembre 2026" */
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const idx = Number(month) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${MONTH_NAMES[idx]} ${year}`;
}

/** Rango [inicio, fin) del mes "YYYY-MM" en hora local. */
export function monthRange(key: string): { start: Date; end: Date } {
  const [year = 1970, month = 1] = key.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

/** Desplaza una clave de mes "YYYY-MM" un número de meses. */
export function shiftMonth(key: string, delta: number): string {
  const [year = 1970, month = 1] = key.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return monthKey(d);
}
