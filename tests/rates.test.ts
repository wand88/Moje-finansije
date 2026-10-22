import { describe, expect, it } from "vitest";
import { KURS_EUR_URL, collectRates, isOfficialRates, parseEcbCsv, parseKursResenje } from "../src/lib/rates";

/* skraćen pravi odgovor ECB Data API-ja (csvdata) — naslovi sadrže zareze unutar navodnika */
const ECB = `KEY,FREQ,REF_AREA,CURRENCY,PROVIDER_FM,INSTRUMENT_FM,PROVIDER_FM_ID,DATA_TYPE_FM,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE,TITLE_COMPL,UNIT
FM.M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA,M,U2,EUR,RT,MM,EURIBOR6MD_,HSTA,2026-09,2.9215909,A,"Euribor 6-month - Historical close, average of observations through period","Euro area (changing composition) - Money Market, Euribor",PCPA
FM.M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA,M,U2,EUR,RT,MM,EURIBOR6MD_,HSTA,2026-08,2.7133333,A,"Euribor 6-month - Historical close, average of observations through period","Euro area (changing composition) - Money Market, Euribor",PCPA
`;

const KURS = { code: "EUR", date: "2026-10-22", parity: 1, exchange_buy: 117.0986, exchange_middle: 117.451, exchange_sell: 117.8034 };

describe("parseEcbCsv", () => {
  it("uzima poslednji period i prethodni, bez obzira na redosled redova", () => {
    expect(parseEcbCsv(ECB)).toEqual({
      value: 2.922, period: "2026-09", prev: { value: 2.713, period: "2026-08" }, source: "ECB (mesečni prosek)",
    });
  });
  it("null za prazan ili tuđ format", () => {
    expect(parseEcbCsv("")).toBeNull();
    expect(parseEcbCsv("a,b\n1,2\n")).toBeNull();
    expect(parseEcbCsv("TIME_PERIOD,OBS_VALUE\n2026-09,NaN\n")).toBeNull();
  });
});

describe("parseKursResenje", () => {
  it("čita srednji kurs i datum", () => {
    expect(parseKursResenje(KURS)).toMatchObject({ value: 117.451, period: "2026-10-22" });
  });
  it("odbija neispravne vrednosti", () => {
    expect(parseKursResenje({ ...KURS, exchange_middle: 0 })).toBeNull();
    expect(parseKursResenje({ ...KURS, date: "juče" })).toBeNull();
    expect(parseKursResenje(null)).toBeNull();
  });
});

describe("collectRates", () => {
  it("sastavlja sve izvore i proverava oblik odgovora", async () => {
    const r = await collectRates(async (url) => (url === KURS_EUR_URL ? JSON.stringify(KURS) : ECB), new Date("2026-10-22T10:00:00Z"));
    expect(r.errors).toEqual([]);
    expect(r.euribor6m?.value).toBe(2.922);
    expect(r.eurRsd?.value).toBe(117.451);
    expect(r.nbsKeyRate?.value).toBe(5.75);
    expect(isOfficialRates(JSON.parse(JSON.stringify(r)))).toBe(true);
  });
  it("pad jednog izvora ne ruši ostale", async () => {
    const r = await collectRates(async (url) => {
      if (url === KURS_EUR_URL) throw new Error("HTTP 503");
      return ECB;
    });
    expect(r.eurRsd).toBeNull();
    expect(r.euribor3m).not.toBeNull();
    expect(r.errors).toEqual(["Kurs EUR: HTTP 503"]);
  });
  it("isOfficialRates odbija smeće", () => {
    expect(isOfficialRates({ updated: 1 })).toBe(false);
    expect(isOfficialRates({ updated: "x", euribor3m: { value: "2" } })).toBe(false);
  });
});
