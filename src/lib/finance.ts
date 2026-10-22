/* ============ Finansijska matematika (bez DOM-a, pokriveno testovima) ============ */

/* mesečna anuitetna rata: P glavnica, r mesečna kamata, n broj rata */
export function annuity(P: number, r: number, n: number): number {
  return r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
}

/* koliko meseci treba da se otplati P uz ratu M; Infinity ako rata ne pokriva ni kamatu */
export function monthsToPayoff(P: number, r: number, M: number): number {
  if (P <= 0) return 0;
  if (r <= 0) return Math.ceil(P / M);
  if (M <= P * r) return Infinity;
  /* epsilon: 12.000000001 meseci zbog zaokruživanja je i dalje 12, ne 13 */
  return Math.ceil(-Math.log(1 - (P * r) / M) / Math.log(1 + r) - 1e-9);
}

/* najveći kredit za dati prihod: rata ≤ dti% prihoda − postojeće obaveze */
export function maxLoanFor(
  income: number,
  o: { dti: number; oblig: number; apr: number; years: number },
): { maxRate: number; principal: number } {
  const r = o.apr / 100 / 12;
  const n = Math.max(1, Math.round(o.years * 12));
  const maxRate = Math.max(0, (income * o.dti) / 100 - o.oblig);
  const principal = r > 0 ? (maxRate * (1 - Math.pow(1 + r, -n))) / r : maxRate * n;
  return { maxRate, principal };
}

export interface PrepayResult {
  M: number;
  baseInterest: number;
  /* A — skraćenje roka (rata ostaje, + eventualno mesečno dodatno) */
  payA: number;
  nA: number;
  savedA: number;
  /* B — smanjenje rate (rok ostaje, utiče samo jednokratna uplata) */
  MB: number;
  savedB: number;
}

export function prepay(P: number, apr: number, n: number, once: number, extra: number): PrepayResult {
  const r = apr / 100 / 12;
  const M = annuity(P, r, n);
  const baseInterest = M * n - P;
  const P2 = Math.max(0, P - once);
  const payA = M + extra;
  const nA = P2 > 0 ? monthsToPayoff(P2, r, payA) : 0;
  const intA = P2 > 0 ? payA * nA - P2 : 0;
  const MB = P2 > 0 ? annuity(P2, r, n) : 0;
  const intB = P2 > 0 ? MB * n - P2 : 0;
  return { M, baseInterest, payA, nA, savedA: baseInterest - intA, MB, savedB: baseInterest - intB };
}

/* prag godišnje prevremene otplate bez naknade (Srbija) */
export const PREPAY_FEE_FREE_LIMIT = 1_000_000;

export interface CarInput {
  cPrice: number; cDown: number; cApr: number; cTerm: number;
  cIns: number; cFuel: number; cMaint: number; cIncome: number;
}
export interface CarResult {
  principal: number; n: number; payment: number; monthlyTotal: number;
  totalInterest: number; trueCost: number; pct: number; neededIncome: number;
  verdict: "ok" | "stretch" | "risk";
}

/* priuštivost auta — pravilo: ukupan mesečni trošak ≤ 15% prihoda */
export function carAffordability(v: CarInput): CarResult {
  const principal = Math.max(0, v.cPrice - v.cDown);
  const n = Math.max(1, Math.round(v.cTerm));
  const payment = annuity(principal, v.cApr / 100 / 12, n);
  const running = v.cIns + v.cFuel + v.cMaint;
  const monthlyTotal = payment + running;
  const totalInterest = payment * n - principal;
  const trueCost = v.cPrice + totalInterest + running * n;
  const pct = v.cIncome > 0 ? (100 * monthlyTotal) / v.cIncome : 0;
  const verdict = pct > 20 ? "risk" : pct > 15 ? "stretch" : "ok";
  return { principal, n, payment, monthlyTotal, totalInterest, trueCost, pct, neededIncome: monthlyTotal / 0.15, verdict };
}

/* faktor preračuna iznosa iz godine y u cene godine latest (proizvod 1+inflacija) */
export function realFactor(y: number, latest: number, inflOf: (year: number) => number): number {
  let f = 1;
  for (let k = y + 1; k <= latest; k++) f *= 1 + inflOf(k) / 100;
  return f;
}

/* predlog plana po pravilu 50/30/20, zaokruženo na 500 */
export const BUDGET_SHARES: Record<string, number> = {
  dom: 0.3, racuni: 0.1, potrosnja: 0.15, garderoba: 0.05, pretplate: 0.03, vozilo: 0.1, dugovi: 0.07, stednja: 0.2,
};
export function suggestBudget(income: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, p] of Object.entries(BUDGET_SHARES)) out[k] = Math.round((income * p) / 500) * 500;
  return out;
}
