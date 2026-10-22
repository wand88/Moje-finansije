/* ============ Imovina, obaveze i garancije ============ */
import { t } from "../i18n";
import { daysBetween, fmtDate, isoLocal, todayISO } from "../lib/dates";
import { isFiscalLink } from "../lib/fiscal";
import { MONTHS_S, catById, fmt, fmtN, lastMonthForAvg, lastVal, memberBadge, monthOf, passFilter, sum, txOfYear } from "../model";
import { state, uid } from "../store";
import type { Asset } from "../types";
import { renderLines, type Series } from "../ui/charts";
import { confirmDialog, promptAmount, toast } from "../ui/dialog";
import { $, escapeHtml, onData } from "../ui/dom";
import { commit } from "./app";

export function setAssetDateDefault(): void {
  $("aDate").value = todayISO();
  $("dDate").value = todayISO();
}

export function initAssets(): void {
  $<HTMLFormElement>("assetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = parseFloat($("aValue").value);
    const date = $("aDate").value;
    if (!(value >= 0) || !date) return;
    state.assets.push({ id: uid(), name: $("aName").value.trim(), type: $("aType").value, member: $("aMember").value, entries: [{ date, value }] });
    $<HTMLFormElement>("assetForm").reset();
    setAssetDateDefault();
    commit();
  });
  $<HTMLFormElement>("debtForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = parseFloat($("dValue").value);
    const date = $("dDate").value;
    if (!(value >= 0) || !date) return;
    state.debts.push({
      id: uid(), name: $("dName").value.trim(), type: $("dType").value, member: $("dMember").value,
      rate: parseFloat($("dRate").value) || 0, entries: [{ date, value }],
    });
    $<HTMLFormElement>("debtForm").reset();
    setAssetDateDefault();
    commit();
  });
}

const LIQUID_TYPES = ["Gotovina i tekući računi", "Devizna štednja"];

/* prosečni mesečni troškovi (bez štednje), celo domaćinstvo */
function familyAvgExpenses(): number {
  const lastM = lastMonthForAvg();
  const rel = txOfYear().filter((t) => t.type === "rashod" && t.category !== "stednja" && monthOf(t) <= lastM);
  const months = new Set(rel.map(monthOf));
  return months.size ? sum(rel, (t) => t.amount) / months.size : 0;
}

/* nova procena vrednosti (imovina) ili novo stanje duga */
async function addEntry(x: Asset, message: string): Promise<void> {
  const v = await promptAmount(message, lastVal(x));
  if (v === null) return;
  if (!(v >= 0)) { toast(t("toast.invalidAmount"), "crit"); return; }
  x.entries.push({ date: todayISO(), value: v });
  x.entries.sort((a, b) => a.date.localeCompare(b.date));
  commit();
}

function renderNetWorthChart(assets: Asset[], debts: Asset[]): void {
  const allDates = assets.flatMap((a) => a.entries.map((e) => e.date)).concat(debts.flatMap((d) => d.entries.map((e) => e.date))).sort();
  if (allDates.length < 1) { $("chartAssets").innerHTML = `<div class="empty">Dodaj imovinu i obaveze da vidiš grafikon.</div>`; return; }
  const [sy, sm] = allDates[0].split("-").map(Number);
  const cur = new Date(sy, sm - 1, 1);
  const end = new Date();
  const aPts: number[] = [], dPts: number[] = [], nPts: number[] = [], labels: string[] = [];
  const sumAt = (arr: Asset[], cutoff: string) => sum(arr, (x) => {
    const past = x.entries.filter((e) => e.date <= cutoff);
    return past.length ? past[past.length - 1].value : 0;
  });
  while (cur <= end && labels.length < 36) {
    const cutoff = isoLocal(new Date(cur.getFullYear(), cur.getMonth() + 1, 0));
    const av = sumAt(assets, cutoff), dv = sumAt(debts, cutoff);
    aPts.push(av); dPts.push(dv); nPts.push(av - dv);
    labels.push(MONTHS_S[cur.getMonth()] + " " + String(cur.getFullYear()).slice(2));
    cur.setMonth(cur.getMonth() + 1);
  }
  if (labels.length === 1) { aPts.push(aPts[0]); dPts.push(dPts[0]); nPts.push(nPts[0]); labels.push("danas"); }
  const series: Series[] = [{ name: "Imovina", color: "var(--s2)", vals: aPts }];
  if (debts.length) series.push({ name: "Obaveze", color: "var(--s6)", vals: dPts });
  series.push({ name: "Neto vrednost", color: "var(--s1)", vals: nPts });
  renderLines("chartAssets", labels, series);
}

export function renderAssets(): void {
  const assets = state.assets.filter(passFilter);
  const debts = state.debts.filter(passFilter);
  const totalA = sum(assets, lastVal), totalD = sum(debts, lastVal);
  const net = totalA - totalD;
  const liquid = sum(assets.filter((a) => LIQUID_TYPES.includes(a.type)), lastVal);
  const avgExp = familyAvgExpenses();
  const reserve = avgExp > 0 ? liquid / avgExp : null;
  const reserveTxt = reserve === null ? "—" : reserve.toFixed(1).replace(".", ",");
  $("assetTiles").innerHTML = `
    <div class="tile"><div class="label">Neto vrednost</div><div class="value ${net >= 0 ? "pos" : "neg"}">${fmt(net)}</div><div class="sub">imovina − obaveze</div></div>
    <div class="tile"><div class="label">Imovina ukupno</div><div class="value">${fmt(totalA)}</div><div class="sub">${assets.length} ${assets.length === 1 ? "stavka" : "stavki"}</div></div>
    <div class="tile"><div class="label">Obaveze ukupno</div><div class="value ${totalD > 0 ? "neg" : ""}">${totalD > 0 ? "−" : ""}${fmt(totalD)}</div><div class="sub">${debts.length} ${debts.length === 1 ? "kredit/dug" : "kredita/dugova"}</div></div>
    <div class="tile"><div class="label">🛟 Rezerva</div><div class="value">${reserveTxt}${reserve !== null ? " mes." : ""}</div><div class="sub">${reserve === null ? "unesi troškove i gotovinu" : "gotovina ÷ mesečni troškovi (cilj 3–6)"}</div></div>`;

  renderNetWorthChart(assets, debts);

  const box = $<HTMLDivElement>("assetTable");
  if (assets.length === 0) box.innerHTML = `<div class="empty">Nema stavki za ovaj filter — dodaj prvu iznad. 💎</div>`;
  else {
    let html = `<table><thead><tr><th>Naziv</th><th>Vrsta</th><th>Vlasnik</th><th class="num">Prva procena</th><th class="num">Trenutno</th><th class="num">Promena</th><th><span class="sr-only">Akcije</span></th></tr></thead><tbody>`;
    assets.forEach((a) => {
      const fst = a.entries[0], lst = a.entries[a.entries.length - 1];
      const d = lst.value - fst.value;
      const pct = fst.value > 0 ? ((100 * d) / fst.value).toFixed(1) : "0";
      const id = escapeHtml(a.id);
      html += `<tr>
        <td><b>${escapeHtml(a.name)}</b><div class="note">poslednja procena: ${fmtDate(lst.date)}</div></td>
        <td>${escapeHtml(a.type)}</td>
        <td>${memberBadge(a.member)}</td>
        <td class="num">${fmt(fst.value)}</td>
        <td class="num"><b>${fmt(lst.value)}</b></td>
        <td class="num" style="color:${d >= 0 ? "var(--good-text)" : "var(--crit)"};font-weight:600">${d >= 0 ? "+" : ""}${fmt(d)} (${d >= 0 ? "+" : ""}${pct}%)</td>
        <td style="white-space:nowrap">
          <button class="btn ghost sm" type="button" data-reval="${id}">Ažuriraj</button>
          <button class="del" type="button" title="Obriši" aria-label="Obriši ${escapeHtml(a.name)}" data-adel="${id}">✕</button>
        </td>
      </tr>`;
    });
    box.innerHTML = html + `</tbody></table>`;
    onData(box, "reval", (id) => {
      const a = state.assets.find((x) => x.id === id);
      if (a) addEntry(a, `Nova vrednost za „${a.name}" (${state.currency}):`);
    });
    onData(box, "adel", async (id) => {
      if (!(await confirmDialog("Obrisati ovu stavku imovine i njenu istoriju?", { danger: true, okText: "Obriši" }))) return;
      state.assets = state.assets.filter((x) => x.id !== id);
      commit();
    });
  }

  /* tabela obaveza */
  const dbox = $<HTMLDivElement>("debtTable");
  if (debts.length === 0) { dbox.innerHTML = `<div class="empty">Nema unetih obaveza — ako nemate kredita, neto vrednost je jednaka imovini. 🎉</div>`; return; }
  let dhtml = `<table><thead><tr><th>Naziv</th><th>Vrsta</th><th>Čija</th><th class="num">Mesečna rata</th><th class="num">Početni dug</th><th class="num">Preostalo</th><th class="num">Otplaćeno</th><th><span class="sr-only">Akcije</span></th></tr></thead><tbody>`;
  debts.forEach((d) => {
    const fst = d.entries[0], lst = d.entries[d.entries.length - 1];
    const paid = fst.value - lst.value;
    const id = escapeHtml(d.id);
    dhtml += `<tr>
      <td><b>${escapeHtml(d.name)}</b><div class="note">stanje: ${fmtDate(lst.date)}</div></td>
      <td>${escapeHtml(d.type)}</td>
      <td>${memberBadge(d.member)}</td>
      <td class="num">${d.rate > 0 ? fmt(d.rate) : "—"}</td>
      <td class="num">${fmt(fst.value)}</td>
      <td class="num" style="font-weight:700;color:var(--crit)">${fmt(lst.value)}</td>
      <td class="num" style="color:${paid > 0 ? "var(--good-text)" : "var(--ink-2)"};font-weight:600">${paid > 0 ? "✅ " + fmt(paid) : "—"}</td>
      <td style="white-space:nowrap">
        <button class="btn ghost sm" type="button" data-dreval="${id}">Ažuriraj</button>
        <button class="del" type="button" title="Obriši" aria-label="Obriši ${escapeHtml(d.name)}" data-ddel="${id}">✕</button>
      </td>
    </tr>`;
  });
  dbox.innerHTML = dhtml + `</tbody></table>`;
  onData(dbox, "dreval", (id) => {
    const d = state.debts.find((x) => x.id === id);
    if (d) addEntry(d, `Novo stanje duga za „${d.name}" (${state.currency}):`);
  });
  onData(dbox, "ddel", async (id) => {
    if (!(await confirmDialog("Obrisati ovu obavezu i njenu istoriju? (Uradi to tek kad je kredit stvarno otplaćen ili je unos greška.)", { danger: true, okText: "Obriši" }))) return;
    state.debts = state.debts.filter((x) => x.id !== id);
    commit();
  });
}

export function renderWarranties(): void {
  const box = $<HTMLDivElement>("warrTable");
  const rows = state.tx.filter((t) => t.warranty).sort((a, b) => a.warranty!.localeCompare(b.warranty!));
  if (!rows.length) {
    box.innerHTML = `<div class="empty">Pri unosu troška popuni „🛡️ Garancija do" — ovde ćeš pratiti sve rokove na jednom mestu.</div>`;
    return;
  }
  const today = todayISO();
  let html = `<table><thead><tr><th>Šta</th><th>Kupljeno</th><th>Garancija do</th><th>Status</th></tr></thead><tbody>`;
  rows.forEach((tx) => {
    const days = daysBetween(today, tx.warranty!);
    const st = days < 0
      ? `<span class="note">istekla</span>`
      : days <= 30
        ? `<b style="color:var(--crit)">⚠️ još ${days} ${days === 1 ? "dan" : "dana"}</b>`
        : `<span style="color:var(--good-text);font-weight:600">✅ još ${days} dana</span>`;
    const link = isFiscalLink(tx.link)
      ? ` <a href="${escapeHtml(tx.link)}" target="_blank" rel="noopener" title="Otvori fiskalni račun" aria-label="Otvori fiskalni račun">🔗</a>` : "";
    html += `<tr${days < 0 ? ' style="opacity:.55"' : ""}>
      <td><b>${escapeHtml(tx.note || catById(tx.category).name)}</b>${link} <span class="note">${fmtN(tx.amount)}</span></td>
      <td>${fmtDate(tx.date)}</td>
      <td>${fmtDate(tx.warranty!)}</td>
      <td>${st}</td>
    </tr>`;
  });
  box.innerHTML = html + `</tbody></table>`;
}
