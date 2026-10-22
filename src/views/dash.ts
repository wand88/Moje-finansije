/* ============ Pregled ============ */
import { daysBetween, todayISO } from "../lib/dates";
import { realFactor } from "../lib/finance";
import { MONTHS, MONTHS_S, expCats, fmt, fmtN, lastVal, memberBadge, memberIds, monthOf, passFilter, sum, txOfYear } from "../model";
import { save, state } from "../store";
import type { Tx } from "../types";
import { attachTip, el, expTotals, niceMax, renderCatBars, renderDonut, renderLines, roundTop } from "../ui/charts";
import { $, escapeHtml, showView } from "../ui/dom";
import { goalMonthlyAvg, goalSaved } from "./goals";
import { monthsLeft } from "../lib/dates";

const incOf = (tx: Tx[]) => sum(tx.filter((t) => t.type === "prihod"), (t) => t.amount);
const expOf = (tx: Tx[]) => sum(tx.filter((t) => t.type === "rashod"), (t) => t.amount);
const savOf = (tx: Tx[]) => sum(tx.filter((t) => t.type === "rashod" && t.category === "stednja"), (t) => t.amount);

export function assetNetWorth(): number {
  return sum(state.assets.filter(passFilter), lastVal) - sum(state.debts.filter(passFilter), lastVal);
}

function renderNudge(): void {
  const box = $<HTMLDivElement>("nudgeBanner");
  if (state.tx.length === 0) { box.innerHTML = ""; return; } /* prvi put pokriva vodič */
  const last = state.tx.map((t) => t.date).sort().pop()!;
  const days = daysBetween(last, todayISO());
  if (days < 4) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="callout" style="border-left-color:var(--warn); margin:0 0 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap">
    <span style="flex:1; min-width:180px">👋 Nisi ništa uneo <b>${days} dana</b>. Dva minuta te dele od ažurne slike — ili skeniraj račune u prolazu.</span>
    <button class="btn sm" type="button" id="nudgeGo">Unesi sada</button>
  </div>`;
  $("nudgeGo").addEventListener("click", () => {
    showView("month");
    $("txAmount").focus();
  });
}

export function renderDash(): void {
  renderNudge();
  document.querySelectorAll(".yearLbl").forEach((e) => (e.textContent = String(state.year)));
  const tx = txOfYear().filter(passFilter);
  const inc = incOf(tx), exp = expOf(tx), saved = savOf(tx);
  const bal = inc - exp;
  const rate = inc > 0 ? Math.round((100 * saved) / inc) : 0;
  const nw = assetNetWorth();
  $("dashTiles").innerHTML = `
    <div class="tile"><div class="label">Prihodi ${state.year}.</div><div class="value">${fmt(inc)}</div></div>
    <div class="tile"><div class="label">Rashodi ${state.year}.</div><div class="value">${fmt(exp)}</div></div>
    <div class="tile"><div class="label">Bilans</div><div class="value ${bal >= 0 ? "pos" : "neg"}">${fmt(bal)}</div><div class="sub">prihodi − rashodi</div></div>
    <div class="tile"><div class="label">Stopa štednje</div><div class="value">${rate}%</div><div class="sub">štednja / prihodi</div></div>
    <div class="tile"><div class="label">Neto vrednost</div><div class="value ${nw >= 0 ? "" : "neg"}">${fmt(nw)}</div><div class="sub">imovina − obaveze</div></div>`;
  renderBadges();
  renderMemberTable();
  renderIncExp();
  const totals = expTotals(tx);
  renderCatBars("chartCats", totals);
  renderDonut("donutYear", expCats().map((c) => ({ name: c.name, color: c.color, v: totals[c.id] || 0 })), "rashodi " + state.year + ".");
  renderBalance();
  renderAnnualTable(tx);
  renderYearsCompare();
}

function renderIncExp(): void {
  const wrap = $<HTMLDivElement>("chartIncExp");
  wrap.innerHTML = "";
  const inc: number[] = Array(12).fill(0), exp: number[] = Array(12).fill(0);
  txOfYear().filter(passFilter).forEach((t) => { (t.type === "prihod" ? inc : exp)[monthOf(t)] += t.amount; });
  const W = 940, H = 300, mL = 76, mR = 10, mT = 14, mB = 30;
  const pw = W - mL - mR, ph = H - mT - mB;
  const maxV = niceMax(Math.max(...inc, ...exp, 1));
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Prihodi i rashodi po mesecima" });
  for (let i = 0; i <= 4; i++) {
    const y = mT + ph - (ph * i) / 4;
    svg.appendChild(el("line", { x1: mL, x2: W - mR, y1: y, y2: y, stroke: i === 0 ? "var(--baseline)" : "var(--grid)", "stroke-width": 1 }));
    const t = el("text", { x: mL - 8, y: y + 4, "text-anchor": "end", fill: "var(--muted)", "font-size": 11 });
    t.textContent = fmtN((maxV * i) / 4);
    svg.appendChild(t);
  }
  const slot = pw / 12, bw = Math.min(16, (slot - 14) / 2);
  for (let m = 0; m < 12; m++) {
    const cx = mL + slot * m + slot / 2;
    ([["Prihodi", inc[m], "var(--s1)", cx - bw - 1], ["Rashodi", exp[m], "var(--s6)", cx + 1]] as const).forEach(([name, v, color, x]) => {
      const h = Math.max(v > 0 ? 2 : 0, (ph * v) / maxV);
      const bar = el("path", { d: roundTop(x, mT + ph - h, bw, h, 4), fill: color });
      attachTip(bar, () => `<div class="t-title">${MONTHS[m]}</div>
        <div class="t-row"><span><i style="background:${color}"></i>${name}</span><b>${fmt(v)}</b></div>`);
      svg.appendChild(bar);
    });
    const t = el("text", { x: cx, y: H - 10, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 });
    t.textContent = MONTHS_S[m];
    svg.appendChild(t);
  }
  wrap.appendChild(svg);
}

function renderBalance(): void {
  const net: number[] = Array(12).fill(0);
  txOfYear().filter(passFilter).forEach((t) => { net[monthOf(t)] += t.type === "prihod" ? t.amount : -t.amount; });
  const cum: number[] = [];
  let run = 0;
  for (let m = 0; m < 12; m++) { run += net[m]; cum.push(run); }
  renderLines("chartBalance", MONTHS_S, [{ name: "Bilans do sada", color: "var(--s1)", vals: cum }],
    (i) => `<div class="t-row"><span>Ovaj mesec</span><b>${fmt(net[i])}</b></div>`);
}

/* ---- poređenje godina + inflacija ---- */
/* Okvirna godišnja inflacija u Srbiji (RZS, dec/dec) — prekucaj po potrebi */
const DEFAULT_INFLATION: Record<number, number> = { 2021: 7.9, 2022: 15.1, 2023: 7.6, 2024: 4.3, 2025: 4.0, 2026: 3.5 };
function inflOf(y: number): number {
  const v = state.inflation[y];
  return v === undefined || v === null || (v as unknown) === "" ? (DEFAULT_INFLATION[y] ?? 0) : v;
}

function renderYearsCompare(): void {
  const box = $<HTMLDivElement>("yearsCompare");
  const card = $<HTMLDivElement>("yearsCard");
  const byYear: Record<number, { inc: number; exp: number; sav: number }> = {};
  state.tx.filter(passFilter).forEach((t) => {
    const y = parseInt(t.date.slice(0, 4), 10);
    const o = byYear[y] || (byYear[y] = { inc: 0, exp: 0, sav: 0 });
    if (t.type === "prihod") o.inc += t.amount;
    else { o.exp += t.amount; if (t.category === "stednja") o.sav += t.amount; }
  });
  const years = Object.keys(byYear).map(Number).sort();
  /* karticu prikazujemo tek kad ima bar 2 godine podataka — inače je prazan prostor */
  if (years.length < 2) { card.style.display = "none"; return; }
  card.style.display = "";
  const latest = years[years.length - 1];
  const rf = (y: number) => realFactor(y, latest, inflOf);
  let html = `<div class="settings-row" style="margin-bottom:10px">`;
  for (let k = years[0] + 1; k <= latest; k++) {
    html += `<div style="min-width:110px"><label for="infl-${k}">Inflacija ${k}. (%)</label>
      <input id="infl-${k}" class="mini" style="width:100%" type="number" step="0.1" data-infl="${k}" value="${inflOf(k)}"></div>`;
  }
  html += `</div><p class="note" style="margin-bottom:12px">Unapred upisan okvirni RZS prosek — slobodno prekucaj tačne vrednosti.</p>`;
  html += `<div class="table-scroll"><table><thead><tr>
    <th>Godina</th><th class="num">Prihodi</th><th class="num">Rashodi</th><th class="num">Bilans</th>
    <th class="num">Bilans realno (cene ${latest}.)</th><th class="num">Štednja</th><th class="num">Stopa štednje</th>
  </tr></thead><tbody>`;
  years.forEach((y) => {
    const o = byYear[y];
    const bal = o.inc - o.exp;
    const real = bal * rf(y);
    const rate = o.inc > 0 ? Math.round((100 * o.sav) / o.inc) : 0;
    html += `<tr>
      <td><b>${y}.</b>${y === latest ? ` <span class="note">(tekuća)</span>` : ""}</td>
      <td class="num">${fmtN(o.inc)}</td><td class="num">${fmtN(o.exp)}</td>
      <td class="num" style="font-weight:600;${bal < 0 ? "color:var(--crit)" : ""}">${fmtN(bal)}</td>
      <td class="num" style="font-weight:600;${real < 0 ? "color:var(--crit)" : ""}">${fmtN(real)}</td>
      <td class="num">${fmtN(o.sav)}</td><td class="num">${rate}%</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  const prev = years[years.length - 2];
  const balL = byYear[latest].inc - byYear[latest].exp;
  const balPreal = (byYear[prev].inc - byYear[prev].exp) * rf(prev);
  const d = balPreal !== 0 ? Math.round((100 * (balL - balPreal)) / Math.abs(balPreal)) : null;
  html += `<div class="callout" style="margin-top:12px">
    ${d === null ? `Bilans ${prev}. je bio nula — poređenje nije moguće.`
      : d >= 0
        ? `📈 <b>Realno napredujete:</b> bilans ${latest}. je <b>${d}% bolji</b> od ${prev}. kad se uračuna inflacija (${fmtN(balL)} vs ${fmtN(balPreal)} u istim cenama).`
        : `📉 <b>Realno je slabije:</b> bilans ${latest}. je <b>${Math.abs(d)}% slabiji</b> od ${prev}. kad se uračuna inflacija (${fmtN(balL)} vs ${fmtN(balPreal)} u istim cenama) — brojke rastu, ali cene rastu brže.`}
  </div>`;
  box.innerHTML = html;
  box.querySelectorAll<HTMLInputElement>("[data-infl]").forEach((inp) => inp.addEventListener("change", () => {
    const v = parseFloat(inp.value);
    state.inflation[inp.dataset.infl!] = isFinite(v) ? v : 0;
    save();
    renderYearsCompare();
  }));
}

function renderBadges(): void {
  const tx = txOfYear(); /* celo domaćinstvo, bez filtera */
  const now = new Date();
  const lastDone = state.year === now.getFullYear() ? now.getMonth() - 1 : 11;
  let streak = 0;
  for (let m = lastDone; m >= 0; m--) {
    const mt = tx.filter((t) => monthOf(t) === m);
    if (!mt.length) break;
    if (incOf(mt) - expOf(mt) > 0) streak++; else break;
  }
  const inc = incOf(tx), sav = savOf(tx);
  const rate = inc > 0 ? Math.round((100 * sav) / inc) : 0;
  const active = state.goals.filter((g) => goalSaved(g) < g.target);
  const onTrack = active.filter((g) => {
    const left = monthsLeft(g.deadline);
    return left > 0 && goalMonthlyAvg(g) >= (g.target - goalSaved(g)) / left;
  }).length;
  const doneGoals = state.goals.length - active.length;
  const mWord = (n: number) => (n === 1 ? "mesec" : n < 5 ? "meseca" : "meseci");
  const b: string[] = [];
  if (streak > 0) b.push(`<span class="badge win">🔥 ${streak} ${mWord(streak)} zaredom u plusu</span>`);
  if (inc > 0) b.push(`<span class="badge ${rate >= 20 ? "win" : ""}">${rate >= 20 ? "💪" : "💰"} Stopa štednje ${rate}%${rate >= 20 ? " — pravilo 20% ispunjeno!" : " (preporuka ≥ 20%)"}</span>`);
  if (active.length) b.push(`<span class="badge ${onTrack === active.length ? "win" : ""}">🎯 ${onTrack}/${active.length} ciljeva na putu</span>`);
  if (doneGoals > 0) b.push(`<span class="badge win">🏆 ${doneGoals} ${doneGoals === 1 ? "cilj ostvaren" : "ciljeva ostvareno"}</span>`);
  $("dashBadges").innerHTML = b.join("");
}

function renderMemberTable(): void {
  const all = txOfYear();
  const rows = memberIds().map((mem) => {
    const tx = all.filter((t) => t.member === mem);
    const inc = incOf(tx), exp = expOf(tx);
    const ast = sum(state.assets.filter((x) => x.member === mem), lastVal);
    const dug = sum(state.debts.filter((x) => x.member === mem), lastVal);
    return { mem, inc, exp, bal: inc - exp, sav: savOf(tx), ast, dug, net: ast - dug };
  });
  const keys = ["inc", "exp", "bal", "sav", "ast", "dug", "net"] as const;
  const tot = Object.fromEntries(keys.map((k) => [k, sum(rows, (r) => r[k])])) as Record<(typeof keys)[number], number>;
  const cell = (v: number, bold?: boolean) => `<td class="num" style="${v < 0 ? "color:var(--crit);" : ""}${bold ? "font-weight:700;" : ""}">${fmtN(v)}</td>`;
  let html = `<table><thead><tr><th>Član</th><th class="num">Prihodi</th><th class="num">Rashodi</th><th class="num">Bilans</th><th class="num">Štednja</th><th class="num">Imovina</th><th class="num">Obaveze</th><th class="num">Neto vrednost</th></tr></thead><tbody>`;
  rows.forEach((r) => {
    html += `<tr><td>${memberBadge(r.mem)}</td>${cell(r.inc)}${cell(r.exp)}${cell(r.bal)}${cell(r.sav)}${cell(r.ast)}${cell(-r.dug || 0)}${cell(r.net, true)}</tr>`;
  });
  html += `<tr><td><b>Ukupno domaćinstvo</b></td>${cell(tot.inc, true)}${cell(tot.exp, true)}${cell(tot.bal, true)}${cell(tot.sav, true)}${cell(tot.ast, true)}${cell(-tot.dug || 0, true)}${cell(tot.net, true)}</tr>`;
  $("memberTable").innerHTML = html + `</tbody></table>`;
}

function renderAnnualTable(tx: Tx[]): void {
  const cats = expCats();
  const grid: Record<string, number[]> = {};
  cats.forEach((c) => (grid[c.id] = Array(12).fill(0)));
  const incRow: number[] = Array(12).fill(0);
  tx.forEach((t) => {
    if (t.type === "prihod") incRow[monthOf(t)] += t.amount;
    else if (grid[t.category]) grid[t.category][monthOf(t)] += t.amount;
  });
  const total = (r: number[]) => r.reduce((a, b) => a + b, 0);
  const cells = (r: number[], bold = false) => r.map((v) => `<td class="num">${bold ? "<b>" : ""}${v ? fmtN(v) : "–"}${bold ? "</b>" : ""}</td>`).join("");
  let html = `<table><thead><tr><th>Kategorija</th>${MONTHS_S.map((m) => `<th class="num">${m}</th>`).join("")}<th class="num">Ukupno</th></tr></thead><tbody>`;
  html += `<tr><td><b>Prihodi</b></td>${cells(incRow)}<td class="num"><b>${fmtN(total(incRow))}</b></td></tr>`;
  cats.forEach((c) => {
    const row = grid[c.id];
    html += `<tr><td><span class="cat-dot" style="background:${escapeHtml(c.color)}"></span>${escapeHtml(c.name)}</td>${cells(row)}<td class="num"><b>${fmtN(total(row))}</b></td></tr>`;
  });
  const expRow: number[] = Array(12).fill(0);
  Object.values(grid).forEach((r) => r.forEach((v, i) => (expRow[i] += v)));
  html += `<tr><td><b>Rashodi ukupno</b></td>${cells(expRow, true)}<td class="num"><b>${fmtN(total(expRow))}</b></td></tr>`;
  $("annualTable").innerHTML = html + `</tbody></table>`;
}
