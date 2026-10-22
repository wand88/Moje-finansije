/* ============ Dijalozi i obaveštenja (umesto alert/confirm/prompt) ============ */
import { t } from "../i18n";
import { escapeHtml } from "./dom";

type Tone = "info" | "good" | "warn" | "crit";

let toastBox: HTMLDivElement | null = null;

/* kratko obaveštenje u dnu ekrana; nestaje samo */
export function toast(msg: string, tone: Tone = "info", ms = 3500): void {
  if (!toastBox) {
    toastBox = document.createElement("div");
    toastBox.className = "toasts";
    toastBox.setAttribute("role", "status");
    toastBox.setAttribute("aria-live", "polite");
    document.body.appendChild(toastBox);
  }
  const el = document.createElement("div");
  el.className = "toast " + tone;
  el.textContent = msg;
  toastBox.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 250);
  }, ms);
}

interface DialogOpts {
  title?: string;
  okText?: string;
  cancelText?: string | null;
  danger?: boolean;
  input?: { value: string; type?: string; label?: string; inputmode?: string };
}

/* modal sa porukom i dugmićima; vraća vrednost polja (prompt), true (potvrda) ili null (otkazano) */
function openDialog(message: string, o: DialogOpts): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    const prev = document.activeElement as HTMLElement | null;
    const bg = document.createElement("div");
    bg.className = "modal-bg open";
    bg.innerHTML = `
      <div class="modal dialog" role="dialog" aria-modal="true" ${o.title ? 'aria-labelledby="dlgTitle"' : ""} aria-describedby="dlgMsg">
        <div class="modal-scroll">
          <div class="modal-head">${o.title ? `<h2 id="dlgTitle">${escapeHtml(o.title)}</h2>` : ""}</div>
          <div class="modal-body">
            <p id="dlgMsg">${escapeHtml(message)}</p>
            ${o.input ? `<input id="dlgInput" style="margin-top:12px; width:100%" type="${o.input.type || "text"}"
              ${o.input.inputmode ? `inputmode="${o.input.inputmode}"` : ""} value="${escapeHtml(o.input.value)}"
              aria-label="${escapeHtml(o.input.label || message)}">` : ""}
          </div>
        </div>
        <div class="modal-foot">
          <div class="spacer"></div>
          ${o.cancelText === null ? "" : `<button class="btn ghost" type="button" data-act="cancel">${escapeHtml(o.cancelText || t("dialog.cancel"))}</button>`}
          <button class="btn ${o.danger ? "danger" : ""}" type="button" data-act="ok">${escapeHtml(o.okText || t("dialog.ok"))}</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    const input = bg.querySelector<HTMLInputElement>("#dlgInput");
    const close = (val: string | boolean | null) => {
      document.removeEventListener("keydown", onKey, true);
      bg.remove();
      prev?.focus?.();
      resolve(val);
    };
    const ok = () => close(input ? input.value : true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(null); }
      else if (e.key === "Enter" && (input || document.activeElement === bg.querySelector('[data-act="ok"]'))) { e.preventDefault(); ok(); }
    };
    document.addEventListener("keydown", onKey, true);
    bg.addEventListener("click", (e) => { if (e.target === bg) close(null); });
    bg.querySelector('[data-act="ok"]')!.addEventListener("click", ok);
    bg.querySelector('[data-act="cancel"]')?.addEventListener("click", () => close(null));
    if (input) { input.focus(); input.select(); }
    else bg.querySelector<HTMLButtonElement>('[data-act="ok"]')!.focus();
  });
}

export async function confirmDialog(message: string, o: Omit<DialogOpts, "input"> = {}): Promise<boolean> {
  return (await openDialog(message, { okText: t("dialog.confirm"), ...o })) === true;
}

export async function alertDialog(message: string, title?: string): Promise<void> {
  await openDialog(message, { title, cancelText: null });
}

export async function promptDialog(message: string, value: string, o: Omit<DialogOpts, "input"> & { type?: string; inputmode?: string } = {}): Promise<string | null> {
  const r = await openDialog(message, { okText: t("dialog.save"), ...o, input: { value, type: o.type, inputmode: o.inputmode } });
  return typeof r === "string" ? r : null;
}

/* iznos iz prompta: prihvata zarez kao decimalni separator; null = otkazano, NaN = neispravno */
export async function promptAmount(message: string, value: number): Promise<number | null> {
  const r = await promptDialog(message, String(value), { inputmode: "decimal" });
  if (r === null) return null;
  return parseFloat(r.replace(/\s/g, "").replace(",", "."));
}
