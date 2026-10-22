/* ============ CSV uvoz izvoda ============ */
import { buildPreview, csvTxId, decodeCsvBytes, guessMapping, parseCSVText, type CsvMap, type CsvRow } from "../lib/csv";
import { catsOf, fmtN } from "../model";
import { device, state } from "../store";
import { alertDialog } from "../ui/dialog";
import { $, escapeHtml, onData } from "../ui/dom";
import { commit } from "./app";

interface CsvJob {
  headers: string[];
  rows: string[][];
  map: CsvMap;
  preview: CsvRow[];
}
let job: CsvJob | null = null;

function colSelect(key: keyof CsvMap, sel: number, label: string): string {
  return `<div><label for="csvmap-${key}">${label}</label><select id="csvmap-${key}" data-csvmap="${key}">${
    job!.headers.map((h, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${escapeHtml(h || "kolona " + (i + 1))}</option>`).join("")}</select></div>`;
}

function renderWizard(): void {
  const box = $<HTMLDivElement>("csvWizard");
  if (!job) { box.innerHTML = ""; return; }
  job.preview = buildPreview(job.rows, job.map);
  const { map, preview } = job;
  const skipped = job.rows.length - preview.length;
  let html = `
    <div class="callout" style="margin:14px 0">
      Prepoznato <b>${preview.length}</b> transakcija${skipped > 0 ? ` (${skipped} redova preskočeno — bez datuma ili iznosa)` : ""}.
      Ako su kolone pogrešno pogođene, ispravi ih:
    </div>
    <div class="settings-row">
      ${colSelect("date", map.date, "Kolona: datum")}
      ${colSelect("desc", map.desc, "Kolona: opis")}
      <div><label for="csvmap-mode">Format iznosa</label>
        <select id="csvmap-mode" data-csvmap="mode">
          <option value="one" ${map.mode === "one" ? "selected" : ""}>Jedna kolona (±)</option>
          <option value="two" ${map.mode === "two" ? "selected" : ""}>Dve kolone (uplata / isplata)</option>
        </select>
      </div>
      ${map.mode === "one" ? colSelect("amount", map.amount, "Kolona: iznos")
        : colSelect("credit", map.credit, "Kolona: uplata") + colSelect("debit", map.debit, "Kolona: isplata")}
    </div>`;
  if (preview.length) {
    html += `<div class="table-scroll" style="max-height:420px; overflow-y:auto; margin-top:6px">
      <table><thead><tr><th><span class="sr-only">Uvezi</span></th><th>Datum</th><th>Opis</th><th class="num">Iznos</th><th>Kategorija</th></tr></thead><tbody>`;
    preview.slice(0, 300).forEach((p, i) => {
      html += `<tr>
        <td><input type="checkbox" data-csvinc="${i}" ${p.include ? "checked" : ""} aria-label="Uvezi red ${i + 1}"></td>
        <td style="white-space:nowrap">${p.date.slice(8, 10)}.${p.date.slice(5, 7)}.${p.date.slice(2, 4)}.</td>
        <td>${escapeHtml(p.desc) || "<span class='note'>—</span>"}</td>
        <td class="num" style="font-weight:600;${p.type === "prihod" ? "color:var(--good-text)" : ""}">${p.type === "prihod" ? "+" : "−"}${fmtN(p.amount)}</td>
        <td><select data-csvcat="${i}" aria-label="Kategorija za red ${i + 1}">${catsOf(p.type).map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === p.cat ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    if (preview.length > 300) html += `<p class="note" style="margin-top:6px">Prikazano prvih 300 — uvoz obuhvata svih ${preview.length}.</p>`;
    html += `<div class="settings-row" style="margin-top:14px">
      <button class="btn" type="button" id="btnCsvImport">✅ Uvezi ${preview.length} transakcija</button>
      <button class="btn ghost" type="button" id="btnCsvCancel">Otkaži</button>
    </div>`;
  }
  box.innerHTML = html;
  onData(box, "csvmap", (k, el) => {
    const v = (el as HTMLSelectElement).value;
    if (k === "mode") job!.map.mode = v as CsvMap["mode"];
    else (job!.map as unknown as Record<string, number>)[k] = parseInt(v, 10);
    renderWizard();
  }, "change");
  /* izmene u pregledu menjaju samo job, bez ponovnog crtanja */
  onData(box, "csvinc", (i, el) => (job!.preview[Number(i)].include = (el as HTMLInputElement).checked), "change");
  onData(box, "csvcat", (i, el) => (job!.preview[Number(i)].cat = (el as HTMLSelectElement).value), "change");
  box.querySelector("#btnCsvImport")?.addEventListener("click", importCsv);
  box.querySelector("#btnCsvCancel")?.addEventListener("click", () => { job = null; renderWizard(); });
}

function importCsv(): void {
  if (!job) return;
  const member = $("csvMember").value;
  const existing = new Set(state.tx.map((t) => t.id));
  let added = 0, dup = 0;
  job.preview.forEach((p) => {
    if (!p.include) return;
    const id = csvTxId(p);
    if (existing.has(id)) { dup++; return; }
    existing.add(id);
    state.tx.push({ id, date: p.date, type: p.type, category: p.cat, member, enteredBy: device || undefined, note: p.desc, amount: p.amount, src: "csv" });
    added++;
  });
  state.tx.sort((a, b) => a.date.localeCompare(b.date));
  job = null;
  commit();
  $("csvWizard").innerHTML = `<div class="callout" style="border-left-color:var(--good); margin-top:14px">
    ✅ Uvezeno <b>${added}</b> transakcija${dup > 0 ? `, preskočeno ${dup} duplikata` : ""}. Pogledaj 📅 Mesečno i 📊 Pregled.
  </div>`;
}

export function initCsv(): void {
  $("btnCsv").addEventListener("click", () => $("csvFile").click());
  $("csvFile").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSVText(decodeCsvBytes(reader.result as ArrayBuffer));
      if (rows.length < 2) { alertDialog("Fajl je prazan ili nije prepoznat kao CSV."); return; }
      const headers = rows[0].map((h) => String(h).trim());
      job = { headers, rows: rows.slice(1), map: guessMapping(headers), preview: [] };
      renderWizard();
    };
    reader.readAsArrayBuffer(f);
    input.value = "";
  });
}
