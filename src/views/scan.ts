/* ============ Skeniranje fiskalnog računa (QR) ============ */
import { fmtDate } from "../lib/dates";
import { decodeFiscalUrl, type FiscalScan } from "../lib/fiscal";
import { fmt } from "../model";
import { $, escapeHtml } from "../ui/dom";
import { setEntryType } from "./month";

/* BarcodeDetector još nije u standardnim TS tipovima */
interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
declare const BarcodeDetector: { new (o: { formats: string[] }): BarcodeDetectorLike };
const hasDetector = () => "BarcodeDetector" in window;

let pending: string | null = null;
export const pendingScanLink = (): string | null => pending;
export function clearPendingScan(): void {
  pending = null;
  $("scanPanel").innerHTML = "";
}

const panel = () => $<HTMLDivElement>("scanPanel");
const say = (html: string, tone?: "good" | "crit") =>
  (panel().innerHTML = `<div class="callout"${tone ? ` style="border-left-color:var(--${tone})"` : ""}>${html}</div>`);

function applyScan(res: FiscalScan | null): void {
  if (!res) { say("QR/link nije prepoznat kao fiskalni račun (suf.purs.gov.rs). Pokušaj ponovo ili unesi ručno.", "crit"); return; }
  pending = res.url;
  setEntryType("rashod");
  if (res.date) $("txDate").value = res.date;
  if (res.amount) $("txAmount").value = String(res.amount);
  if (!$("txNote").value) $("txNote").value = "Fiskalni račun";
  say(`✅ Račun učitan${res.amount ? `: <b>${fmt(res.amount)}</b>` : ""}${res.date ? `, ${fmtDate(res.date)}` : ""}
    ${res.amount ? "— proveri iznos, izaberi <b>kategoriju</b> i klikni Dodaj." : `— iznos upiši ručno (nije mogao da se pročita iz QR-a), a <a href="${escapeHtml(res.url)}" target="_blank" rel="noopener">ceo račun pogledaj ovde</a>.`}
    Uz transakciju se čuva 🔗 link ka računu.`, "good");
  $("txAmount").focus();
}

let camTimer: number | null = null;
function stopCam(): void {
  const v = $<HTMLVideoElement>("camVideo");
  if (v.srcObject) { (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop()); v.srcObject = null; }
  if (camTimer) { clearInterval(camTimer); camTimer = null; }
  $<HTMLDivElement>("camModal").style.display = "none";
}

export function initScan(): void {
  $("btnCamStop").addEventListener("click", stopCam);
  $("btnScanCam").addEventListener("click", async () => {
    if (!hasDetector()) {
      say(`📱 Ovaj browser nema ugrađen čitač QR kodova (npr. iPhone/Safari). Uradi ovako: skeniraj QR <b>običnom kamerom telefona</b>, kopiraj link koji iskoči i klikni „🔗 Nalepi link računa".`);
      return;
    }
    if (!window.isSecureContext) { say(`🔒 Kamera radi samo preko https ili localhost. Koristi „🖼️ QR iz slike" ili „🔗 Nalepi link".`); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = $<HTMLVideoElement>("camVideo");
      video.srcObject = stream;
      $<HTMLDivElement>("camModal").style.display = "flex";
      const det = new BarcodeDetector({ formats: ["qr_code"] });
      camTimer = window.setInterval(async () => {
        try {
          const codes = await det.detect(video);
          if (codes.length) { stopCam(); applyScan(decodeFiscalUrl(codes[0].rawValue)); }
        } catch { /* sledeći kadar */ }
      }, 350);
    } catch (err) {
      say(`Kamera nije dostupna (${escapeHtml((err as Error).name || "greška")}). Koristi „🖼️ QR iz slike" ili „🔗 Nalepi link".`, "crit");
    }
  });
  $("btnScanImg").addEventListener("click", () => {
    if (!hasDetector()) { say(`Ovaj browser ne ume da čita QR iz slike — koristi „🔗 Nalepi link računa".`); return; }
    $("scanImgFile").click();
  });
  $("scanImgFile").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const codes = await new BarcodeDetector({ formats: ["qr_code"] }).detect(await createImageBitmap(f));
      if (codes.length) applyScan(decodeFiscalUrl(codes[0].rawValue));
      else say("Na slici nije pronađen QR kod — slikaj bliže i oštrije.", "crit");
    } catch {
      say("Slika nije mogla da se obradi.", "crit");
    }
    input.value = "";
  });
  $("btnScanLink").addEventListener("click", () => {
    panel().innerHTML = `
      <div class="settings-row" style="margin-bottom:0">
        <div style="flex:1; min-width:240px">
          <label for="scanUrl">Link sa računa (suf.purs.gov.rs/…)</label>
          <input type="url" id="scanUrl" placeholder="https://suf.purs.gov.rs/v/?vl=...">
        </div>
        <button class="btn sm" type="button" id="btnScanUrlGo">Učitaj</button>
      </div>
      <p class="note" style="margin-top:6px">iPhone: skeniraj QR običnom kamerom → drži prst na linku → Kopiraj → nalepi ovde.</p>`;
    $("btnScanUrlGo").addEventListener("click", () => applyScan(decodeFiscalUrl($("scanUrl").value)));
    $("scanUrl").focus();
  });
}
