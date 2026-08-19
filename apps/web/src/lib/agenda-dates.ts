/** Agenda calendar date helpers (local timezone). */

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(x, mondayOffset);
}

export function endOfWeek(d: Date): Date {
  return endOfDay(addDays(startOfWeek(d), 6));
}

export function startOfMonth(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Calendar grid: weeks covering the month (Mon–Sun). */
export function monthGridDays(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const last = endOfMonth(anchor);
  const gridEnd = endOfWeek(last);
  const days: Date[] = [];
  for (let cur = gridStart; cur <= gridEnd; cur = addDays(cur, 1)) {
    days.push(cur);
  }
  return days;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function formatDayHeading(d: Date): string {
  return d.toLocaleDateString('es-VE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatMonthHeading(d: Date): string {
  return d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
}

export function formatWeekRange(anchor: Date): string {
  const from = startOfWeek(anchor);
  const to = addDays(from, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${from.toLocaleDateString('es-VE', opts)} – ${to.toLocaleDateString('es-VE', { ...opts, year: 'numeric' })}`;
}

export const CLINIC_HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8–20

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
