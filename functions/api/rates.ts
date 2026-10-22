/* ============ GET /api/rates — zvanične stope za kalkulator kredita ============
   Cloudflare Pages Function. Odgovor se kešira na Cloudflare mreži 6 sati, pa se izvori (ECB, kurs)
   pozivaju najviše nekoliko puta dnevno bez obzira na broj korisnika. */
import { collectRates } from "../../src/lib/rates";

const CACHE_SECONDS = 6 * 60 * 60;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MojeFinansije/0.3 (+kalkulator kredita)", Accept: "text/csv, application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export const onRequestGet: PagesFunction = async (ctx) => {
  const key = new Request(new URL("/api/rates?v=1", ctx.request.url).toString());
  /* keš je ubrzanje, ne uslov — ako nije dostupan (lokalno, greška), servis i dalje radi */
  let cache: Cache | null = null;
  try {
    cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch (e) {
    console.error("rates: keš nedostupan", e);
    cache = null;
  }

  const rates = await collectRates(fetchText);
  if (rates.errors.length) console.error("rates: izvori", rates.errors);
  const complete = rates.errors.length === 0;
  const res = new Response(JSON.stringify(rates), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      /* delimičan odgovor (neki izvor pao) kešira se kraće da se brzo popravi */
      "Cache-Control": `public, max-age=${complete ? CACHE_SECONDS : 600}`,
    },
  });
  if (cache) ctx.waitUntil(cache.put(key, res.clone()).catch((e) => console.error("rates: upis u keš", e)));
  return res;
};
