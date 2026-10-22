/* ============ Vodič korak-po-korak ============ */
import { state } from "../store";
import { $, showView } from "../ui/dom";

const GUIDE_SEEN = "mojeFinansije.guideSeen";

const GUIDE: { badge: string; icon: string; title: string; view?: string; body: string }[] = [
  {
    badge: "Dobrodošli", icon: "👋", title: "Moje finansije — tvoj lični novčani asistent",
    body: `Ova aplikacija ti pomaže da vidiš <b>gde ti novac odlazi</b>, koliko štediš i da li ti se planovi ostvaruju — za tebe i celo domaćinstvo.
      <div class="field-explain">🔒 <b>Sve ostaje na tvom uređaju.</b> Podaci se čuvaju samo na ovom uređaju — niko drugi ih ne vidi, nema naloga ni interneta. Zato povremeno napravi rezervnu kopiju (objasnićemo na kraju).</div>
      Kroz par kratkih koraka pokazaćemo ti odakle da počneš. Traje minut.`,
  },
  {
    badge: "Korak 1 / 6", icon: "⚙️", title: "Podesi osnovne stvari", view: "data",
    body: `Otvorili smo ti tab <b>⚙️ Podaci</b>. Ovde podesi:
      <div class="field-explain"><b>Valuta</b> — dinar, evro ili dolar. U kojoj valuti vodiš račune.</div>
      <div class="field-explain"><b>Godina</b> — koju godinu pratiš. Možeš voditi više godina, one se čuvaju odvojeno.</div>
      <div class="field-explain"><b>👥 Članovi domaćinstva</b> — preimenuj sebe i dodaj ostale (partner, dete, cimer…). Ako vodiš samo svoje finansije, ostavi jednog člana. Svaki unos može biti nečiji ili zajednički.</div>
      <div class="field-explain"><b>Ko unosi na ovom uređaju</b> — izaberi sebe. Onda svaki tvoj unos nosi oznaku ko ga je uneo (korisno kad spojite podatke sa drugog telefona).</div>`,
  },
  {
    badge: "Korak 2 / 6", icon: "➕", title: "Unesi prvi prihod (platu)", view: "month",
    body: `Prešli smo na tab <b>📅 Mesečno</b>. Prvo unesi koliko novca <b>ulazi</b>:
      <ul>
        <li>Klikni zeleno dugme <b>„➕ Prihod"</b> na vrhu kartice za unos.</li>
        <li>Izaberi kategoriju (Plata, Honorar…), ko je primio, i upiši iznos.</li>
        <li>Klikni <b>Dodaj</b>.</li>
      </ul>
      <div class="field-explain"><b>Zašto je ovo važno:</b> bez prihoda aplikacija ne zna koliko smeš da trošiš ni koliko procenata odvajaš za štednju. Prihod je osnova svega.</div>`,
  },
  {
    badge: "Korak 3 / 6", icon: "➖", title: "Unesi troškove — tri brza načina", view: "month",
    body: `Sad ono najvažnije za svakodnevicu — <b>troškovi</b>. Imaš tri načina:
      <ul>
        <li><b>Ručno</b> — crveno dugme „➖ Trošak", izaberi kategoriju, iznos, Dodaj. Za brze stavke koristi dugmiće (🏠 Kirija, ⚡ Struja, ⛽ Gorivo…).</li>
        <li><b>📷 Skeniraj račun</b> — uslikaj QR kod sa fiskalnog računa, iznos i datum se sami popune.</li>
        <li><b>📥 Uvoz iz banke</b> — u tabu Podaci ubaciš CSV izvod, aplikacija sama razvrsta troškove.</li>
      </ul>
      <div class="field-explain"><b>🛡️ Garancija do</b> — kad kupiš uređaj, sat ili tehniku, upiši rok garancije. Aplikacija te podseća koliko je ostalo (korisno za reklamacije).</div>`,
  },
  {
    badge: "Korak 4 / 6", icon: "🎯", title: "Postavi cilj i budžet", view: "goals",
    body: `Ovde se gradi budućnost. U tabu <b>🎯 Ciljevi</b>:
      <div class="field-explain"><b>Cilj štednje</b> — letovanje, auto, učešće za stan… Upišeš iznos i rok, a aplikacija računa koliko mesečno treba da odvajaš. Klikni predlog ili upiši svoj.</div>
      A u <b>📅 Mesečno → Pametni budžet</b>:
      <div class="field-explain"><b>Plan po kategoriji</b> — koliko planiraš da potrošiš. Dugme „🪄 Predloži plan (50/30/20)" ga sam popuni po proverenom pravilu: 50% potrebe, 30% želje, 20% štednja.</div>`,
  },
  {
    badge: "Korak 5 / 6", icon: "📊", title: "Prati napredak", view: "dash",
    body: `Tab <b>📊 Pregled</b> je tvoja kontrolna tabla — sve se ovde sabira samo:
      <ul>
        <li><b>Kartice</b> gore: prihodi, rashodi, bilans, stopa štednje, neto vrednost.</li>
        <li><b>🍩 Struktura rashoda</b> — vidiš na koju kategoriju ide najviše.</li>
        <li><b>Bedževi</b> — nagrade za štedljive mesece i ostvarene ciljeve.</li>
        <li><b>📆 Poređenje godina</b> — da li stvarno napreduješ, uz uračunatu inflaciju.</li>
      </ul>`,
  },
  {
    badge: "Gotovo!", icon: "🎉", title: "Spreman si — samo kreni", view: "data",
    body: `To je to! Par saveta za kraj:
      <ul>
        <li><b>Unosi redovno</b> — 2 minuta dnevno ili skeniraj račune u prolazu.</li>
        <li><b>🔁 Ponavljajuće</b> — podesi kiriju/platu jednom, aplikacija te podseća.</li>
        <li><b>💾 Rezervna kopija</b> — povremeno klikni „Izvezi podatke" u tabu Podaci. Tako ne izgubiš ništa i preneseš na drugi uređaj.</li>
      </ul>
      Ovaj vodič možeš ponovo otvoriti bilo kad dugmetom <b>„❓ Vodič"</b> gore desno.`,
  },
];

let idx = 0;

function render(): void {
  const s = GUIDE[idx];
  $("gStepBadge").textContent = s.badge;
  $("gIllus").textContent = s.icon;
  $("gTitle").textContent = s.title;
  $("gBody").innerHTML = s.body;
  $("gDots").innerHTML = GUIDE.map((_, i) => `<span class="${i === idx ? "on" : ""}"></span>`).join("");
  $("gBack").style.visibility = idx === 0 ? "hidden" : "visible";
  $("gNext").textContent = idx === GUIDE.length - 1 ? "Kreni! 🚀" : "Dalje";
  /* prebaci na relevantni tab da korisnik vidi o čemu pričamo */
  if (s.view) showView(s.view);
}

const modal = () => $<HTMLDivElement>("guideModal");

function open(i = 0): void {
  idx = i;
  render();
  modal().classList.add("open");
  $("gNext").focus();
}

function close(): void {
  modal().classList.remove("open");
  try { localStorage.setItem(GUIDE_SEEN, "1"); } catch { /* ignore */ }
  $("btnHelp").focus();
}

export function initGuide(): void {
  $("btnHelp").addEventListener("click", () => open(0));
  $("gNext").addEventListener("click", () => { if (idx < GUIDE.length - 1) { idx++; render(); } else close(); });
  $("gBack").addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
  $("gSkip").addEventListener("click", close);
  modal().addEventListener("click", (e) => { if ((e.target as HTMLElement).id === "guideModal") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal().classList.contains("open")) close(); });
  /* prvi put: automatski pokaži vodič ako nema podataka i nije već viđen */
  try {
    if (!localStorage.getItem(GUIDE_SEEN) && state.tx.length === 0) open(0);
  } catch { /* ignore */ }
}
