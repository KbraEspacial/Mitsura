import { monthRange } from "@/lib/finance-utils";

/** Helpers puros del plan de sueldo. Fuera de "use server" (solo async exports). */

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export type PaydayRule = {
  frequency: string;
  dayOfMonth: number;
  secondDay: number | null;
};

/** Días de cobro de una fuente dentro del mes "YYYY-MM". */
export function paydaysForSource(rule: PaydayRule, key: string): number[] {
  const { start } = monthRange(key);
  const year = start.getFullYear();
  const month = start.getMonth() + 1;
  const last = daysInMonth(year, month);
  const clamp = (d: number) => Math.min(Math.max(d, 1), last);

  if (rule.frequency === "monthly") return [clamp(rule.dayOfMonth)];
  if (rule.frequency === "biweekly") {
    const days = [clamp(rule.dayOfMonth)];
    const second = rule.secondDay ?? 30;
    if (clamp(second) !== days[0]) days.push(clamp(second));
    return days.sort((a, b) => a - b);
  }
  // weekly: 4 cobros Equidistantes
  return [1, 8, 15, 22].map((d) => Math.min(d, last));
}

/** Etiqueta legible de la frecuencia. */
export function frequencyLabel(frequency: string): string {
  if (frequency === "monthly") return "Mensual";
  if (frequency === "weekly") return "Semanal";
  return "Quincenal";
}

export function paydaySummaryText(rule: PaydayRule): string {
  if (rule.frequency === "monthly") return `día ${rule.dayOfMonth} de cada mes`;
  if (rule.frequency === "weekly") return "4 cobros al mes";
  const a = Math.min(rule.dayOfMonth, 31);
  const b = rule.secondDay ?? 30;
  return `días ${Math.min(a, b)} y ${Math.max(a, b)}`;
}
