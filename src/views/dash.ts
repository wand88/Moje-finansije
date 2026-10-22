/* ============ Pregled ============ */
import { daysBetween, todayISO } from "../lib/dates";
import { realFactor } from "../lib/finance";
import { MONTHS, MONTHS_S, catById, expCats, fmt, fmtN, lastVal, memberBadge, memberIds, memberName, monthOf, passFilter, sum, txOfYear } from "../model";
import { save, state } from "../store";
import type { Tx } from "../types";
import { attachTip, el, expTotals, niceMax, renderCatBars, renderDonut, renderLines, roundTop } from "../ui/charts";
import { $, escapeHtml, onData } from "../ui/dom";
import { catTile, icon } from "../ui/icons";
import { commit } from "./app";
import { goalMonthlyAvg, goalNeeded, goalSaved } from "./goals";
import { budgetTotals, dailyLimit, openEntry } from "./month";
import { fmtDate, monthsLeft } from "../lib/dates";

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
  box.innerHTML = `<div class="callout warn" style="margin:0 0 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap">
    <span style="flex:1; min-width:180px">Nisi ništa uneo <b>${days} dana</b>. Dva minuta te dele od ažurne slike — ili skeniraj račune u prolazu.</span>
    <button class="btn sm" type="button" id="nudgeGo">Unesi sada</button>
  </div>`;
  $("nudgeGo").addEventListener("click", () => openEntry("rashod"));
}

/* ---- kartica izabranog meseca ---- */
function renderHero(): void {
  const m = state.selMonth;
  const tx = txOfYear().filter((t) => monthOf(t) === m && passFilter(t));
  const inc = incOf(tx), exp = expOf(tx), bal = inc - exp;
  const { refSum, spentSum } = budgetTotals(m);
  const dl = dailyLimit(m);
  const pct = refSum > 0 ? Math.round((100 * spentSum) / refSum) : 0;
  let planHtml = "";
  if (refSum > 0) {
    planHtml = `<div style="display:flex; flex-direction:column; gap:8px">
      <div class="hero-row"><span>Potrošeno ${pct}% plana</span>${dl && dl.left > 0 ? `<b>${fmt(dl.perDay)} / dan</b>` : `<b>${fmt(spentSum)} od ${fmt(refSum)}</b>`}</div>
      <div class="hero-bar${pct > 100 ? " over" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, pct)}" aria-label="Potrošeno od plana"><div style="width:${Math.min(100, pct)}%"></div></div>
      ${dl ? `<span class="hero-note">${dl.left > 0 ? `Možeš da trošiš ${fmt(dl.perDay)} dnevno još ${dl.daysLeft} dana i ostaješ u planu.` : `Plan za ovaj mesec je probijen za ${fmt(-dl.left)}.`}</span>` : ""}
    </div>`;
  } else if (tx.length === 0) {
    planHtml = `<button type="button" class="btn" id="heroAdd">${icon("plus")}Dodaj prvi unos za ${MONTHS[m].toLowerCase()}</button>`;
  } else {
    planHtml = `<span class="hero-note">Posle prvog punog meseca aplikacija sama pravi plan iz tvog proseka — ili ga upiši u Mesečnom pregledu.</span>`;
  }
  $("dashHero").innerHTML = `
    <div class="hero-top">
      <span class="hero-label">Bilans meseca</span>
      <div class="hero-month">
        <button type="button" data-hm="-1" aria-label="Prethodni mesec" ${m === 0 ? "disabled" : ""}>${icon("left")}</button>
        <h2>${MONTHS[m]} ${state.year}.</h2>
        <button type="button" data-hm="1" aria-label="Sledeći mesec" ${m === 11 ? "disabled" : ""}>${icon("right")}</button>
      </div>
    </div>
    <div class="hero-value">${bal > 0 ? "+" : ""}${fmt(bal)}</div>
    <div class="hero-split">
      <div><span>Prihodi</span><b>${fmt(inc)}</b></div>
      <div><span>Rashodi</span><b>${fmt(exp)}</b></div>
    </div>
    ${planHtml}`;
  onData($("dashHero"), "hm", (d) => {
    state.selMonth = Math.min(11, Math.max(0, state.selMonth + Number(d)));
    commit();
  });
  document.getElementById("heroAdd")?.addEventListener("click", () => openEntry("rashod"));
}

/* ---- gde ide novac (izabrani mesec) ---- */
function renderSpend(): void {
  const m = state.selMonth;
  $("dashSpendLbl").textContent = MONTHS[m];
  const totals = expTotals(txOfYear().filter((t) => monthOf(t) === m && passFilter(t)));
  const total = sum(Object.values(totals), (v) => v);
  const box = $<HTMLDivElement>("dashSpend");
  if (total <= 0) { box.innerHTML = `<div class="empty">Još nema troškova u ovom mesecu.</div>`; return; }
  const rows = expCats().map((c) => ({ ...c, v: totals[c.id] || 0 })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  const top = rows.slice(0, 4);
  const rest = sum(rows.slice(4), (r) => r.v);
  if (rest > 0) top.push({ id: "_ostalo", name: "Ostalo", color: "var(--baseline)", v: rest });
  const share = (v: number) => Math.round((100 * v) / total);
  const label = top.map((r) => `${r.name} ${share(r.v)}%`).join(", ");
  box.innerHTML = `
    <div class="stack-bar" role="img" aria-label="${escapeHtml(label)}">${top.map((r) => `<div style="width:${(100 * r.v) / total}%; background:${escapeHtml(r.color)}"></div>`).join("")}</div>
    <div class="cat-rows">${top.map((r) => `
      <div class="cat-row"><span class="cat-dot" style="background:${escapeHtml(r.color)}; margin:0"></span>
        <span class="nm">${escapeHtml(r.name)}</span><span class="pc">${share(r.v)}%</span><span class="am">${fmtN(r.v)}</span></div>`).join("")}
    </div>`;
}

/* ---- ciljevi (do dva aktivna) ---- */
function renderDashGoals(): void {
  const box = $<HTMLDivElement>("dashGoals");
  const active = state.goals.filter((g) => goalSaved(g) < g.target).slice(0, 2);
  if (!active.length) {
    box.innerHTML = state.goals.length
      ? `<div class="callout good" style="margin:0">Svi ciljevi su ostvareni. Postavi novi u tabu Ciljevi.</div>`
      : `<div class="empty">Nema ciljeva — letovanje, auto, hitna rezerva? Dodaj prvi u tabu Ciljevi.</div>`;
    return;
  }
  box.innerHTML = active.map((g) => {
    const saved = goalSaved(g);
    const pct = Math.min(100, (100 * saved) / g.target);
    const left = monthsLeft(g.deadline);
    const needed = goalNeeded(g);
    const onTrack = left > 0 && needed > 0 && goalMonthlyAvg(g) >= needed;
    const pill = left <= 0 ? `<span class="pill crit">Rok je prošao</span>`
      : onTrack ? `<span class="pill good">Na putu</span>` : `<span class="pill neutral">${fmt(needed)} / mes</span>`;
    return `<div style="display:flex; flex-direction:column; gap:6px; padding:6px 0">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-weight:600">${escapeHtml(g.name)}</b>${pill}</div>
      <div class="pbar good" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Napredak: ${escapeHtml(g.name)}" style="margin:2px 0"><div style="width:${pct}%"></div></div>
      <div class="g-stats"><span><b style="color:var(--ink)">${fmtN(saved)}</b> od ${fmt(g.target)}</span><span>${Math.round(pct)}%</span></div>
    </div>`;
  }).join("");
}

/* ---- poslednje transakcije ---- */
function renderRecent(): void {
  const box = $<HTMLDivElement>("dashRecent");
  const rows = state.tx.filter(passFilter).slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5);
  if (!rows.length) { box.innerHTML = `<div class="empty">Još nema unosa. Dugme „+" je uvek pri ruci.</div>`; return; }
  const today = todayISO();
  box.innerHTML = rows.map((t) => {
    const c = catById(t.category);
    const when = t.date === today ? "danas" : fmtDate(t.date, t.date.slice(0, 4) !== String(state.year));
    const sub = [t.note ? c.name : "", memberName(t.member), when].filter(Boolean).join(" · ");
    return `<div class="txrow">${catTile(t.category, c.color)}
      <div class="meta"><b>${escapeHtml(t.note || c.name)}</b><span>${escapeHtml(sub)}</span></div>
      <span class="amt${t.type === "prihod" ? " pos" : ""}">${t.type === "prihod" ? "+" : "−"}${fmtN(t.amount)}</span></div>`;
  }).join("");
}

export function renderDash(): void {
  renderNudge();
  renderHero();
  renderSpend();
  renderDashGoals();
  renderRecent();
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
    ([["Prihodi", inc[m], "var(--s3)", cx - bw - 1], ["Rashodi", exp[m], "var(--s1)", cx + 1]] as const).forEach(([name, v, color, x]) => {
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
  html += `<div class="callout ${d === null ? "neutral" : d >= 0 ? "good" : "warn"}" style="margin-top:12px">
    ${d === null ? `Bilans ${prev}. je bio nula — poređenje nije moguće.`
      : d >= 0
        ? `<b>Realno napredujete:</b> bilans ${latest}. je <b>${d}% bolji</b> od ${prev}. kad se uračuna inflacija (${fmtN(balL)} vs ${fmtN(balPreal)} u istim cenama).`
        : `<b>Realno je slabije:</b> bilans ${latest}. je <b>${Math.abs(d)}% slabiji</b> od ${prev}. kad se uračuna inflacija (${fmtN(balL)} vs ${fmtN(balPreal)} u istim cenama) — brojke rastu, ali cene rastu brže.`}
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
  if (streak > 0) b.push(`<span class="badge win">${streak} ${mWord(streak)} zaredom u plusu</span>`);
  if (inc > 0) b.push(`<span class="badge ${rate >= 20 ? "win" : ""}">Stopa štednje ${rate}%${rate >= 20 ? " — pravilo 20% ispunjeno" : " (preporuka ≥ 20%)"}</span>`);
  if (active.length) b.push(`<span class="badge ${onTrack === active.length ? "win" : ""}">${onTrack}/${active.length} ciljeva na putu</span>`);
  if (doneGoals > 0) b.push(`<span class="badge win">${doneGoals} ${doneGoals === 1 ? "cilj ostvaren" : "ciljeva ostvareno"}</span>`);
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
