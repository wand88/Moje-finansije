/* ============ Pomoćnici nad stanjem: kategorije, članovi, filteri, format ============ */
import { intlLocale, t } from "./i18n";
import { escapeHtml } from "./ui/dom";
import { icon } from "./ui/icons";
import { state } from "./store";
import { ALL, SHARED, type Asset, type Category, type Tx } from "./types";

export const MONTHS = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];
export const MONTHS_S = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];

export const BASE_EXP_CATS: Category[] = [
  { id: "stednja", name: "Štednja", color: "var(--s3)" },
  { id: "vozilo", name: "Vozilo", color: "var(--s2)" },
  { id: "dom", name: "Dom i stanovanje", color: "var(--s1)" },
  { id: "racuni", name: "Računi", color: "var(--s4)" },
  { id: "potrosnja", name: "Potrošnja", color: "var(--s5)" },
  { id: "pretplate", name: "Pretplate", color: "var(--s6)" },
  { id: "dugovi", name: "Dugovi", color: "var(--s7)" },
  { id: "garderoba", name: "Garderoba i luksuz", color: "var(--s8)" },
];
export const BASE_INC_CATS: Category[] = [
  { id: "plata", name: "Plata", color: "var(--s3)" },
  { id: "honorar", name: "Honorar", color: "var(--s2)" },
  { id: "ostalo", name: "Ostali prihodi", color: "var(--s7)" },
];

/* korisničke kategorije se dodaju na osnovne */
export const expCats = (): Category[] => BASE_EXP_CATS.concat(state.customCats.filter((c) => c.type === "rashod"));
export const incCats = (): Category[] => BASE_INC_CATS.concat(state.customCats.filter((c) => c.type === "prihod"));
export const catsOf = (type: string): Category[] => (type === "prihod" ? incCats() : expCats());
export const catById = (id: string): Category =>
  expCats().concat(incCats()).find((c) => c.id === id) || { id, name: id, color: "var(--muted)" };

/* ---- članovi ---- */
export const memberIds = (): string[] => state.members.map((m) => m.id).concat(SHARED);
export function memberName(id: string): string {
  if (id === SHARED) return t("member.shared");
  return state.members.find((m) => m.id === id)?.name ?? t("member.default");
}
export const memberBadge = (id: string): string =>
  `<span class="member-badge">${icon(id === SHARED ? "users" : "user", 13)}${escapeHtml(memberName(id))}</span>`;
export const memberOptions = (): string =>
  `<option value="${SHARED}">${escapeHtml(t("member.shared"))}</option>` +
  state.members.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join("");

/* ---- transakcije ---- */
export const txOfYear = (): Tx[] => state.tx.filter((t) => t.date.slice(0, 4) === String(state.year));
export const monthOf = (t: Pick<Tx, "date">): number => parseInt(t.date.slice(5, 7), 10) - 1;
export const passFilter = (x: { member: string }): boolean => state.filter === ALL || x.member === state.filter;
export const sum = <T>(arr: T[], f: (x: T) => number): number => arr.reduce((s, x) => s + f(x), 0);
export const lastVal = (x: Asset): number => (x.entries.length ? x.entries[x.entries.length - 1].value : 0);

/* poslednji „završen" mesec za proseke: tekući ako je izabrana tekuća godina, inače decembar */
export function lastMonthForAvg(now: Date = new Date()): number {
  return state.year === now.getFullYear() ? now.getMonth() : 11;
}

/* ---- format ---- */
export const fmt = (v: number): string =>
  new Intl.NumberFormat(intlLocale(), { style: "currency", currency: state.currency, maximumFractionDigits: 0 }).format(v);
/* iznos u zadatoj valuti (npr. rata kredita u evrima dok je domaćinstvo u dinarima) */
export const fmtIn = (v: number, currency: string, digits = 0): string =>
  new Intl.NumberFormat(intlLocale(), { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
export const fmtN = (v: number): string => new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 0 }).format(v);
