/* ============ CSV izvodi iz e-bankinga ============ */
import type { TxType } from "../types";

/* pogađanje kategorije po nazivu trgovca (Srbija) */
export const CSV_RULES: { re: RegExp; cat: string }[] = [
  { re: /eps|elektrodistribucij|elektroprivred|struja/i, cat: "racuni" },
  { re: /infostan|komunalij|vodovod|toplan|grejanj|gradska čistoća|cistoca/i, cat: "racuni" },
  { re: /telekom|mts|yettel|telenor|a1 |a1-|sbb|supernova|orion|net tv/i, cat: "racuni" },
  { re: /nis |nis-|nis p|gazprom|omv|mol |lukoil|eko |shell|petrol|benzin|gorivo/i, cat: "vozilo" },
  { re: /registracij|tehnički pregled|tehnicki pregled|autoservis|vulkanizer|parking servis/i, cat: "vozilo" },
  { re: /maxi|lidl|idea |idea-|roda|univerexport|aroma|mercator|tempo|dis |shop&go|market/i, cat: "potrosnja" },
  { re: /apotek|dm |dm-|lilly|restoran|kafic|kafić|caffe|wolt|glovo|donesi/i, cat: "potrosnja" },
  { re: /netflix|spotify|hbo|disney|youtube|deezer|apple\.com|icloud|google one|pretplat/i, cat: "pretplate" },
  { re: /zara|h&m|c&a|new yorker|sport vision|deichmann|planeta sport|fashion|butik/i, cat: "garderoba" },
  { re: /kirija|zakup|stanarina/i, cat: "dom" },
  { re: /rata |kredit|otplat|leasing|lizing/i, cat: "dugovi" },
  { re: /štednj|stednj|oročen|orocen/i, cat: "stednja" },
];

export function guessCategory(desc: string, positive: boolean): string {
  if (positive) {
    if (/zarad|plata|lični dohodak|licni dohodak|salary/i.test(desc)) return "plata";
    if (/honorar|ugovor o delu|autorsk/i.test(desc)) return "honorar";
    return "ostalo";
  }
  for (const r of CSV_RULES) if (r.re.test(desc)) return r.cat;
  return "potrosnja";
}

export function detectDelim(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== "") || "";
  let best = ";", bestN = -1;
  for (const d of [";", ",", "\t"]) {
    const n = line.split(d).length - 1;
    if (n > bestN) { bestN = n; best = d; }
  }
  return best;
}

export function parseCSVText(text: string): string[][] {
  const delim = detectDelim(text);
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

/* "1.234,56", "-1,234.56", "(500)", "1 200 RSD" → broj */
export function parseAmount(s: unknown): number {
  let v = String(s ?? "").trim().replace(/\s| /g, "").replace(/RSD|EUR|USD|дин\.?|din\.?/gi, "");
  if (!v) return NaN;
  const neg = /^-|^\(/.test(v);
  v = v.replace(/[()+\-]/g, "");
  const lastDot = v.lastIndexOf("."), lastCom = v.lastIndexOf(",");
  if (lastCom > lastDot) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(/,/g, "");
  const n = parseFloat(v);
  return neg ? -n : n;
}

export function parseDateAny(s: unknown): string | null {
  const v = String(s ?? "").trim();
  const p2 = (x: string) => String(x).padStart(2, "0");
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
  m = v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (m) return `${m[3]}-${p2(m[2])}-${p2(m[1])}`;
  m = v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})\.?$/);
  if (m) return `20${m[3]}-${p2(m[2])}-${p2(m[1])}`;
  return null;
}

export function csvHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function guessCol(headers: string[], res: RegExp[]): number {
  for (const re of res) {
    const i = headers.findIndex((h) => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

export interface CsvMap {
  date: number;
  desc: number;
  amount: number;
  credit: number;
  debit: number;
  mode: "one" | "two";
}

export function guessMapping(headers: string[]): CsvMap {
  const map: CsvMap = {
    date: guessCol(headers, [/knji[žz]enj/i, /datum/i, /date/i, /valuta/i]),
    desc: guessCol(headers, [/opis/i, /svrha/i, /naziv/i, /primalac/i, /korisnik/i, /detalj/i, /description/i]),
    amount: guessCol(headers, [/^iznos/i, /iznos/i, /amount/i, /promet/i]),
    credit: guessCol(headers, [/uplat/i, /u korist/i, /potra[žz]/i, /priliv/i, /credit/i]),
    debit: guessCol(headers, [/isplat/i, /na teret/i, /dugu/i, /odliv/i, /zadu[žz]/i, /debit/i]),
    mode: "one",
  };
  map.mode = map.credit >= 0 && map.debit >= 0 && map.credit !== map.debit ? "two" : "one";
  if (map.date < 0) map.date = 0;
  if (map.desc < 0) map.desc = Math.min(1, headers.length - 1);
  if (map.mode === "one" && map.amount < 0) map.amount = headers.length - 1;
  return map;
}

export interface CsvRow {
  include: boolean;
  date: string;
  desc: string;
  amount: number;
  type: TxType;
  cat: string;
}

export function buildPreview(rows: string[][], map: CsvMap): CsvRow[] {
  const out: CsvRow[] = [];
  for (const cells of rows) {
    const date = parseDateAny(cells[map.date]);
    let amt = NaN;
    if (map.mode === "one") amt = parseAmount(cells[map.amount]);
    else {
      const c = parseAmount(cells[map.credit]), d = parseAmount(cells[map.debit]);
      if (isFinite(c) && c !== 0) amt = Math.abs(c);
      else if (isFinite(d) && d !== 0) amt = -Math.abs(d);
    }
    const desc = String(cells[map.desc] ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!date || !isFinite(amt) || amt === 0) continue;
    const positive = amt > 0;
    out.push({ include: true, date, desc, amount: Math.abs(amt), type: positive ? "prihod" : "rashod", cat: guessCategory(desc, positive) });
  }
  return out;
}

/* stabilan ID za uvezenu stavku — isti fajl uvezen dvaput ne pravi duplikate */
export const csvTxId = (p: Pick<CsvRow, "date" | "amount" | "desc">) => "csv-" + csvHash(p.date + "|" + p.amount + "|" + p.desc);

/* tekst iz fajla: UTF-8, a ako ima nevalidnih znakova — Windows-1250 (stariji izvodi srpskih banaka) */
export function decodeCsvBytes(buf: ArrayBuffer): string {
  const text = new TextDecoder("utf-8").decode(buf);
  return text.includes("�") ? new TextDecoder("windows-1250").decode(buf) : text;
}
