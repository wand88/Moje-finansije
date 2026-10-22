/* ============ Zvanične stope: EURIBOR (ECB), kurs EUR/RSD (NBS), referentna stopa NBS ============
   Deli ga serverski servis (functions/api/rates.ts) i aplikacija — bez DOM-a, pokriveno testovima. */
import { parseCSVText } from "./csv";

export interface RatePoint {
  value: number;
  /* period ili datum na koji se vrednost odnosi ("2026-09" za mesečni prosek, "2026-10-22" za kurs) */
  period: string;
}

export interface RateSeries extends RatePoint {
  prev?: RatePoint;
  source: string;
}

export interface OfficialRates {
  /* kada je servis sastavio odgovor (ISO vreme) */
  updated: string;
  euribor3m: RateSeries | null;
  euribor6m: RateSeries | null;
  eurRsd: RateSeries | null;
  nbsKeyRate: RateSeries | null;
  errors: string[];
}

/* Referentnu stopu NBS menja Izvršni odbor (uglavnom jednom mesečno); NBS sajt ne dozvoljava automatsko čitanje,
   pa se vrednost ažurira ovde posle svake odluke. Poslednja provera: odluka iz avgusta 2026. */
export const NBS_KEY_RATE: RateSeries = { value: 5.75, period: "2026-08", source: "NBS — odluka Izvršnog odbora" };

export const ECB_EURIBOR_URL = (tenor: "3M" | "6M") =>
  `https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR${tenor}D_.HSTA?lastNObservations=2&format=csvdata`;
export const KURS_EUR_URL = "https://kurs.resenje.org/api/v1/currencies/eur/rates/today";

/* ECB csvdata: zaglavlje + jedan red po periodu; kolone TIME_PERIOD i OBS_VALUE (naslovi sadrže zareze u navodnicima) */
export function parseEcbCsv(csv: string, source = "ECB (mesečni prosek)"): RateSeries | null {
  const rows = parseCSVText(csv);
  if (rows.length < 2) return null;
  const head = rows[0].map((h) => h.trim());
  const ti = head.indexOf("TIME_PERIOD"), vi = head.indexOf("OBS_VALUE");
  if (ti < 0 || vi < 0) return null;
  const pts: RatePoint[] = rows.slice(1)
    .map((r) => ({ period: String(r[ti] || "").trim(), value: parseFloat(r[vi]) }))
    .filter((p) => p.period && isFinite(p.value))
    .sort((a, b) => a.period.localeCompare(b.period));
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { value: round(last.value), period: last.period, prev: pts.length > 1 ? { value: round(pts[pts.length - 2].value), period: pts[pts.length - 2].period } : undefined, source };
}

/* kurs.resenje.org — preuzima srednji kurs preko NBS web servisa */
export function parseKursResenje(json: unknown, source = "NBS srednji kurs (preko kurs.resenje.org)"): RateSeries | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const value = Number(o.exchange_middle);
  const period = typeof o.date === "string" ? o.date : "";
  if (!(value > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(period)) return null;
  return { value, period, source };
}

/* sastavlja odgovor; svaki izvor može da padne nezavisno, a ostali i dalje stižu */
export async function collectRates(fetchText: (url: string) => Promise<string>, now = new Date()): Promise<OfficialRates> {
  const errors: string[] = [];
  const attempt = async <T>(label: string, fn: () => Promise<T | null>): Promise<T | null> => {
    try {
      const v = await fn();
      if (v === null) errors.push(`${label}: neočekivan format`);
      return v;
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message || "greška"}`);
      return null;
    }
  };
  const [euribor3m, euribor6m, eurRsd] = await Promise.all([
    attempt("EURIBOR 3M", async () => parseEcbCsv(await fetchText(ECB_EURIBOR_URL("3M")))),
    attempt("EURIBOR 6M", async () => parseEcbCsv(await fetchText(ECB_EURIBOR_URL("6M")))),
    attempt("Kurs EUR", async () => parseKursResenje(JSON.parse(await fetchText(KURS_EUR_URL)))),
  ]);
  return { updated: now.toISOString(), euribor3m, euribor6m, eurRsd, nbsKeyRate: NBS_KEY_RATE, errors };
}

/* da li je odgovor sa servera ispravnog oblika (aplikacija ne veruje slepo mreži) */
export function isOfficialRates(x: unknown): x is OfficialRates {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const okSeries = (s: unknown) => s === null || (!!s && typeof s === "object" && typeof (s as RatePoint).value === "number" && typeof (s as RatePoint).period === "string");
  return typeof o.updated === "string" && ["euribor3m", "euribor6m", "eurRsd", "nbsKeyRate"].every((k) => okSeries(o[k]));
}
