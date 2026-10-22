/* ============ Stanje aplikacije i čuvanje ============ */
import { migrate } from "./lib/migrate";
import type { AppState } from "./types";

export const STORE_KEY = "mojeFinansije.v1";
/* profil uređaja — čuva se ODVOJENO od podataka, pa ga uvoz/spajanje ne dira */
const DEVICE_KEY = "mojeFinansije.device";

function readRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export let state: AppState = migrate(readRaw());

export function setState(s: AppState): void {
  state = s;
}

let onSaveError: (e: unknown) => void = (e) => console.error(e);
export function setSaveErrorHandler(fn: (e: unknown) => void): void {
  onSaveError = fn;
}

export function save(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    onSaveError(e);
  }
}

export function wipe(): void {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  state = migrate(null);
}

function readDevice(): string {
  try { return localStorage.getItem(DEVICE_KEY) || ""; } catch { return ""; }
}
export let device = readDevice();
export function setDevice(id: string): void {
  device = id;
  try {
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  } catch { /* ignore */ }
}

export const uid = (): string => Date.now() + "-" + Math.random().toString(36).slice(2, 7);
