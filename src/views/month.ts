/* ============ Mesečno: unos, budžet, tempo potrošnje, transakcije ============ */
import { daysInMonth, fmtDate } from "../lib/dates";
import { isFiscalLink } from "../lib/fiscal";
import { suggestBudget } from "../lib/finance";
import {
  MONTHS, MONTHS_S, catById, catsOf, expCats, fmt, fmtN, lastMonthForAvg, memberBadge, memberName, memberOptions,
  monthOf, passFilter, sum, txOfYear,
} from "../model";
import { device, save, state, uid } from "../store";
import { SHARED, type TxType } from "../types";
import { expTotals, renderCatBars, renderDonut, renderLines, type Series } from "../ui/charts";
import { alertDialog, confirmDialog } from "../ui/dialog";
import { $, escapeHtml, onData } from "../ui/dom";
import { commit } from "./app";
import { renderRecurring } from "./recurring";
import { clearPendingScan, pendingScanLink } from "./scan";

const MEMBER_SELECTS = ["txMember", "gMember", "aMember", "dMember", "csvMember", "recMember"];

export function fillMemberSelects(): void {
  const opts = memberOptions();
  MEMBER_SELECTS.forEach((id) => {
    const s = $<HTMLSelectElement>(id);
    const cur = s.value;
    s.innerHTML = opts;
    if (cur && [...s.options].some((o) => o.value === cur)) s.value = cur;
    else if (device && [...s.options].some((o) => o.value === device)) s.value = device;
    else s.value = SHARED;
  });
}

export function fillCatSelect(): void {
  const sel = $<HTMLSelectElement>("txCat");
  const cur = sel.value;
  sel.innerHTML = catsOf($("txType").value).map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  updateGoalPick();
}

function updateGoalPick(): void {
  const isSaving = $("txType").value === "rashod" && $("txCat").value === "stednja";
  $<HTMLDivElement>("goalPickWrap").style.display = isSaving && state.goals.length ? "block" : "none";
  $("txGoal").innerHTML = `<option value="">— bez cilja —</option>` +
    state.goals.map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join("");
}

export function setEntryType(t: TxType): void {
  $("txType").value = t;
  updateEntryCard();
  fillCatSelect();
}

export function updateEntryCard(): void {
  const t = $("txType").value;
  const card = $<HTMLDivElement>("txCard");
  card.classList.toggle("rashod", t === "rashod");
  card.classList.toggle("prihod", t === "prihod");
  $("txFormTitle").textContent = t === "prihod" ? "➕ Novi prihod" : "➖ Novi trošak";
  document.querySelectorAll<HTMLButtonElement>("#typeSeg button").forEach((x) => {
    x.classList.toggle("active", x.dataset.t === t);
    x.setAttribute("aria-pressed", String(x.dataset.t === t));
  });
  $<HTMLDivElement>("quickChips").style.display = t === "rashod" ? "flex" : "none";
}

/* brzi unos čestih troškova — popunjava kategoriju i opis */
const QUICK = [
  { label: "🏠 Kirija", cat: "dom", note: "Kirija" },
  { label: "⚡ Struja", cat: "racuni", note: "Struja" },
  { label: "🏢 Infostan", cat: "racuni", note: "Infostan" },
  { label: "📶 Internet i TV", cat: "racuni", note: "Internet i TV" },
  { label: "📱 Telefon", cat: "racuni", note: "Mobilni telefon" },
  { label: "🛒 Namirnice", cat: "potrosnja", note: "Namirnice" },
  { label: "⛽ Gorivo", cat: "vozilo", note: "Gorivo" },
  { label: "🚗 Registracija", cat: "vozilo", note: "Registracija auta" },
  { label: "🔧 Servis auta", cat: "vozilo", note: "Servis / održavanje" },
  { label: "👕 Garderoba", cat: "garderoba", note: "Garderoba" },
  { label: "⌚ Sat / nakit", cat: "garderoba", note: "Sat / nakit" },
  { label: "📺 Pretplata", cat: "pretplate", note: "Pretplata" },
];

function initQuickChips(): void {
  const box = $<HTMLDivElement>("quickChips");
  box.innerHTML = QUICK.map((q, i) => `<button type="button" class="chip" data-q="${i}">${q.label}</button>`).join("");
  onData(box, "q", (i) => {
    const q = QUICK[Number(i)];
    setEntryType("rashod");
    $("txCat").value = q.cat;
    updateGoalPick();
    $("txNote").value = q.note;
    $("txAmount").focus();
  });
}

export function initMonth(): void {
  initQuickChips();
  $("txType").addEventListener("change", fillCatSelect);
  $("txCat").addEventListener("change", updateGoalPick);
  $("txSearch").addEventListener("input", renderTxTable);
  document.querySelectorAll<HTMLButtonElement>("#typeSeg button").forEach((b) =>
    b.addEventListener("click", () => setEntryType(b.dataset.t as TxType)),
  );

  $<HTMLFormElement>("txForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat($("txAmount").value);
    if (!(amount > 0)) return;
    const type = $("txType").value as TxType;
    const category = $("txCat").value;
    const goal = $("txGoal").value;
    const date = $("txDate").value;
    state.tx.push({
      id: uid(), date, type, category,
      member: $("txMember").value,
      enteredBy: device || undefined,
      link: pendingScanLink() || undefined,
      warranty: $("txWarranty").value || undefined,
      note: $("txNote").value.trim(),
      goalId: type === "rashod" && category === "stednja" && goal ? goal : undefined,
      amount,
    });
    clearPendingScan();
    for (const id of ["txAmount", "txNote", "txGoal", "txWarranty"]) $(id).value = "";
    state.selMonth = parseInt(date.slice(5, 7), 10) - 1;
    commit();
  });

  $("btnSuggestBudget").addEventListener("click", async () => {
    const income = familyAvgIncome();
    if (!(income > 0)) { await alertDialog("Prvo unesi bar jedan mesec prihoda, da imamo od čega da računamo."); return; }
    if (Object.keys(state.budgets).length && !(await confirmDialog("Prepisati postojeći plan predlogom po pravilu 50/30/20?"))) return;
    Object.assign(state.budgets, suggestBudget(income));
    save();
    renderBudget();
  });
  $("btnRollover").addEventListener("click", () => {
    state.budgetRollover = !state.budgetRollover;
    save();
    renderBudget();
  });
}

/* prosečan mesečni prihod domaćinstva u izabranoj godini */
export function familyAvgIncome(): number {
  const lastM = lastMonthForAvg();
  const tx = txOfYear().filter((t) => t.type === "prihod" && monthOf(t) <= lastM);
  const months = new Set(tx.map(monthOf));
  return months.size ? sum(tx, (t) => t.amount) / months.size : 0;
}

/* proseci rashoda po kategoriji iz prethodnih meseci (koji imaju unose) i potrošeno u mesecu m */
function monthStats(m: number) {
  const tx = txOfYear();
  const k = new Set(tx.filter((t) => monthOf(t) < m).map(monthOf)).size;
  const avg: Record<string, number> = {}, spent: Record<string, number> = {};
  tx.forEach((t) => {
    if (t.type !== "rashod") return;
    const mm = monthOf(t);
    if (mm === m) spent[t.category] = (spent[t.category] || 0) + t.amount;
    else if (mm < m && k > 0) avg[t.category] = (avg[t.category] || 0) + t.amount / k;
  });
  return { tx, k, avg, spent };
}

/* referentni budžet meseca (plan ili prosek, bez štednje) — koristi ga tempo potrošnje i dnevni limit */
function budgetTotals(m: number): { refSum: number; spentSum: number } {
  const { avg, spent } = monthStats(m);
  let refSum = 0, spentSum = 0;
  expCats().forEach((c) => {
    if (c.id === "stednja") return;
    const ref = (state.budgets[c.id] || 0) > 0 ? state.budgets[c.id] : avg[c.id] || 0;
    if (ref > 0) { refSum += ref; spentSum += spent[c.id] || 0; }
  });
  return { refSum, spentSum };
}

function renderPace(m: number): void {
  $("paceLbl").textContent = MONTHS[m];
  const D = daysInMonth(state.year, m);
  const labels = Array.from({ length: D }, (_, i) => String(i + 1) + ".");
  const now = new Date();
  const isCur = state.year === now.getFullYear() && m === now.getMonth();
  const upTo = isCur ? now.getDate() : D;
  const dailyCum = (mm: number): number[] | null => {
    if (mm < 0) return null;
    const tx = txOfYear().filter((t) => t.type === "rashod" && t.category !== "stednja" && monthOf(t) === mm && passFilter(t));
    if (!tx.length) return null;
    const per: number[] = Array(D).fill(0);
    tx.forEach((t) => { per[Math.min(D, parseInt(t.date.slice(8, 10), 10)) - 1] += t.amount; });
    let run = 0;
    return per.map((v) => (run += v));
  };
  const cur = dailyCum(m);
  const prev = dailyCum(m - 1);
  const { refSum } = budgetTotals(m);
  const series: Series[] = [];
  if (cur) series.push({ name: "Ovaj mesec", color: "var(--s1)", vals: cur.map((v, i) => (i < upTo ? v : null)) });
  if (prev) series.push({ name: "Prošli mesec", color: "var(--s5)", vals: prev, noDots: true });
  if (refSum > 0) series.push({ name: "Plan (ravnomerno)", color: "var(--muted)", vals: labels.map((_, i) => (refSum * (i + 1)) / D), dash: true, noDots: true });
  const note = $<HTMLDivElement>("paceNote");
  if (!series.length) {
    $("chartPace").innerHTML = `<div class="empty">Unesi troškove da vidiš tempo potrošnje.</div>`;
    note.innerHTML = "";
    return;
  }
  renderLines("chartPace", labels, series);
  if (!(refSum > 0 && isCur)) { note.innerHTML = ""; return; }
  const spent = cur ? cur[upTo - 1] : 0;
  const shouldBe = (refSum * upTo) / D;
  const left = refSum - spent;
  const daysLeft = D - upTo + 1;
  if (left <= 0) {
    note.innerHTML = `<div class="callout" style="border-left-color:var(--crit)">⛔ Plan za ovaj mesec je već potrošen (<b>${fmt(-left)}</b> preko). Svaki novi trošak jede budžet sledećeg meseca.</div>`;
  } else if (spent <= shouldBe) {
    note.innerHTML = `<div class="callout" style="border-left-color:var(--good)">✅ Sporiji si od kalendara — potrošeno ${fmtN(spent)} od plana ${fmtN(refSum)}. Ostaje ti <b>${fmt(left)}</b>, tj. <b>${fmt(left / daysLeft)}/dan</b> narednih ${daysLeft} dana.</div>`;
  } else {
    note.innerHTML = `<div class="callout" style="border-left-color:var(--warn)">⚠️ Trošiš brže nego što mesec prolazi (${fmtN(spent)} vs ${fmtN(shouldBe)} „po kalendaru"). Da ostaneš u planu: najviše <b>${fmt(left / daysLeft)}/dan</b> narednih ${daysLeft} dana.</div>`;
  }
}

function renderBudget(): void {
  const m = state.selMonth;
  $("budgetLbl").textContent = MONTHS[m];
  const { tx, k, avg, spent } = monthStats(m);

  /* YNAB „rollover": neiskorišćeni plan iz prethodnih meseci se prenosi */
  const roll = !!state.budgetRollover;
  const rollBtn = $<HTMLButtonElement>("btnRollover");
  rollBtn.textContent = roll ? "↪ Prenos: UKLJUČEN" : "↪ Prenos: isključen";
  rollBtn.setAttribute("aria-pressed", String(roll));
  const cumSpent: Record<string, number> = {};
  if (roll) tx.forEach((t) => { if (t.type === "rashod" && monthOf(t) <= m) cumSpent[t.category] = (cumSpent[t.category] || 0) + t.amount; });
  let html = roll ? `<p class="note" style="margin-bottom:10px">↪ „Dostupno" = plan × ${m + 1} ${m === 0 ? "mesec" : m < 4 ? "meseca" : "meseci"} (jan–${MONTHS_S[m].toLowerCase()}) − sve potrošeno do sada. Neiskorišćeno iz prošlih meseci se prenosi, prekoračenja se odbijaju — kao u YNAB-u.</p>` : "";
  html += `<table><thead><tr><th>Kategorija</th><th class="num">Tvoj prosek/mes</th><th class="num">Plan (opciono)</th><th class="num">Ovaj mesec</th>${roll ? `<th class="num">Dostupno ↪</th>` : ""}<th>Status</th></tr></thead><tbody>`;
  let refSum = 0, spentSum = 0, anyRef = false;
  expCats().forEach((c) => {
    const a = avg[c.id] || 0, b = state.budgets[c.id] || 0, s = spent[c.id] || 0;
    const ref = b > 0 ? b : a > 0 ? a : 0;
    let status = `<span class="note">—</span>`;
    if (ref > 0) {
      const d = Math.round((100 * (s - ref)) / ref);
      if (c.id === "stednja") {
        status = s >= ref
          ? `<span style="color:var(--good-text);font-weight:700">💪 +${d}% više štednje</span>`
          : `<span style="color:var(--ink-2);font-weight:600">📉 ${d}% manje štednje</span>`;
      } else if (s <= ref) {
        status = `<span style="color:var(--good-text);font-weight:700">✅ ${d === 0 ? "tačno na planu" : Math.abs(d) + "% ispod"}</span>`;
      } else if (d <= 10) {
        status = `<span style="font-weight:600">⚠️ +${d}% iznad</span>`;
      } else {
        status = `<span style="color:var(--crit);font-weight:700">🔴 +${d}% iznad</span>`;
      }
      if (c.id !== "stednja") { refSum += ref; spentSum += s; anyRef = true; }
    }
    let availCell = "";
    if (roll) {
      if (!(b > 0)) availCell = `<td class="num"><span class="note">—</span></td>`;
      else {
        const avail = b * (m + 1) - (cumSpent[c.id] || 0);
        availCell = `<td class="num" style="font-weight:700;${avail < 0 ? "color:var(--crit)" : "color:var(--good-text)"}">${fmtN(avail)}</td>`;
      }
    }
    html += `<tr>
      <td><span class="cat-dot" style="background:${escapeHtml(c.color)}"></span>${escapeHtml(c.name)}</td>
      <td class="num">${a > 0 ? fmtN(a) : "—"}</td>
      <td class="num"><input class="mini" type="number" min="0" step="100" data-budget="${escapeHtml(c.id)}" value="${b || ""}" placeholder="auto" aria-label="Plan — ${escapeHtml(c.name)}"></td>
      <td class="num" style="font-weight:600">${fmtN(s)}</td>
      ${availCell}
      <td>${status}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  const box = $<HTMLDivElement>("budgetTable");
  box.innerHTML = html;
  onData(box, "budget", (id, el) => {
    const v = parseFloat((el as HTMLInputElement).value);
    if (v > 0) state.budgets[id] = v; else delete state.budgets[id];
    save();
    renderBudget();
  }, "change");

  /* pohvala / upozorenje za ceo mesec (bez štednje) */
  const praise = $<HTMLDivElement>("budgetPraise");
  if (!anyRef) {
    praise.innerHTML = k === 0
      ? `<div class="callout">ℹ️ Kad uneseš prvi pun mesec troškova, ovde ću sam projektovati očekivanu potrošnju i pratiti da li si iznad ili ispod svog proseka.</div>`
      : "";
    return;
  }
  const d = spentSum - refSum;
  const pct = Math.round((100 * Math.abs(d)) / refSum);
  if (d <= 0 && spentSum > 0) {
    praise.innerHTML = `<div class="callout" style="border-left-color:var(--good)">🎉 <b>Bravo!</b> Ovog meseca ste ${pct === 0 ? "tačno na planu" : `<b>${pct}% ispod</b> svog proseka/plana (−${fmt(Math.abs(d))})`} — taj višak preusmerite u 🎯 ciljeve ili 💎 imovinu, tako se grade dugoročni aseti.</div>`;
  } else if (d > 0 && d <= refSum * 0.05) {
    praise.innerHTML = `<div class="callout">👌 Skoro na planu — svega +${fmt(d)} iznad proseka. Sitnica, ali oko na crvene kategorije.</div>`;
  } else if (d > 0) {
    praise.innerHTML = `<div class="callout" style="border-left-color:var(--crit)">😬 Potrošnja je <b>${pct}% iznad</b> proseka/plana (+${fmt(d)}). Pogledajte kategorije označene 🔴 — svaki dinar iznad plana je dinar manje za ciljeve.</div>`;
  } else {
    praise.innerHTML = "";
  }
}

function renderMonthBtns(): void {
  const box = $<HTMLDivElement>("monthBtns");
  box.innerHTML = "";
  MONTHS_S.forEach((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = m;
    b.title = MONTHS[i];
    b.classList.toggle("active", i === state.selMonth);
    b.setAttribute("aria-pressed", String(i === state.selMonth));
    b.addEventListener("click", () => { state.selMonth = i; save(); renderMonth(); });
    box.appendChild(b);
  });
}

/* dnevni limit do kraja meseca (kao Toshl/mani) */
function dailyLimitTile(m: number): string {
  const bt = budgetTotals(m);
  const now = new Date();
  if (!(state.year === now.getFullYear() && m === now.getMonth()) || bt.refSum <= 0) return "";
  const daysLeft = daysInMonth(state.year, m) - now.getDate() + 1;
  const left = bt.refSum - bt.spentSum;
  return `<div class="tile"><div class="label">💳 Dnevno do kraja meseca</div>
    <div class="value ${left < 0 ? "neg" : "pos"}">${left > 0 ? fmt(left / daysLeft) : fmt(0)}</div>
    <div class="sub">${left > 0 ? `preostalo ${fmtN(left)} · još ${daysLeft} dana` : `plan probijen za ${fmtN(-left)}`}</div></div>`;
}

export function renderMonth(): void {
  renderMonthBtns();
  renderRecurring();
  const m = state.selMonth;
  $("monthCatLbl").textContent = MONTHS[m];
  $("monthTxLbl").textContent = MONTHS[m] + " " + state.year + ".";
  const dEl = $("txDate");
  if (!dEl.value || parseInt(dEl.value.slice(5, 7), 10) - 1 !== m || dEl.value.slice(0, 4) !== String(state.year)) {
    const today = new Date();
    const day = today.getFullYear() === state.year && today.getMonth() === m ? today.getDate() : 1;
    dEl.value = `${state.year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const tx = txOfYear().filter((t) => monthOf(t) === m && passFilter(t));
  const inc = sum(tx.filter((t) => t.type === "prihod"), (t) => t.amount);
  const exp = sum(tx.filter((t) => t.type === "rashod"), (t) => t.amount);
  const saved = sum(tx.filter((t) => t.type === "rashod" && t.category === "stednja"), (t) => t.amount);
  $("monthTiles").innerHTML = `
    <div class="tile"><div class="label">Prihodi</div><div class="value">${fmt(inc)}</div></div>
    <div class="tile"><div class="label">Rashodi</div><div class="value">${fmt(exp)}</div></div>
    <div class="tile"><div class="label">Bilans meseca</div><div class="value ${inc - exp >= 0 ? "pos" : "neg"}">${fmt(inc - exp)}</div></div>
    <div class="tile"><div class="label">Uplaćeno u štednju</div><div class="value">${fmt(saved)}</div></div>
    ${dailyLimitTile(m)}`;
  renderBudget();
  const totals = expTotals(tx);
  renderCatBars("chartMonthCats", totals);
  renderDonut("donutMonth", expCats().map((c) => ({ name: c.name, color: c.color, v: totals[c.id] || 0 })), MONTHS[m].toLowerCase());
  renderPace(m);
  renderTxTable();
}

function renderTxTable(): void {
  const m = state.selMonth;
  const box = $<HTMLDivElement>("txTable");
  const tx = txOfYear().filter((t) => monthOf(t) === m && passFilter(t)).sort((a, b) => b.date.localeCompare(a.date));
  if (tx.length === 0) { box.innerHTML = `<div class="empty">Nema transakcija za ovaj mesec i filter — dodaj prvu iznad. 👆</div>`; return; }
  const q = ($("txSearch").value || "").trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const shown = q
    ? tx.filter((t) => (t.note || "").toLowerCase().includes(q)
      || catById(t.category).name.toLowerCase().includes(q)
      || (qDigits && String(Math.round(t.amount)).includes(qDigits)))
    : tx;
  if (shown.length === 0) { box.innerHTML = `<div class="empty">Nema rezultata za „${escapeHtml(q)}".</div>`; return; }
  let html = `<table><thead><tr><th>Datum</th><th>Tip</th><th>Kategorija</th><th>Čije</th><th>Opis</th><th class="num">Iznos</th><th><span class="sr-only">Akcije</span></th></tr></thead><tbody>`;
  shown.forEach((t) => {
    const c = catById(t.category);
    const goal = t.goalId ? state.goals.find((g) => g.id === t.goalId) : null;
    html += `<tr>
      <td>${fmtDate(t.date, false)}</td>
      <td>${t.type === "prihod" ? "Prihod" : "Rashod"}</td>
      <td><span class="cat-dot" style="background:${escapeHtml(c.color)}"></span>${escapeHtml(c.name)}${goal ? ` <span class="note">→ ${escapeHtml(goal.name)}</span>` : ""}</td>
      <td>${memberBadge(t.member)}${t.enteredBy ? `<div class="note">unos: ${escapeHtml(memberName(t.enteredBy))}</div>` : ""}</td>
      <td>${escapeHtml(t.note) || "<span style='color:var(--muted)'>—</span>"}${isFiscalLink(t.link) ? ` <a href="${escapeHtml(t.link)}" target="_blank" rel="noopener" title="Otvori fiskalni račun" aria-label="Otvori fiskalni račun">🔗</a>` : ""}</td>
      <td class="num" style="font-weight:600;${t.type === "prihod" ? "color:var(--good-text)" : ""}">${t.type === "prihod" ? "+" : "−"}${fmt(t.amount)}</td>
      <td><button class="del" type="button" title="Obriši" aria-label="Obriši transakciju" data-del="${escapeHtml(t.id)}">✕</button></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  if (q) html += `<p class="note" style="margin-top:8px">Prikazano ${shown.length} od ${tx.length} — filtrirano po „${escapeHtml(q)}".</p>`;
  box.innerHTML = html;
  onData(box, "del", async (id) => {
    const t = state.tx.find((x) => x.id === id);
    if (!t) return;
    if (!(await confirmDialog(`Obrisati ${t.type === "prihod" ? "prihod" : "trošak"} ${fmt(t.amount)}${t.note ? ` („${t.note}")` : ""}?`, { danger: true, okText: "Obriši" }))) return;
    state.tx = state.tx.filter((x) => x.id !== id);
    commit();
  });
}
