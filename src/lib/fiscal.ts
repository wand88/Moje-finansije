import { isoLocal } from "./dates";

export interface FiscalScan {
  url: string;
  amount?: number;
  date?: string;
}

export function b64uToBytes(s: string): Uint8Array {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

/* Iz verifikacionog URL-a (suf.purs.gov.rs) čita iznos i datum.
   Raspored polja po TaxCore specifikaciji: verzija(1) + kasa(8) + potpisnik(8)
   + brojači(4+4) + IZNOS (8B LE, u 1/10000) + DATUM (8B LE, unix ms).
   Ako dekodirane vrednosti nisu razumne, vraćamo samo link — korisnik unosi ručno. */
export function decodeFiscalUrl(raw: string): FiscalScan | null {
  try {
    const u = new URL(String(raw).trim());
    if (!/suf\.purs\.gov\.rs$/i.test(u.hostname)) return null;
    const vl = u.searchParams.get("vl");
    const res: FiscalScan = { url: u.href };
    if (!vl) return res;
    const b = b64uToBytes(vl);
    if (b.length < 41) return res;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const amount = Number(dv.getBigUint64(25, true)) / 10000;
    const d = new Date(Number(dv.getBigUint64(33, true)));
    if (amount > 0 && amount < 100000000 && d.getFullYear() >= 2021 && d.getFullYear() <= 2035) {
      res.amount = Math.round(amount * 100) / 100;
      res.date = isoLocal(d);
    }
    return res;
  } catch {
    return null;
  }
}

export const isFiscalLink = (link?: string): link is string => !!link && /^https:\/\/suf\.purs\.gov\.rs\//i.test(link);
