/* ============ Zvanične stope u aplikaciji: preuzimanje, keš na uređaju, prikaz ============ */
import { annuity } from "../lib/finance";
import { isOfficialRates, type OfficialRates, type RateSeries } from "../lib/rates";
import { fmtIn } from "../model";
import { $, escapeHtml } from "../ui/dom";
import { toast } from "../ui/dialog";

const CACHE_KEY = "mojeFinansije.rates";
const SEEN_KEY = "mojeFinansije.ratesSeen";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

let rates: OfficialRates | null = readCache();
let status: "idle" | "loading" | "error" = "idle";

function readCache(): OfficialRates | null {
  try {
    const x = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return isOfficialRates(x) ? x : null;
  } catch {
    return null;
  }
}

export const officialRates = (): OfficialRates | null => rates;

/* preuzmi sa servera (ako ima interneta i keš je stariji od 6 h); onChange se zove kad stignu nove vrednosti */
export async function refreshRates(onChange: () => void, force = false): Promise<void> {
  if (!navigator.onLine) return;
  if (!force && rates && Date.now() - Date.parse(rates.updated) < MAX_AGE_MS) return;
  status = "loading";
  onChange();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("./api/rates", { signal: ctrl.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data: unknown = await res.json();
    if (!isOfficialRates(data)) throw new Error("format");
    rates = data;
    status = "idle";
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    announceChanges(data);
  } catch {
    status = "error";
  }
  onChange();
}

/* obaveštenje kad se EURIBOR ili kurs promene od poslednjeg viđenja */
function announceChanges(r: OfficialRates): void {
  let seen: Record<string, number> = {};
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { /* ignore */ }
  const now: Record<string, number> = {};
  const msgs: string[] = [];
  const check = (key: string, label: string, s: RateSeries | null, digits: number, unit: string) => {
    if (!s) return;
    now[key] = s.value;
    const old = seen[key];
    if (old !== undefined && Math.abs(old - s.value) >= Math.pow(10, -digits)) {
      msgs.push(`${label} ${s.value > old ? "porastao" : "pao"} sa ${fmtNum(old, digits)}${unit} na ${fmtNum(s.value, digits)}${unit}`);
    }
  };
  check("e6", "EURIBOR 6M", r.euribor6m, 2, "%");
  check("fx", "Kurs evra", r.eurRsd, 2, "");
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seen, ...now })); } catch { /* ignore */ }
  if (msgs.length) toast(msgs.join(" · ") + ".", "warn", 7000);
}

const fmtNum = (v: number, d: number) => v.toLocaleString("sr-RS", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPeriod = (p: string) => (/^\d{4}-\d{2}$/.test(p) ? `${p.slice(5)}/${p.slice(0, 4)}` : /^\d{4}-\d{2}-\d{2}$/.test(p) ? `${p.slice(8)}.${p.slice(5, 7)}.${p.slice(0, 4)}.` : p);

function tile(label: string, s: RateSeries | null, digits: number, unit: string, note: string): string {
  if (!s) return `<div class="tile"><div class="label">${label}</div><div class="value" style="font-size:18px">—</div><div class="sub">trenutno nedostupno</div></div>`;
  let delta = "";
  if (s.prev) {
    const d = s.value - s.prev.value;
    if (Math.abs(d) >= Math.pow(10, -digits)) delta = ` <span class="pill ${d > 0 ? "warn" : "good"}">${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d), digits)}</span>`;
  }
  return `<div class="tile"><div class="label">${label}</div>
    <div class="value" style="font-size:20px">${fmtNum(s.value, digits)}${unit}${delta}</div>
    <div class="sub">${note} ${escapeHtml(fmtPeriod(s.period))}</div></div>`;
}

/* kartica u tabu Krediti; auto = da li kalkulator trenutno koristi preuzete vrednosti */
export function renderRatesPanel(o: { auto: boolean; showFx: boolean; margin: number }): void {
  const box = $<HTMLDivElement>("ratesPanel");
  if (!rates) {
    box.innerHTML = status === "loading"
      ? `<p class="note">Preuzimam zvanične stope…</p>`
      : `<div class="callout neutral" style="margin:0 0 14px">Zvanične stope trenutno nisu dostupne (nema interneta ili servisa). Kalkulator radi sa vrednostima koje uneseš.</div>`;
    return;
  }
  const r = rates;
  /* koliko promena EURIBOR-a u odnosu na prethodni mesec menja ratu kredita od 100.000 € na 30 godina */
  let impact = "";
  if (r.euribor6m?.prev) {
    const before = annuity(100000, (r.euribor6m.prev.value + o.margin) / 1200, 360);
    const after = annuity(100000, (r.euribor6m.value + o.margin) / 1200, 360);
    const d = after - before;
    if (Math.abs(d) >= 1) {
      impact = `<div class="callout ${d > 0 ? "warn" : "good"}" style="margin:0 0 12px">EURIBOR 6M je ${d > 0 ? "porastao" : "pao"} u odnosu na prethodni mesec — za kredit od 100.000 € na 30 godina sa promenljivom kamatom to je oko <b>${fmtIn(Math.abs(d), "EUR")} ${d > 0 ? "veća" : "manja"}</b> rata od sledećeg usklađivanja.</div>`;
    }
  }
  box.innerHTML = `
    <div class="card-head" style="margin-bottom:8px"><h2 style="font-size:15px">Zvanične stope</h2>
      <span class="pill ${o.auto ? "info" : "neutral"}">${o.auto ? "kalkulator ih koristi" : "ručne vrednosti"}</span></div>
    <div class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr)); margin-bottom:10px">
      ${tile("EURIBOR 6M", r.euribor6m, 2, "%", "prosek za")}
      ${tile("EURIBOR 3M", r.euribor3m, 2, "%", "prosek za")}
      ${o.showFx ? tile("Kurs EUR (srednji)", r.eurRsd, 2, "", "NBS,") : ""}
      ${tile("Referentna NBS", r.nbsKeyRate, 2, "%", "odluka")}
    </div>
    ${impact}
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px">
      ${o.auto ? "" : `<button type="button" class="btn ghost sm" id="btnRatesApply">Koristi zvanične stope</button>`}
      <button type="button" class="btn ghost sm" id="btnRatesRefresh">Osveži</button>
      <span class="note">Izvori: ECB, NBS · ažurirano ${new Date(r.updated).toLocaleString("sr-RS", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
    </div>`;
}
