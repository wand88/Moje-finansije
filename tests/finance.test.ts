import { describe, expect, it } from "vitest";
import { annuity, carAffordability, maxLoanFor, monthsToPayoff, prepay, realFactor, suggestBudget } from "../src/lib/finance";

describe("annuity", () => {
  it("računa standardnu anuitetnu ratu", () => {
    expect(annuity(100000, 0.01, 12)).toBeCloseTo(8884.88, 2);
    expect(annuity(7_350_000, 0.055 / 12, 300)).toBeCloseTo(45135.43, 2);
  });
  it("bez kamate deli glavnicu na rate", () => {
    expect(annuity(1200, 0, 12)).toBe(100);
  });
});

describe("monthsToPayoff", () => {
  it("anuitetna rata otplaćuje kredit tačno u roku", () => {
    expect(monthsToPayoff(100000, 0.01, annuity(100000, 0.01, 12))).toBe(12);
  });
  it("Infinity kad rata ne pokriva ni kamatu", () => {
    expect(monthsToPayoff(100000, 0.01, 1000)).toBe(Infinity);
  });
  it("nula duga = nula meseci; bez kamate = deljenje", () => {
    expect(monthsToPayoff(0, 0.01, 100)).toBe(0);
    expect(monthsToPayoff(1000, 0, 300)).toBe(4);
  });
});

describe("maxLoanFor", () => {
  it("rata = dti% prihoda − obaveze", () => {
    const r = maxLoanFor(100000, { dti: 36, oblig: 6000, apr: 0, years: 1 });
    expect(r.maxRate).toBe(30000);
    expect(r.principal).toBe(360000);
  });
  it("nikad negativna rata", () => {
    expect(maxLoanFor(10000, { dti: 36, oblig: 50000, apr: 5, years: 30 }).maxRate).toBe(0);
  });
  it("glavnica je sadašnja vrednost maksimalne rate", () => {
    const r = maxLoanFor(150000, { dti: 30, oblig: 0, apr: 5.5, years: 30 });
    expect(annuity(r.principal, 0.055 / 12, 360)).toBeCloseTo(r.maxRate, 6);
  });
});

describe("prepay", () => {
  it("dodatnih 10.000 mesečno skraćuje stambeni kredit sa 300 na 207 meseci", () => {
    const r = prepay(7_350_000, 5.5, 300, 0, 10000);
    expect(r.M).toBeCloseTo(45135.43, 2);
    expect(r.nA).toBe(207);
    expect(r.savedA).toBeGreaterThan(0);
  });
  it("skraćenje roka uvek štedi bar koliko i smanjenje rate", () => {
    const r = prepay(3_000_000, 6, 240, 500_000, 0);
    expect(r.MB).toBeLessThan(r.M);
    expect(r.savedA).toBeGreaterThanOrEqual(r.savedB);
  });
  it("jednokratna uplata cele glavnice gasi kredit", () => {
    const r = prepay(100000, 5, 60, 100000, 0);
    expect(r.nA).toBe(0);
    expect(r.savedA).toBeCloseTo(r.baseInterest, 6);
  });
});

describe("carAffordability", () => {
  const base = { cPrice: 15000, cDown: 3000, cApr: 7.5, cTerm: 60, cIns: 60, cFuel: 120, cMaint: 50, cIncome: 2000 };
  it("računa ratu i ukupan trošak", () => {
    const r = carAffordability(base);
    expect(r.principal).toBe(12000);
    expect(r.payment).toBeCloseTo(annuity(12000, 0.075 / 12, 60), 6);
    expect(r.monthlyTotal).toBeCloseTo(r.payment + 230, 6);
    expect(r.neededIncome).toBeCloseTo(r.monthlyTotal / 0.15, 6);
  });
  it("ocena prema pravilu 15% / 20%", () => {
    expect(carAffordability({ ...base, cIncome: 10000 }).verdict).toBe("ok");
    expect(carAffordability({ ...base, cIncome: 2700 }).verdict).toBe("stretch");
    expect(carAffordability({ ...base, cIncome: 1500 }).verdict).toBe("risk");
  });
});

describe("realFactor / suggestBudget", () => {
  it("preračun u cene poslednje godine množi inflacije posle posmatrane godine", () => {
    const infl: Record<number, number> = { 2025: 4, 2026: 10 };
    expect(realFactor(2024, 2026, (y) => infl[y] ?? 0)).toBeCloseTo(1.04 * 1.1, 10);
    expect(realFactor(2026, 2026, () => 50)).toBe(1);
  });
  it("50/30/20 predlog zaokružen na 500", () => {
    const b = suggestBudget(123456);
    expect(b.stednja).toBe(24500);
    Object.values(b).forEach((v) => expect(v % 500).toBe(0));
  });
});
