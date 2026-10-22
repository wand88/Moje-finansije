/* ============ Kreditna sposobnost (EUR / domaća valuta), prevremena otplata, priuštivost auta ============ */
import { PREPAY_FEE_FREE_LIMIT, annuity, carAffordability, maxLoanFor, prepay, type CarInput } from "../lib/finance";
import { fmt, fmtIn, lastMonthForAvg, lastVal, monthOf, sum, txOfYear } from "../model";
import { save, state } from "../store";
import type { CreditState } from "../types";
import { toast } from "../ui/dialog";
import { $, escapeHtml, num } from "../ui/dom";
import { officialRates, refreshRates, renderRatesPanel } from "./rates";

/* ---- kreditna sposobnost ---- */
const CRED_FIELDS = ["crOblig", "crDti", "crApr", "crMargin", "crFx", "crYears", "crDown"] as const;

/* Okvirne vrednosti za Srbiju — uvek proveri aktuelnu ponudu banke. fix = fiksna kamata, margin = marža uz promenljivu. */
const LOAN_PRESETS: Record<string, { years: number; label: string; note: string; EUR: { fix: number; margin: number }; HOME: { fix: number; margin: number } }> = {
  stambeni: {
    years: 30, label: "Stambeni",
    note: "Najčešće indeksiran u evrima; po zakonu najduže 30 godina. Smernica: rata ≤ 28% prihoda.",
    EUR: { fix: 5.5, margin: 3.0 }, HOME: { fix: 8.0, margin: 3.5 },
  },
  potrosacki: {
    years: 6, label: "Potrošački", note: "Najčešće dinarski, rok do 7–8 godina.",
    EUR: { fix: 7.5, margin: 4.0 }, HOME: { fix: 9.9, margin: 4.5 },
  },
  kes: {
    years: 5, label: "Keš", note: "Najčešće dinarski, rok do 5–7 godina.",
    EUR: { fix: 8.5, margin: 5.0 }, HOME: { fix: 11.9, margin: 6.0 },
  },
};
/* polazne referentne stope dok ne uključimo automatsko preuzimanje (ECB / NBS) — korisnik ih prekucava */
const REF_DEFAULT: Record<"EUR" | "HOME", number> = { EUR: 2.0, HOME: 5.5 };
const FX_DEFAULT: Record<string, number> = { RSD: 117.2, BAM: 1.95583, MKD: 61.5, USD: 1.08 };

const home = () => state.currency;
const creditState = (): CreditState => (state.credit ||= { incomes: {} });
/* EUR opcija ima smisla samo kad domaćinstvo ne vodi račune u evrima */
const loanCur = (): "EUR" | "HOME" => (home() !== "EUR" && creditState().loanCur === "EUR" ? "EUR" : "HOME");
const loanCode = () => (loanCur() === "EUR" ? "EUR" : home());
const rateKind = () => creditState().rateKind || "fix";
const refName = (cur: "EUR" | "HOME") => (cur === "EUR" ? "EURIBOR 6M" : home() === "RSD" ? "BELIBOR 3M" : "Referentna stopa");

function applyLoanPreset(key: string, overwrite: boolean): void {
  const p = LOAN_PRESETS[key];
  if (!p) return;
  if (overwrite) {
    const v = p[loanCur()];
    $("crApr").value = String(v.fix);
    $("crMargin").value = String(v.margin);
    $("crYears").value = String(p.years);
  }
  document.querySelectorAll<HTMLButtonElement>("#loanSeg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.l === key);
    b.setAttribute("aria-pressed", String(b.dataset.l === key));
  });
  $("loanNote").innerHTML = `<b>${p.label} kredit</b> — ${p.note} Kamate i referentne stope su okvirne — <b>prekucaj ih prema ponudi banke</b>. Aktuelni EURIBOR objavljuje ECB, a BELIBOR i kurs NBS (nbs.rs).`;
}

/* prosečan mesečni prihod člana u izabranoj godini */
function avgIncomeOf(member: string): number {
  const lastM = lastMonthForAvg();
  const tx = txOfYear().filter((t) => t.type === "prihod" && t.member === member && monthOf(t) <= lastM);
  const months = new Set(tx.map(monthOf)).size;
  return months ? sum(tx, (t) => t.amount) / months : 0;
}

function storeCredit(): void {
  const c = creditState();
  CRED_FIELDS.forEach((f) => (c[f] = num(f)));
  (c.refs ||= {})[loanCur()] = num("crRef");
  document.querySelectorAll<HTMLInputElement>("[data-inc]").forEach((inp) => (c.incomes[inp.dataset.inc!] = parseFloat(inp.value) || 0));
  save();
}

/* polje prihoda za svakog člana — pravi se iznova samo kad se promeni spisak članova (da fokus ne skače) */
let incomesSig = "";
function renderIncomeInputs(): void {
  const sig = state.members.map((m) => m.id + ":" + m.name).join("|") + "|" + home();
  if (sig === incomesSig) return;
  incomesSig = sig;
  const box = $<HTMLDivElement>("crIncomes");
  box.innerHTML = state.members.map((m) => {
    const id = "crInc-" + escapeHtml(m.id);
    return `<div><label for="${id}">Neto prihod — ${escapeHtml(m.name)} (${home()}, mesečno)</label>
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

/* izbor valute i vrste kamate: dugmad, labele i koja polja se vide */
function syncLoanControls(): void {
  const cur = loanCur(), kind = rateKind(), hasEur = home() !== "EUR";
  $<HTMLDivElement>("curSeg").style.display = hasEur ? "" : "none";
  $("curHomeBtn").textContent = home() === "RSD" ? "RSD (dinarski)" : home();
  document.querySelectorAll<HTMLButtonElement>("#curSeg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.cur === cur);
    b.setAttribute("aria-pressed", String(b.dataset.cur === cur));
  });
  document.querySelectorAll<HTMLButtonElement>("#kindSeg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.k === kind);
    b.setAttribute("aria-pressed", String(b.dataset.k === kind));
  });
  $<HTMLDivElement>("crFixWrap").style.display = kind === "fix" ? "" : "none";
  $<HTMLDivElement>("crRefWrap").style.display = kind === "var" ? "" : "none";
  $<HTMLDivElement>("crMarginWrap").style.display = kind === "var" ? "" : "none";
  $<HTMLDivElement>("crFxWrap").style.display = cur === "EUR" ? "" : "none";
  $("crRefLbl").textContent = `${refName(cur)} (%)`;
  $("crFxLbl").textContent = `Kurs: 1 EUR = ? ${home()} (srednji NBS)`;
  $("crDownLbl").textContent = `Raspoloživo učešće (${loanCode()})`;
  /* referentna stopa se puni samo kad se promeni valuta — inače bi prepisala ono što korisnik upravo kuca */
  if (refShownFor !== cur) {
    refShownFor = cur;
    $("crRef").value = String(creditState().refs?.[cur] ?? REF_DEFAULT[cur]);
  }
}
let refShownFor = "";

/* posle uvoza/brisanja podataka: vrati polja iz stanja */
export function initCreditInputs(): void {
  const c = state.credit;
  if (c) CRED_FIELDS.forEach((id) => { if (c[id] !== undefined) $(id).value = String(c[id]); });
  if (!c?.crFx) $("crFx").value = String(FX_DEFAULT[home()] ?? 1);
  incomesSig = "";
  refShownFor = "";
  renderIncomeInputs();
  syncLoanControls();
  /* vrsta kredita: sačuvana ili podrazumevano stambeni (bez prepisivanja unetih vrednosti) */
  applyLoanPreset(c?.loanType || "stambeni", !c);
}

/* zvanične stope (ECB/NBS) upisuju se u polja dok ih korisnik ne prekuca; vraća da li je nešto promenjeno */
function applyOfficialRates(): boolean {
  const r = officialRates();
  const c = creditState();
  if (!r || c.ratesAuto === false) return false;
  let changed = false;
  const set = (id: string, v: number) => {
    const el = $(id);
    if (document.activeElement === el || parseFloat(el.value) === v) return;
    el.value = String(v);
    changed = true;
  };
  if (r.euribor6m) {
    (c.refs ||= {}).EUR = r.euribor6m.value;
    if (loanCur() === "EUR") set("crRef", r.euribor6m.value);
  }
  if (r.eurRsd && home() === "RSD") set("crFx", r.eurRsd.value);
  if (changed) storeCredit();
  return changed;
}

export function renderCredit(): void {
  renderIncomeInputs();
  syncLoanControls();
  applyOfficialRates();
  renderRatesPanel({ auto: creditState().ratesAuto !== false, showFx: home() === "RSD", margin: num("crMargin") || 3 });
  document.getElementById("btnRatesApply")?.addEventListener("click", () => {
    creditState().ratesAuto = true;
    renderCredit();
    toast("Kalkulator ponovo koristi zvanične stope.", "good");
  });
  document.getElementById("btnRatesRefresh")?.addEventListener("click", () => refreshRates(renderCredit, true));
  const cur = loanCur(), code = loanCode(), kind = rateKind();
  const fx = cur === "EUR" ? num("crFx") || 1 : 1; /* koliko jedinica domaće valute vredi jedna jedinica valute kredita */
  const ref = num("crRef"), margin = num("crMargin");
  const apr = kind === "fix" ? num("crApr") : ref + margin;
  const o = { dti: num("crDti"), oblig: num("crOblig"), apr, years: num("crYears") };
  const down = num("crDown");
  const n = Math.max(1, Math.round(o.years * 12));
  const inLoan = (v: number) => fmtIn(v, code);
  const approxHome = (v: number) => (cur === "EUR" ? ` <span class="note">≈ ${fmt(v * fx)}</span>` : "");

  $("rateBox").innerHTML = kind === "fix"
    ? `<span>Fiksna kamata · ${code}</span><b>${apr.toFixed(2).replace(".", ",")}%</b>`
    : `<span>${refName(cur)} ${ref.toFixed(2).replace(".", ",")}% + marža ${margin.toFixed(2).replace(".", ",")}%</span><b>${apr.toFixed(2).replace(".", ",")}%</b>`;

  const incomeOf = (id: string) => parseFloat($(`crInc-${id}`).value) || 0;
  const scenarios = state.members.map((m) => ({ name: `${state.members.length > 1 ? "Samo " : ""}${m.name}`, income: incomeOf(m.id) }));
  if (state.members.length > 1) scenarios.push({ name: "Zajedno", income: sum(state.members, (m) => incomeOf(m.id)) });
  const results = scenarios.map((s) => ({ ...s, ...maxLoanFor(s.income, o) }));
  $("credResults").innerHTML = results.map((s) => {
    const principal = s.principal / fx;
    return `<div class="cred">
      <h3>${escapeHtml(s.name)}</h3>
      <div class="big">${inLoan(principal + down)}</div>
      <div class="note" style="margin-bottom:8px">ukupan budžet za kupovinu${cur === "EUR" ? ` · ≈ ${fmt((principal + down) * fx)}` : ""}</div>
      <div class="rrow"><span>Neto prihod</span><b>${fmt(s.income)}</b></div>
      <div class="rrow"><span>Maks. rata (${o.dti}% − obaveze)</span><b>${inLoan(s.maxRate / fx)}</b></div>
      <div class="rrow"><span>Maks. kredit (${o.years} god)</span><b>${inLoan(principal)}</b></div>
      <div class="rrow"><span>+ učešće</span><b>${inLoan(down)}</b></div>
    </div>`;
  }).join("");

  /* rizici: kurs (EUR kredit, plata u domaćoj valuti) i rast referentne stope (promenljiva kamata) */
  const main = results[results.length - 1];
  const box = $<HTMLDivElement>("fxRisk");
  let html = "";
  if (main && main.income > 0 && main.maxRate > 0) {
    const share = (pay: number) => (100 * (pay + o.oblig)) / main.income;
    const row = (label: string, pay: number) => {
      const sh = share(pay);
      const tone = sh > o.dti + 5 ? "crit" : sh > o.dti ? "warn" : "good";
      return `<div class="result-row"><span>${label}</span><span><b>${fmt(pay)}</b> <span class="pill ${tone}">${sh.toFixed(0)}% prihoda</span></span></div>`;
    };
    if (cur === "EUR") {
      html += `<div class="card-head" style="margin:16px 0 4px"><h2 style="font-size:15px">Ako evro poskupi</h2><span class="note">rata ${inLoan(main.maxRate / fx)}${approxHome(main.maxRate / fx)}</span></div>
        ${row("Današnji kurs", main.maxRate)}${row("Evro skuplji 10%", main.maxRate * 1.1)}${row("Evro skuplji 20%", main.maxRate * 1.2)}
        <p class="note">Rata u evrima ostaje ista, ali plata je u ${home() === "RSD" ? "dinarima" : home()} — sa skupljim evrom rata pojede veći deo prihoda.</p>`;
    }
    if (kind === "var") {
      const principalHome = main.principal;
      const payAt = (bump: number) => annuity(principalHome, (apr + bump) / 1200, n);
      html += `<div class="card-head" style="margin:16px 0 4px"><h2 style="font-size:15px">Ako ${refName(cur)} poraste</h2><span class="note">scenario: ${escapeHtml(main.name)}</span></div>
        ${row("Današnja stopa", payAt(0))}${row("+1 procentni poen", payAt(1))}${row("+2 procentna poena", payAt(2))}`;
    }
  }
  box.innerHTML = html;
}

/* ---- prevremena otplata ---- */
const PP_FIELDS = ["ppPrincipal", "ppApr", "ppMonths", "ppOnce", "ppExtra"];

export function fillPpDebts(): void {
  const sel = $<HTMLSelectElement>("ppDebt");
  const cur = sel.value;
  sel.innerHTML = `<option value="">— ručni unos —</option>` +
    state.debts.filter((d) => lastVal(d) > 0).map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)} — ${fmt(lastVal(d))}</option>`).join("");
  if (cur && state.debts.some((d) => d.id === cur)) sel.value = cur;
  /* valuta kredita za prevremenu otplatu */
  const curSel = $<HTMLSelectElement>("ppCur");
  curSel.options[0].text = home();
  curSel.parentElement!.style.display = home() === "EUR" ? "none" : "";
}

const yrs = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} god ${m % 12} mes` : `${m} mes`);

export function renderPrepay(): void {
  const P = num("ppPrincipal");
  const n = Math.max(1, Math.round(num("ppMonths")));
  const once = num("ppOnce"), extra = num("ppExtra");
  const eur = $("ppCur").value === "EUR" && home() !== "EUR";
  const code = eur ? "EUR" : home();
  const f = (v: number) => fmtIn(v, code);
  const box = $<HTMLDivElement>("ppResults");
  if (!(P > 0)) { box.innerHTML = `<div class="empty">Unesi preostali dug ili izaberi kredit iz obaveza.</div>`; return; }
  const r = prepay(P, num("ppApr"), n, once, extra);
  let html = `
    <div class="result-row"><span>Trenutna rata</span><b>${f(r.M)}</b></div>
    <div class="result-row"><span>Preostala kamata bez izmena</span><b>${f(r.baseInterest)}</b></div>`;
  if (once <= 0 && extra <= 0) {
    box.innerHTML = html + `<div class="callout neutral">Upiši jednokratnu uplatu i/ili dodatni mesečni iznos da vidiš uštede.</div>`;
    return;
  }
  html += `
    <div class="callout" style="margin-top:12px">
      <b>Opcija A — skrati rok</b> (rata ${extra > 0 ? `${f(r.payA)} umesto ${f(r.M)}` : `ostaje ${f(r.M)}`}):<br>
      otplata za <b>${r.nA === Infinity ? "—" : yrs(r.nA)}</b> umesto ${yrs(n)} → <b>kraće za ${r.nA === Infinity ? "—" : yrs(n - r.nA)}</b>,
      ušteda kamate <b>${f(r.savedA)}</b>
    </div>
    <div class="callout neutral" style="margin-top:10px">
      <b>Opcija B — smanji ratu</b> (rok ostaje ${yrs(n)}):<br>
      ${once > 0
        ? `nova rata <b>${f(r.MB)}</b> (mesečno lakše za <b>${f(r.M - r.MB)}</b>), ušteda kamate <b>${f(r.savedB)}</b>${extra > 0 ? ` — dodatno mesečno se računa samo u opciji A` : ""}`
        : `za ovu opciju je potrebna jednokratna uplata — mesečno dodatno prirodno skraćuje rok (opcija A)`}
    </div>`;
  if (r.savedA > 0) {
    const diff = r.savedA - Math.max(0, r.savedB);
    html += `<div class="callout good" style="margin-top:10px">
      <b>Preporuka:</b> ako mesečni budžet nije napet, izaberi <b>skraćenje roka</b> —
      matematički uvek štedi više${once > 0 ? ` (ovde <b>${f(diff)}</b> više nego smanjenje rate)` : ""}.
      Smanjenje rate biraj samo ako ti treba vazduha u mesečnom budžetu ili čekate veći trošak (npr. beba, selidba).
    </div>`;
  }
  /* prag naknade važi u dinarima (Srbija); za EUR kredit preračunava se po kursu iz kalkulatora iznad */
  if (home() === "RSD") {
    const yearlyRsd = (once + extra * 12) * (eur ? num("crFx") || 1 : 1);
    if (yearlyRsd > PREPAY_FEE_FREE_LIMIT) {
      html += `<div class="callout warn" style="margin-top:10px">
        Planiraš <b>${fmt(yearlyRsd)}</b> prevremene otplate za 12 meseci — preko praga od 1.000.000 RSD, pa banka
        <b>može</b> naplatiti naknadu do 1% (≈ ${fmt(yearlyRsd * 0.01)}). Rasporedi uplate tako da u svakih 12 meseci ostaneš ispod praga, ili proveri da li tvoj kredit ima promenljivu stopu (tada naknade nema).
      </div>`;
    }
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
    ok: "Komforno — staje u budžet",
    stretch: "Napeto — preko pravila 15%",
    risk: "Rizično — preskupo za tvoj prihod",
  } as const;
  $("carVerdict").innerHTML = v.cIncome > 0
    ? `<div class="verdict ${r.verdict}"><span>${VERDICT[r.verdict]}</span><span class="pct">${r.pct.toFixed(1)}%</span></div>`
    : `<div class="verdict stretch"><span>Unesi mesečni prihod za ocenu priuštivosti</span></div>`;
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
    creditState().loanType = b.dataset.l;
    applyLoanPreset(b.dataset.l || "stambeni", true);
    storeCredit();
    renderCredit();
  }));
  document.querySelectorAll<HTMLButtonElement>("#curSeg button").forEach((b) => b.addEventListener("click", () => {
    storeCredit(); /* sačuvaj referentnu stopu tekuće valute pre prebacivanja */
    const prev = loanCur();
    creditState().loanCur = b.dataset.cur as "EUR" | "HOME";
    /* učešće je u valuti kredita — preračunaj ga po kursu da ne bi 20.000 RSD postalo 20.000 € */
    const fx = num("crFx") || 1, down = num("crDown");
    if (prev !== loanCur() && down > 0) {
      $("crDown").value = String(loanCur() === "EUR" ? Math.round(down / fx / 100) * 100 : Math.round((down * fx) / 1000) * 1000);
    }
    syncLoanControls();
    applyLoanPreset(creditState().loanType || "stambeni", true);
    storeCredit();
    renderCredit();
  }));
  document.querySelectorAll<HTMLButtonElement>("#kindSeg button").forEach((b) => b.addEventListener("click", () => {
    creditState().rateKind = b.dataset.k as "fix" | "var";
    storeCredit();
    renderCredit();
  }));
  [...CRED_FIELDS, "crRef"].forEach((id) => $(id).addEventListener("input", () => { storeCredit(); renderCredit(); }));
  /* ručna izmena EURIBOR-a ili kursa isključuje automatske vrednosti (dugme ih vraća) */
  ["crRef", "crFx"].forEach((id) => $(id).addEventListener("input", () => {
    if (id === "crRef" && loanCur() !== "EUR") return;
    creditState().ratesAuto = false;
    save();
  }, true));
  $("ppDebt").addEventListener("change", () => {
    const d = state.debts.find((x) => x.id === $("ppDebt").value);
    if (d) $("ppPrincipal").value = String(lastVal(d));
    renderPrepay();
  });
  [...PP_FIELDS, "ppCur"].forEach((id) => $(id).addEventListener("input", renderPrepay));
  $("ppCur").addEventListener("change", renderPrepay);
  CAR_FIELDS.forEach((id) => $(id).addEventListener("input", renderCar));
}

/* posle prvog iscrtavanja: preuzmi zvanične stope (keš 6 h) i ponovo kad se vrati internet */
export function startOfficialRates(): void {
  refreshRates(renderCredit);
  window.addEventListener("online", () => refreshRates(renderCredit));
}
