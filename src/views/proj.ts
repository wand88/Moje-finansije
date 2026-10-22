/* ============ Projekcija ============ */
import { monthsLeft } from "../lib/dates";
import { MONTHS_S, fmt, lastMonthForAvg, monthOf, passFilter, txOfYear } from "../model";
import { save, state } from "../store";
import { renderLines } from "../ui/charts";
import { $, escapeHtml, num } from "../ui/dom";
import { goalSaved } from "./goals";

/* prosek iz meseci tekuće godine koji imaju unose (do tekućeg meseca ako je izabrana tekuća godina) */
function monthlyAverages(): { inc: number; exp: number; k: number } {
  const lastM = lastMonthForAvg();
  const tx = txOfYear().filter(passFilter).filter((t) => monthOf(t) <= lastM);
  const k = new Set(tx.map(monthOf)).size;
  if (k === 0) return { inc: 0, exp: 0, k: 0 };
  let inc = 0, exp = 0;
  tx.forEach((t) => { if (t.type === "prihod") inc += t.amount; else exp += t.amount; });
  return { inc: inc / k, exp: exp / k, k };
}

export function initProj(): void {
  ["pOnce", "pPct", "pExtra"].forEach((id) => $(id).addEventListener("input", () => {
    state.proj = { once: num("pOnce"), pct: num("pPct"), extra: num("pExtra") };
    save();
    renderProj();
  }));
}

export function renderProj(): void {
  $("pOnce").value = String(state.proj.once);
  $("pPct").value = String(state.proj.pct);
  $("pExtra").value = String(state.proj.extra);
  $("pPctVal").textContent = (state.proj.pct > 0 ? "+" : "") + state.proj.pct + "%";

  const avg = monthlyAverages();
  $("projBasis").textContent = avg.k > 0
    ? `prosek iz ${avg.k} ${avg.k === 1 ? "meseca" : "meseci"} sa podacima: prihodi ${fmt(avg.inc)}/mes, rashodi ${fmt(avg.exp)}/mes`
    : "još nema unetih podataka — unesi transakcije da projekcija proradi";

  const now = new Date();
  const labels: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    labels.push(MONTHS_S[d.getMonth()] + (d.getMonth() === 0 ? " " + String(d.getFullYear()).slice(2) : ""));
  }
  const baseSurplus = avg.inc - avg.exp;
  const adjSurplus = avg.inc + state.proj.extra - avg.exp * (1 + state.proj.pct / 100);
  const base: number[] = [], adj: number[] = [];
  let b = 0, a = 0;
  for (let i = 1; i <= 12; i++) {
    b += baseSurplus;
    a += adjSurplus - (i === 1 ? state.proj.once : 0);
    base.push(b);
    adj.push(a);
  }
  renderLines("chartProj", labels, [
    { name: "Osnovni scenario", color: "var(--s1)", vals: base },
    { name: "Sa izmenama", color: "var(--s5)", vals: adj },
  ]);
  const diff = adj[11] - base[11];
  $("projSummary").innerHTML = avg.k > 0
    ? `Za 12 meseci — osnovni scenario: <b>${fmt(base[11])}</b> ušteđeno. Sa izmenama: <b>${fmt(adj[11])}</b>
       (${diff >= 0 ? "+" : ""}${fmt(diff)}). Mesečni višak: <b>${fmt(baseSurplus)}</b> → <b>${fmt(adjSurplus)}</b>.
       ${adjSurplus < 0 ? "⚠️ <b>U ovom scenariju trošiš više nego što zarađuješ — svaki mesec ideš u minus.</b>" : ""}`
    : "Unesi bar jedan mesec prihoda i rashoda pa se vrati ovde.";

  /* uticaj na ciljeve */
  const active = state.goals.filter((g) => goalSaved(g) < g.target);
  const box = $<HTMLDivElement>("projGoals");
  if (active.length === 0) { box.innerHTML = `<div class="empty">Nema aktivnih ciljeva. Dodaj ih u tabu 🎯 Ciljevi.</div>`; return; }
  let needTotal = 0;
  let html = `<table><thead><tr><th>Cilj</th><th class="num">Nedostaje</th><th class="num">Rok</th><th class="num">Potrebno mesečno</th></tr></thead><tbody>`;
  active.forEach((g) => {
    const saved = goalSaved(g);
    const left = monthsLeft(g.deadline);
    const needed = left > 0 ? (g.target - saved) / left : g.target - saved;
    needTotal += needed;
    const [dy, dm] = g.deadline.split("-").map(Number);
    html += `<tr><td>${escapeHtml(g.name)}</td><td class="num">${fmt(g.target - saved)}</td>
      <td class="num">${String(dm).padStart(2, "0")}/${dy}${left <= 0 ? " ⏰" : ""}</td>
      <td class="num"><b>${fmt(needed)}</b>${left <= 0 ? " <span class='note'>(odmah)</span>" : ""}</td></tr>`;
  });
  const cover = adjSurplus >= needTotal;
  html += `<tr><td><b>Ukupno potrebno mesečno</b></td><td></td><td></td><td class="num"><b>${fmt(needTotal)}</b></td></tr>`;
  html += `</tbody></table>
    <div class="callout" style="border-left-color:${cover ? "var(--good)" : "var(--crit)"}">
      ${avg.k === 0 ? "Unesi podatke da uporedimo višak sa potrebama ciljeva."
        : cover
          ? `✅ Projektovani mesečni višak <b>${fmt(adjSurplus)}</b> pokriva sve ciljeve (<b>${fmt(needTotal)}</b>/mes) — ostaje ti <b>${fmt(adjSurplus - needTotal)}</b>/mes slobodno.`
          : `⚠️ Projektovani mesečni višak <b>${fmt(adjSurplus)}</b> NE pokriva sve ciljeve (<b>${fmt(needTotal)}</b>/mes) — nedostaje <b>${fmt(needTotal - adjSurplus)}</b>/mes. Pomeraj rokove, smanji ciljeve ili potrošnju.`}
    </div>`;
  box.innerHTML = html;
}
