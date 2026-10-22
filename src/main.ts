/* ============ Moje finansije — ulazna tačka ============ */
import "@fontsource-variable/inter";
import "./styles.css";
import { applyStaticI18n, t } from "./i18n";
import { hydrateIcons } from "./ui/icons";
import { setSaveErrorHandler } from "./store";
import { hideTip } from "./ui/charts";
import { toast } from "./ui/dialog";
import { initInputs, initNav, renderAll } from "./views/app";
import { initAssets } from "./views/assets";
import { initCredit, startOfficialRates } from "./views/credit";
import { initCsv } from "./views/csvImport";
import { initGoals } from "./views/goals";
import { initGuide } from "./views/guide";
import { initMonth } from "./views/month";
import { initProj } from "./views/proj";
import { initRecurring } from "./views/recurring";
import { initScan } from "./views/scan";
import { initSettings } from "./views/settings";

setSaveErrorHandler(() => toast(t("toast.saveFailed"), "crit", 8000));
applyStaticI18n();
hydrateIcons();

initNav();
initMonth();
initRecurring();
initGoals();
initProj();
initAssets();
initCredit();
initScan();
initCsv();
initSettings();
initInputs();
renderAll();
initGuide();
startOfficialRates();
window.addEventListener("resize", hideTip);

/* PWA: service worker (samo na https/localhost — omogućava rad offline i instalaciju na telefon) */
if (import.meta.env.PROD && "serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
