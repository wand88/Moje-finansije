/* ============ Kreditna sposobnost, prevremena otplata, priuštivost auta ============ */
import { PREPAY_FEE_FREE_LIMIT, carAffordability, maxLoanFor, prepay, type CarInput } from "../lib/finance";
import { fmt, lastMonthForAvg, lastVal, monthOf, sum, txOfYear } from "../model";
import { save, state } from "../store";
import type { CreditState } from "../types";
import { $, escapeHtml, num } from "../ui/dom";

/* ---- kreditna sposobnost ---- */
const CRED_FIELDS = ["crOblig", "crDti", "crApr", "crYears", "crDown"] as const;
/* Okvirni proseci za Srbiju (jul 2026) — uvek proveri aktuelnu ponudu banke i NBS statistiku */
const LOAN_PRESETS: Record<string, { apr: number; years: number; label: string; note: string }> = {
  stambeni: { apr: 5.5, years: 30, label: "Stambeni", note: "EUR-indeksirani, tipično ~5–6% efektivno, po zakonu maksimalno 30 god. Smernica: rata ≤ 28% prihoda." },
  potrosacki: { apr: 9.9, years: 6, label: "Potrošački", note: "tipično ~9–11% efektivno, do 7–8 god." },
  kes: { apr: 11.9, years: 5, label: "Keš", note: "dinarski, tipično ~10–13% efektivno, do 5–7 god." },
};

function applyLoanPreset(key: string, overwrite: boolean): void {
  const p = LOAN_PRESETS[key];
  if (!p) return;
  if (overwrite) {
    $("crApr").value = String(p.apr);
    $("crYears").value = String(p.years);
  }
  document.querySelectorAll<HTMLButtonElement>("#loanSeg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.l === key);
    b.setAttribute("aria-pressed", String(b.dataset.l === key));
  });
  $("loanNote").innerHTML =
    `<b>${p.label} kredit</b> — ${p.note} Ubačena je okvirna prosečna kamata za Srbiju (jul 2026); ` +
    `aplikacija radi bez interneta pa ne može sama da povlači aktuelne kamate — <b>prekucaj kamatu i rok prema konkretnoj ponudi</b> (NBS objavljuje prosek na nbs.rs).`;
}

/* prosečan mesečni prihod člana u izabranoj godini */
function avgIncomeOf(member: string): number {
  const lastM = lastMonthForAvg();
  const tx = txOfYear().filter((t) => t.type === "prihod" && t.member === member && monthOf(t) <= lastM);
  const months = new Set(tx.map(monthOf)).size;
  return months ? sum(tx, (t) => t.amount) / months : 0;
}

function creditState(): CreditState {
  return (state.credit ||= { incomes: {} });
}

function storeCredit(): void {
  const c = creditState();
  CRED_FIELDS.forEach((f) => (c[f] = num(f)));
  document.querySelectorAll<HTMLInputElement>("[data-inc]").forEach((inp) => (c.incomes[inp.dataset.inc!] = parseFloat(inp.value) || 0));
  save();
}

/* polje prihoda za svakog člana — pravi se iznova samo kad se promeni spisak članova (da fokus ne skače) */
let incomesSig = "";
function renderIncomeInputs(): void {
  const sig = state.members.map((m) => m.id + ":" + m.name).join("|");
  if (sig === incomesSig) return;
  incomesSig = sig;
  const box = $<HTMLDivElement>("crIncomes");
  box.innerHTML = state.members.map((m) => {
    const id = "crInc-" + escapeHtml(m.id);
    return `<div><label for="${id}">Neto prihod — ${escapeHtml(m.name)} (mesečno)</label>
      <input type="number" id="${id}" data-inc="${escapeHtml(m.id)}" min="0" step="50" inputmode="decimal"></div>`;
  }).join("");
  const saved = state.credit?.incomes || {};
  box.querySelectorAll<HTMLInputElement>("[data-inc]").forEach((inp) => {
    const id = inp.dataset.inc!;
    /* ako prihod nije unet, predloži prosek iz podataka */
    const v = saved[id] > 0 ? saved[id] : Math.round(avgIncomeOf(id));
    if (v > 0) inp.value = String(v);
    inp.addEventListener("input", () => { storeCredit(); renderCredit(); });
  });
}

/* posle uvoza/brisanja podataka: vrati polja iz stanja */
export function initCreditInputs(): void {
  const c = state.credit;
  if (c) CRED_FIELDS.forEach((id) => { if (c[id] !== undefined) $(id).value = String(c[id]); });
  incomesSig = "";
  renderIncomeInputs();
  /* vrsta kredita: sačuvana ili podrazumevano stambeni (bez prepisivanja unetih vrednosti) */
  applyLoanPreset(c?.loanType || "stambeni", !c);
}

export function renderCredit(): void {
  renderIncomeInputs();
  const o = { dti: num("crDti"), oblig: num("crOblig"), apr: num("crApr"), years: num("crYears") };
  const down = num("crDown");
  const incomeOf = (id: string) => parseFloat($(`crInc-${id}`).value) || 0;
  const scenarios = state.members.map((m) => ({ name: `👤 ${state.members.length > 1 ? "Samo " : ""}${m.name}`, income: incomeOf(m.id) }));
  if (state.members.length > 1) scenarios.push({ name: "🤝 Zajedno", income: sum(state.members, (m) => incomeOf(m.id)) });
  $("credResults").innerHTML = scenarios.map((s) => {
    const { maxRate, principal } = maxLoanFor(s.income, o);
    return `<div class="cred">
      <h3>${escapeHtml(s.name)}</h3>
      <div class="rrow"><span>Neto prihod</span><b>${fmt(s.income)}</b></div>
      <div class="rrow"><span>Maks. rata (${o.dti}% − obaveze)</span><b>${fmt(maxRate)}</b></div>
      <div class="rrow"><span>Maks. kredit (${o.years} god, ${o.apr}%)</span><b>${fmt(principal)}</b></div>
      <div class="rrow" style="border-top:1px solid var(--grid); margin-top:6px; padding-top:8px"><span>+ učešće</span><b>${fmt(down)}</b></div>
      <div class="big">${fmt(principal + down)}</div>
      <div class="note">ukupan budžet za kupovinu</div>
    </div>`;
  }).join("");
}

/* ---- prevremena otplata ---- */
const PP_FIELDS = ["ppPrincipal", "ppApr", "ppMonths", "ppOnce", "ppExtra"];

export function fillPpDebts(): void {
  const sel = $<HTMLSelectElement>("ppDebt");
  const cur = sel.value;
  sel.innerHTML = `<option value="">— ručni unos —</option>` +
    state.debts.filter((d) => lastVal(d) > 0).map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)} — ${fmt(lastVal(d))}</option>`).join("");
  if (cur && state.debts.some((d) => d.id === cur)) sel.value = cur;
}

const yrs = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} god ${m % 12} mes` : `${m} mes`);

export function renderPrepay(): void {
  const P = num("ppPrincipal");
  const n = Math.max(1, Math.round(num("ppMonths")));
  const once = num("ppOnce"), extra = num("ppExtra");
  const box = $<HTMLDivElement>("ppResults");
  if (!(P > 0)) { box.innerHTML = `<div class="empty">Unesi preostali dug ili izaberi kredit iz obaveza.</div>`; return; }
  const r = prepay(P, num("ppApr"), n, once, extra);
  let html = `
    <div class="result-row"><span>Trenutna rata</span><b>${fmt(r.M)}</b></div>
    <div class="result-row"><span>Preostala kamata bez izmena</span><b>${fmt(r.baseInterest)}</b></div>`;
  if (once <= 0 && extra <= 0) {
    box.innerHTML = html + `<div class="callout" style="margin-top:12px">Upiši jednokratnu uplatu i/ili dodatni mesečni iznos da vidiš uštede.</div>`;
    return;
  }
  html += `
    <div class="callout" style="border-left-color:var(--s2); margin-top:12px">
      <b>Opcija A — skrati rok</b> (rata ${extra > 0 ? `${fmt(r.payA)} umesto ${fmt(r.M)}` : `ostaje ${fmt(r.M)}`}):<br>
      otplata za <b>${r.nA === Infinity ? "—" : yrs(r.nA)}</b> umesto ${yrs(n)} → <b>kraće za ${r.nA === Infinity ? "—" : yrs(n - r.nA)}</b>,
      ušteda kamate <b>${fmt(r.savedA)}</b>
    </div>
    <div class="callout" style="border-left-color:var(--s5); margin-top:10px">
      <b>Opcija B — smanji ratu</b> (rok ostaje ${yrs(n)}):<br>
      ${once > 0
        ? `nova rata <b>${fmt(r.MB)}</b> (mesečno lakše za <b>${fmt(r.M - r.MB)}</b>), ušteda kamate <b>${fmt(r.savedB)}</b>${extra > 0 ? ` <span class="note">— dodatno mesečno se računa samo u opciji A</span>` : ""}`
        : `<span class="note">za ovu opciju je potrebna jednokratna uplata — mesečno dodatno prirodno skraćuje rok (opcija A)</span>`}
    </div>`;
  if (r.savedA > 0) {
    const diff = r.savedA - Math.max(0, r.savedB);
    html += `<div class="callout" style="border-left-color:var(--good); margin-top:10px">
      💡 <b>Preporuka:</b> ako mesečni budžet nije napet (pogledaj Pametni budžet), izaberi <b>skraćenje roka</b> —
      matematički uvek štedi više${once > 0 ? ` (ovde <b>${fmt(diff)}</b> više nego smanjenje rate)` : ""}.
      Smanjenje rate biraj samo ako ti treba vazduha u mesečnom budžetu ili čekate veći trošak (npr. beba, selidba).
    </div>`;
  }
  const yearly = once + extra * 12;
  if (yearly > PREPAY_FEE_FREE_LIMIT) {
    html += `<div class="callout" style="border-left-color:var(--warn); margin-top:10px">
      ⚠️ Planiraš <b>${fmt(yearly)}</b> prevremene otplate za 12 meseci — preko praga od 1.000.000 RSD, pa banka
      <b>može</b> naplatiti naknadu do 1% (≈ ${fmt(yearly * 0.01)}). Trik: rasporedi uplate tako da u svakih 12 meseci ostaneš ispod praga, ili proveri da li tvoj kredit ima promenljivu stopu (tada naknade nema).
    </div>`;
  }
  box.innerHTML = html;
}

/* ---- auto ---- */
const CAR_FIELDS = ["cPrice", "cDown", "cApr", "cTerm", "cIns", "cFuel", "cMaint", "cIncome"] as const;

export function restoreCarInputs(): void {
  const car = state.car;
  if (car) CAR_FIELDS.forEach((id) => { if (car[id] !== undefined) $(id).value = String(car[id]); });
}

export function renderCar(): void {
  const v = Object.fromEntries(CAR_FIELDS.map((id) => [id, num(id)])) as unknown as CarInput;
  state.car = { ...v };
  save();
  const r = carAffordability(v);
  const VERDICT = {
    ok: ["✅", "Komforno — staje u budžet"],
    stretch: ["⚠️", "Napeto — preko pravila 15%"],
    risk: ["⛔", "Rizično — preskupo za tvoj prihod"],
  } as const;
  const [icon, label] = VERDICT[r.verdict];
  $("carVerdict").innerHTML = v.cIncome > 0
    ? `<div class="verdict ${r.verdict}"><span>${icon}</span><span>${label}</span><span class="pct">${r.pct.toFixed(1)}%</span></div>`
    : `<div class="verdict stretch"><span>ℹ️</span><span>Unesi mesečni prihod za ocenu priuštivosti</span></div>`;
  $("carResults").innerHTML = `
    <div class="result-row"><span>Iznos kredita</span><b>${fmt(r.principal)}</b></div>
    <div class="result-row"><span>Mesečna rata</span><b>${fmt(r.payment)}</b></div>
    <div class="result-row"><span>Ukupan mesečni trošak auta</span><b>${fmt(r.monthlyTotal)}</b></div>
    <div class="result-row"><span>Udeo u prihodu</span><b>${v.cIncome > 0 ? r.pct.toFixed(1) + "%" : "—"}</b></div>
    <div class="result-row"><span>Ukupna kamata (${r.n} meseci)</span><b>${fmt(r.totalInterest)}</b></div>
    <div class="result-row"><span>Stvarni ukupan trošak vozila</span><b>${fmt(r.trueCost)}</b></div>
    <div class="result-row"><span>Potreban prihod za pravilo 15%</span><b>${fmt(r.neededIncome)}</b></div>`;
}

export function initCredit(): void {
  document.querySelectorAll<HTMLButtonElement>("#loanSeg button").forEach((b) => b.addEventListener("click", () => {
    applyLoanPreset(b.dataset.l || "stambeni", true);
    creditState().loanType = b.dataset.l;
    storeCredit();
    renderCredit();
  }));
  CRED_FIELDS.forEach((id) => $(id).addEventListener("input", () => { storeCredit(); renderCredit(); }));
  $("ppDebt").addEventListener("change", () => {
    const d = state.debts.find((x) => x.id === $("ppDebt").value);
    if (d) $("ppPrincipal").value = String(lastVal(d));
    renderPrepay();
  });
  PP_FIELDS.forEach((id) => $(id).addEventListener("input", renderPrepay));
  CAR_FIELDS.forEach((id) => $(id).addEventListener("input", renderCar));
}
