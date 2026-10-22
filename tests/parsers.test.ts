import { describe, expect, it } from "vitest";
import { buildPreview, csvTxId, guessCategory, guessMapping, parseAmount, parseCSVText, parseDateAny } from "../src/lib/csv";
import { daysBetween, isoLocal, monthsLeft, recAdvance, recNext } from "../src/lib/dates";
import { decodeFiscalUrl, isFiscalLink } from "../src/lib/fiscal";

describe("dates", () => {
  it("isoLocal koristi lokalni datum, ne UTC (bug posle ponoći)", () => {
    expect(isoLocal(new Date(2026, 11, 31, 0, 30))).toBe("2026-12-31");
    expect(isoLocal(new Date(2026, 0, 31))).toBe("2026-01-31");
  });
  it("recNext: dan u tekućem mesecu je uključiv, prošli dan ide na sledeći mesec", () => {
    expect(recNext(15, "2026-03-10")).toBe("2026-03-15");
    expect(recNext(10, "2026-03-10")).toBe("2026-03-10");
    expect(recNext(15, "2026-03-20")).toBe("2026-04-15");
    expect(recNext(5, "2026-12-20")).toBe("2027-01-05");
  });
  it("recAdvance pomera na isti dan sledećeg meseca", () => {
    expect(recAdvance("2026-01-28", 28)).toBe("2026-02-28");
    expect(recAdvance("2026-12-01", 1)).toBe("2027-01-01");
  });
  it("monthsLeft i daysBetween (i preko promene letnjeg računanja vremena)", () => {
    expect(monthsLeft("2027-01", new Date(2026, 9, 22))).toBe(3);
    expect(monthsLeft("2026-10", new Date(2026, 9, 22))).toBe(0);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-22", "2026-10-21")).toBe(-1);
  });
});

describe("CSV", () => {
  it("parseAmount razume domaći i strani format", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("-1,234.56")).toBe(-1234.56);
    expect(parseAmount("(500)")).toBe(-500);
    expect(parseAmount("1 200 RSD")).toBe(1200);
    expect(parseAmount("")).toBeNaN();
  });
  it("parseDateAny", () => {
    expect(parseDateAny("05.03.2026")).toBe("2026-03-05");
    expect(parseDateAny("5/3/2026")).toBe("2026-03-05");
    expect(parseDateAny("5.3.26.")).toBe("2026-03-05");
    expect(parseDateAny("2026-3-5 10:00")).toBe("2026-03-05");
    expect(parseDateAny("juče")).toBeNull();
  });
  it("parseCSVText: separator, navodnici i prazni redovi", () => {
    const rows = parseCSVText('Datum;Opis;Iznos\r\n01.02.2026;"Maxi; Beograd";-1.500,00\r\n\r\n02.02.2026;"Plata ""januar""";100.000,00\r\n');
    expect(rows).toEqual([
      ["Datum", "Opis", "Iznos"],
      ["01.02.2026", "Maxi; Beograd", "-1.500,00"],
      ["02.02.2026", 'Plata "januar"', "100.000,00"],
    ]);
  });
  it("guessMapping prepoznaje dve kolone (uplata/isplata)", () => {
    const m = guessMapping(["Datum knjiženja", "Svrha", "Uplata", "Isplata"]);
    expect(m).toMatchObject({ date: 0, desc: 1, credit: 2, debit: 3, mode: "two" });
  });
  it("buildPreview + kategorije po trgovcu", () => {
    const map = guessMapping(["Datum", "Opis", "Iznos"]);
    const p = buildPreview([
      ["01.02.2026", "MAXI 123", "-1.500,00"],
      ["02.02.2026", "Zarada za januar", "100.000,00"],
      ["bez datuma", "x", "5"],
      ["03.02.2026", "NIS Petrol", "-4000"],
    ], map);
    expect(p.map((r) => [r.type, r.cat, r.amount])).toEqual([
      ["rashod", "potrosnja", 1500],
      ["prihod", "plata", 100000],
      ["rashod", "vozilo", 4000],
    ]);
  });
  it("guessCategory i stabilan ID za deduplikaciju", () => {
    expect(guessCategory("EPS snabdevanje", false)).toBe("racuni");
    expect(guessCategory("Netflix.com", false)).toBe("pretplate");
    expect(guessCategory("nešto nepoznato", false)).toBe("potrosnja");
    const row = { date: "2026-02-01", amount: 1500, desc: "MAXI" };
    expect(csvTxId(row)).toBe(csvTxId({ ...row }));
    expect(csvTxId(row)).not.toBe(csvTxId({ ...row, amount: 1501 }));
  });
});

/* pravi verifikacioni link: iznos na bajtu 25 (1/10000), vreme na bajtu 33 (unix ms) */
function fiscalUrl(amount: number, ts: number): string {
  const b = new Uint8Array(49);
  const dv = new DataView(b.buffer);
  dv.setBigUint64(25, BigInt(Math.round(amount * 10000)), true);
  dv.setBigUint64(33, BigInt(ts), true);
  const b64 = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `https://suf.purs.gov.rs/v/?vl=${b64}`;
}

describe("fiskalni QR", () => {
  it("čita iznos i lokalni datum", () => {
    const ts = new Date(2026, 9, 22, 18, 45).getTime();
    expect(decodeFiscalUrl(fiscalUrl(1234.5, ts))).toMatchObject({ amount: 1234.5, date: "2026-10-22" });
  });
  it("nerazumne vrednosti → samo link; tuđi domen → null", () => {
    const r = decodeFiscalUrl(fiscalUrl(10, new Date(1999, 0, 1).getTime()));
    expect(r?.url).toContain("suf.purs.gov.rs");
    expect(r?.amount).toBeUndefined();
    expect(decodeFiscalUrl("https://primer.rs/v/?vl=AAAA")).toBeNull();
    expect(decodeFiscalUrl("nije link")).toBeNull();
  });
  it("isFiscalLink prihvata samo https PURS linkove", () => {
    expect(isFiscalLink("https://suf.purs.gov.rs/v/?vl=x")).toBe(true);
    expect(isFiscalLink("javascript:alert(1)")).toBe(false);
    expect(isFiscalLink(undefined)).toBe(false);
  });
});
