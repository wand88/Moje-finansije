/* lokalni datum YYYY-MM-DD (toISOString je UTC, pa posle ponoći vraća jučerašnji dan) */
export function isoLocal(d: Date = new Date()): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function todayISO(): string {
  return isoLocal();
}

/* "YYYY-MM-DD" → lokalni Date u podne (bez pomeranja dana zbog vremenske zone) */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d || 1, 12);
}

/* broj dana između dva ISO datuma (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/* prva sledeća pojava datog dana u mesecu, počev od fromISO (uključivo) */
export function recNext(day: number, fromISO?: string): string {
  const from = fromISO ? parseISO(fromISO) : new Date();
  let d = new Date(from.getFullYear(), from.getMonth(), day, 12);
  if (d < new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0)) {
    d = new Date(from.getFullYear(), from.getMonth() + 1, day, 12);
  }
  return isoLocal(d);
}

export function recAdvance(dateISO: string, day: number): string {
  const d = parseISO(dateISO);
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, day, 12));
}

/* koliko je celih meseci ostalo do roka "YYYY-MM" */
export function monthsLeft(deadline: string, now: Date = new Date()): number {
  const [y, m] = deadline.split("-").map(Number);
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/* "2026-03-05" → "05.03.2026." */
export function fmtDate(iso: string, withYear = true): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${withYear ? iso.slice(0, 4) + "." : ""}`;
}
