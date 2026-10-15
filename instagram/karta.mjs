// Generator grafik na Instagram (1080x1350, format 4:5) w stylu Hypers.
// Renderuje HTML w headless Chromium (Playwright), czcionki z /fonts.
// Użycie testowe: node instagram/karta.mjs <data RRRR-MM-DD> <katalog wyjściowy> [wariant a|b|c|d|e|wszystkie]
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SEKCJE = { ryby: 'Grube ryby', luz: 'Na luzie', czapy: 'Z czapy' };
export const SZER = 1080, WYS = 1350;

export function wczytajWydania() {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'data/editions.js'), 'utf8'), ctx);
  return ctx.window.HYPERS_EDITIONS;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let _fonty;
const fonty = () => _fonty ??= readFileSync(join(ROOT, 'fonts/fonts.css'), 'utf8')
  // Strona z setContent nie może czytać file://, więc fonty idą jako data URI.
  .replace(/url\(([^)]+)\)/g, (_, f) =>
    `url(data:font/woff2;base64,${readFileSync(join(ROOT, 'fonts', f)).toString('base64')})`);

function dataPL(iso) {
  const [r, m, d] = iso.split('-').map(Number);
  const mies = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  return `${d} ${mies[m - 1]} ${r}`;
}

function hypeBars(n, kolor, tlo) {
  return `<div class="hype"><span>HYPE</span>${[1,2,3,4,5].map((i) =>
    `<i style="background:${i <= n ? kolor : tlo}"></i>`).join('')}</div>`;
}

// Pierwsze zdanie leadu (do wariantu B), przycięte do ~160 znaków.
function lead(summary) {
  const z = summary.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? summary;
  return z.length > 170 ? z.slice(0, 165).replace(/\s+\S*$/, '') + '…' : z;
}

const BAZA = `*{box-sizing:border-box;margin:0}
html,body{width:${SZER}px;height:${WYS}px;overflow:hidden}
body{font-family:"Work Sans",sans-serif;-webkit-font-smoothing:antialiased}
.body{min-height:0}
.card{position:relative;width:${SZER}px;height:${WYS}px;display:flex;flex-direction:column;overflow:hidden}
.title{font-family:"Anton",sans-serif;text-transform:uppercase;line-height:1.14;letter-spacing:.01em}
.hype{display:flex;align-items:center;gap:8px;font:700 22px/1 "Work Sans";letter-spacing:.14em}
.hype span{margin-right:8px}
.hype i{display:block;width:34px;height:14px;border-radius:3px}
.avatar{flex:none;display:grid;place-items:center;border-radius:50%;font:800 34px/1 "Work Sans";letter-spacing:.02em}`;

const WARIANTY = {
  // A: niebieski masthead jak og.png, brzoskwiniowy pas z sekcją.
  a: (n) => `
<style>
.card{background:#276787;color:#fff}
.top{display:flex;justify-content:space-between;align-items:flex-end;padding:64px 72px 0}
.logo{font:400 68px/1 "Anton";letter-spacing:.02em}
.date{font:600 26px/1 "Work Sans";opacity:.85;padding-bottom:8px}
.band{margin-top:44px;background:#ffc9b0;color:#0b1620;border-top:6px solid #0b1620;border-bottom:6px solid #0b1620;
  padding:20px 72px;display:flex;justify-content:space-between;align-items:center}
.band b{font:400 44px/1 "Anton";text-transform:uppercase;letter-spacing:.02em}
.band em{font:700 26px/1 "Work Sans";font-style:normal;text-transform:uppercase;letter-spacing:.12em}
.body{flex:1;display:flex;align-items:center;padding:40px 72px}
.title{font-size:var(--fs,150px);color:#fff}
.foot{display:flex;align-items:center;gap:24px;padding:0 72px 64px}
.avatar{width:92px;height:92px;background:#ffc9b0;color:#0b1620}
.who{font:700 34px/1.1 "Work Sans";flex:1}
.who small{display:block;font:500 22px/1.3 "Work Sans";opacity:.8;margin-top:6px;letter-spacing:.06em}
</style>
<div class="card">
  <div class="top"><div class="logo">HYPERS</div><div class="date">${esc(n._data)}</div></div>
  <div class="band"><b>${esc(n._sekcja)}</b><em>${esc(n.category)}</em></div>
  <div class="body"><h1 class="title fit">${esc(n.title)}</h1></div>
  <div class="foot"><div class="avatar">${esc(n.initials)}</div>
    <div class="who">${esc(n.who)}<small>HYPERS.TECH · LINK W BIO</small></div>
    ${hypeBars(n.hype, '#ffc9b0', 'rgba(255,255,255,.22)')}</div>
</div>`,

  // B: jasny papier, niebieski pasek u góry, tytuł w kolorze tuszu, lead pod spodem.
  b: (n) => `
<style>
.card{background:#fff;color:#0b1620}
.mast{background:#276787;color:#fff;padding:44px 72px 40px;display:flex;justify-content:space-between;align-items:center;
  border-bottom:10px solid #ffc9b0}
.logo{font:400 64px/1 "Anton";letter-spacing:.02em}
.date{font:600 24px/1 "Work Sans";opacity:.9}
.meta{padding:56px 72px 0;display:flex;gap:14px}
.chip{font:700 22px/1 "Work Sans";text-transform:uppercase;letter-spacing:.12em;padding:12px 18px;border-radius:999px}
.chip.s{background:#276787;color:#fff}.chip.k{background:#eef4f8;color:#276787}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:28px 72px}
.title{font-size:var(--fs,128px);color:#0b1620}
.lead{margin-top:30px;font:500 31px/1.42 "Work Sans";color:#4f6474;padding-left:24px;border-left:8px solid #ffc9b0}
.foot{display:flex;align-items:center;gap:24px;padding:28px 72px 56px;border-top:2px solid rgba(11,22,32,.12);margin:0 0}
.avatar{width:84px;height:84px;background:#276787;color:#fff;font-size:30px}
.who{font:700 32px/1.1 "Work Sans";flex:1}
.who small{display:block;font:500 21px/1.3 "Work Sans";color:#4f6474;margin-top:6px;letter-spacing:.06em}
.hype{color:#0b1620}
</style>
<div class="card">
  <div class="mast"><div class="logo">HYPERS</div><div class="date">${esc(n._data)}</div></div>
  <div class="meta"><span class="chip s">${esc(n._sekcja)}</span><span class="chip k">${esc(n.category)}</span></div>
  <div class="body fitbox"><h1 class="title fit">${esc(n.title)}</h1><p class="lead">${esc(lead(n.summary))}</p></div>
  <div class="foot"><div class="avatar">${esc(n.initials)}</div>
    <div class="who">${esc(n.who)}<small>HYPERS.TECH · LINK W BIO</small></div>
    ${hypeBars(n.hype, '#276787', '#dbe7ee')}</div>
</div>`,

  // C: ciemny granat, wielkie inicjały w tle, brzoskwiniowe akcenty.
  c: (n) => `
<style>
.card{background:#0b1620;color:#f1f6f9}
.ghost{position:absolute;right:-40px;top:120px;font:400 620px/.8 "Anton";color:rgba(255,201,176,.07);letter-spacing:-.02em;pointer-events:none}
.top{display:flex;align-items:center;gap:20px;padding:64px 72px 0;position:relative}
.logo{font:400 52px/1 "Anton";background:#276787;color:#fff;padding:12px 18px 10px;border-radius:12px;letter-spacing:.02em}
.sek{font:400 40px/1 "Anton";color:#ffc9b0;text-transform:uppercase;letter-spacing:.03em}
.date{margin-left:auto;font:600 24px/1 "Work Sans";color:#9fb3c1}
.body{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:40px 72px 48px;position:relative}
.kat{font:700 24px/1 "Work Sans";letter-spacing:.16em;text-transform:uppercase;color:#8fcbe8;margin-bottom:26px}
.title{font-size:var(--fs,150px);color:#fff}
.bar{height:12px;width:180px;background:#ffc9b0;margin-top:40px;border-radius:6px}
.foot{display:flex;align-items:center;gap:24px;padding:36px 72px 60px;background:#13283a;position:relative}
.avatar{width:88px;height:88px;background:#276787;color:#fff}
.who{font:700 33px/1.1 "Work Sans";flex:1}
.who small{display:block;font:500 21px/1.3 "Work Sans";color:#9fb3c1;margin-top:6px;letter-spacing:.06em}
.hype{color:#9fb3c1}
</style>
<div class="card">
  <div class="ghost">${esc(n.initials)}</div>
  <div class="top"><div class="logo">HYPERS</div><div class="sek">${esc(n._sekcja)}</div><div class="date">${esc(n._data)}</div></div>
  <div class="body"><div class="kat">${esc(n.category)}</div><h1 class="title fit">${esc(n.title)}</h1><div class="bar"></div></div>
  <div class="foot"><div class="avatar">${esc(n.initials)}</div>
    <div class="who">${esc(n.who)}<small>HYPERS.TECH · LINK W BIO</small></div>
    ${hypeBars(n.hype, '#ffc9b0', 'rgba(255,255,255,.14)')}</div>
</div>`,
  // D: kadr u góry w natywnych proporcjach 16:9 (bez przycinania), pod nim pas i tytuł jak w A.
  d: (n) => `
<style>
.card{background:#276787;color:#fff}
.kadr{position:relative;flex:none;height:608px;background:#0b1620 url(${n._tlo}) center/cover no-repeat}
.kadr::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,22,32,.45) 0%,rgba(11,22,32,0) 26%)}
.logo{position:absolute;z-index:1;left:56px;top:48px;font:400 58px/1 "Anton";letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.35)}
.kredyt{position:absolute;z-index:1;right:20px;bottom:16px;font:600 19px/1 "Work Sans";background:rgba(11,22,32,.72);
  padding:9px 13px;border-radius:8px;letter-spacing:.02em}
.band{background:#ffc9b0;color:#0b1620;border-top:6px solid #0b1620;border-bottom:6px solid #0b1620;
  padding:18px 64px;display:flex;justify-content:space-between;align-items:center}
.band b{font:400 40px/1 "Anton";text-transform:uppercase;letter-spacing:.02em}
.band em{font:700 23px/1 "Work Sans";font-style:normal;text-transform:uppercase;letter-spacing:.12em}
.body{flex:1;display:flex;align-items:center;padding:26px 64px}
.title{font-size:var(--fs,104px);color:#fff}
.foot{display:flex;align-items:center;gap:22px;padding:0 64px 48px}
.avatar{width:80px;height:80px;background:#ffc9b0;color:#0b1620;font-size:30px}
.who{font:700 31px/1.1 "Work Sans";flex:1}
.who small{display:block;font:500 20px/1.3 "Work Sans";opacity:.8;margin-top:6px;letter-spacing:.06em}
</style>
<div class="card">
  <div class="kadr"><div class="logo">HYPERS</div><div class="kredyt">Kadr: ${esc(n._kredyt)}</div></div>
  <div class="band"><b>${esc(n._sekcja)}</b><em>${esc(n.category)} · ${esc(n._data)}</em></div>
  <div class="body"><h1 class="title fit">${esc(n.title)}</h1></div>
  <div class="foot"><div class="avatar">${esc(n.initials)}</div>
    <div class="who">${esc(n.who)}<small>HYPERS.TECH · LINK W BIO</small></div>
    ${hypeBars(n.hype, '#ffc9b0', 'rgba(255,255,255,.22)')}</div>
</div>`,

  // E: kadr na całe tło, mocne przyciemnienie od dołu, tytuł na dole.
  e: (n) => `
<style>
.card{background:#0b1620 url(${n._tlo}) center top/auto 62% no-repeat;color:#fff}
.card::before{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(11,22,32,.55) 0%,rgba(11,22,32,0) 18%,rgba(11,22,32,0) 34%,rgba(11,22,32,.92) 56%,#0b1620 66%)}
.card>*{position:relative}
.top{display:flex;align-items:center;gap:18px;padding:52px 64px 0}
.logo{font:400 54px/1 "Anton";letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.4)}
.sek{font:400 30px/1 "Anton";text-transform:uppercase;background:#ffc9b0;color:#0b1620;padding:9px 14px 7px;border-radius:8px;letter-spacing:.03em}
.kredyt{margin-left:auto;font:600 19px/1 "Work Sans";background:rgba(11,22,32,.72);padding:9px 13px;border-radius:8px}
.body{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:30px 64px 40px}
.kat{font:700 23px/1 "Work Sans";letter-spacing:.16em;text-transform:uppercase;color:#ffc9b0;margin-bottom:22px}
.title{font-size:var(--fs,112px);color:#fff}
.foot{display:flex;align-items:center;gap:22px;padding:30px 64px 52px;border-top:2px solid rgba(255,255,255,.12)}
.avatar{width:80px;height:80px;background:#276787;color:#fff;font-size:30px}
.who{font:700 31px/1.1 "Work Sans";flex:1}
.who small{display:block;font:500 20px/1.3 "Work Sans";color:#9fb3c1;margin-top:6px;letter-spacing:.06em}
.hype{color:#9fb3c1}
</style>
<div class="card">
  <div class="top"><div class="logo">HYPERS</div><div class="sek">${esc(n._sekcja)}</div><div class="kredyt">Kadr: ${esc(n._kredyt)}</div></div>
  <div class="body"><div class="kat">${esc(n.category)} · ${esc(n._data)}</div><h1 class="title fit">${esc(n.title)}</h1></div>
  <div class="foot"><div class="avatar">${esc(n.initials)}</div>
    <div class="who">${esc(n.who)}<small>HYPERS.TECH · LINK W BIO</small></div>
    ${hypeBars(n.hype, '#ffc9b0', 'rgba(255,255,255,.14)')}</div>
</div>`,
};
export const LISTA_WARIANTOW = Object.keys(WARIANTY);
export const Z_KADREM = new Set(['d', 'e']);

// Zmniejsza tytuł, aż cała karta mieści się w 1350 px (nic nie wychodzi poza kontener).
const DOPASUJ = `
(async () => {
  await document.fonts.ready;
  const t = document.querySelector('.fit'); const card = document.querySelector('.card');
  let fs = parseFloat(getComputedStyle(t).fontSize);
  // Mieści się, gdy treść bloku z tytułem nie przekracza jego wysokości, a stopka nie wychodzi poza kartę.
  const box = t.parentElement;
  const przepelnia = () => {
    const cs = getComputedStyle(box);
    const wolne = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const zajete = [...box.children].reduce((s, el) => { const c = getComputedStyle(el);
      return s + el.getBoundingClientRect().height + parseFloat(c.marginTop) + parseFloat(c.marginBottom); }, 0);
    const dol = Math.max(...[...card.children].map((el) => el.getBoundingClientRect().bottom));
    return zajete > wolne + 1 || dol > card.getBoundingClientRect().bottom + 1;
  };
  while (przepelnia() && fs > 44) { fs -= 2; t.style.setProperty('font-size', fs + 'px'); }
  document.body.dataset.gotowe = fs;
})();`;

// Polska typografia: jednoliterowe spójniki i przyimki nie zostają na końcu wiersza.
export const sieroty = (t) => String(t).replace(/(?<=^|[\s\u00a0])([aiouwz])\s+/gi, '$1\u00a0');

export function htmlKarty(news, { data, sekcja, wariant = 'a', tlo = null }) {
  // Warianty z kadrem bez dostępnego kadru wracają do zwykłej karty A.
  if (Z_KADREM.has(wariant) && !tlo) wariant = 'a';
  const n = { ...news, title: sieroty(news.title), _data: dataPL(data), _sekcja: SEKCJE[sekcja] ?? sekcja,
    _tlo: tlo, _kredyt: news.image?.credit ?? news.who };
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><style>${fonty()}${BAZA}</style></head>
<body>${WARIANTY[wariant](n)}<script>${DOPASUJ}</script></body></html>`;
}

// Kadr na tło: tylko obraz, który news już ma na stronie (kind kadr/prasowe, czyli po sprawdzeniu zasad z CLAUDE.md).
// Newsy z noImage nie mają kadru i dostają zwykłą kartę. IG_KADRY=0 wyłącza kadry całkiem.
// IG_TEST_TLO=<plik> podstawia lokalny obraz (testy bez dostępu do i.ytimg.com).
export async function pobierzKadr(news) {
  if (process.env.IG_KADRY === '0' || !news.image || news.noImage) return null;
  if (!['kadr', 'prasowe'].includes(news.image.kind)) return null;
  if (process.env.IG_TEST_TLO) return `data:image/jpeg;base64,${readFileSync(process.env.IG_TEST_TLO).toString('base64')}`;
  for (const url of [news.image.src, news.image.fallback].filter(Boolean)) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' || (news.image.kind === 'kadr' && u.hostname !== 'i.ytimg.com')) continue;
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const typ = r.headers.get('content-type') ?? '';
      if (!r.ok || !typ.startsWith('image/')) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000) continue; // YouTube zwraca szary placeholder ~1 kB, gdy maxres nie istnieje
      return `data:${typ};base64,${buf.toString('base64')}`;
    } catch { /* następny adres */ }
  }
  return null;
}

// Renderuje listę {news, data, sekcja, plik, wariant} do JPEG. Zwraca rozmiar tytułu i informację o kadrze.
export async function renderuj(zadania) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SZER, height: WYS }, deviceScaleFactor: 1 });
  const wyniki = [];
  try {
    for (const z of zadania) {
      const tlo = Z_KADREM.has(z.wariant) ? await pobierzKadr(z.news) : null;
      await page.setContent(htmlKarty(z.news, { ...z, tlo }), { waitUntil: 'load' });
      await page.waitForFunction(() => document.body.dataset.gotowe);
      wyniki.push({ plik: z.plik, kadr: !!tlo, fs: await page.evaluate(() => document.body.dataset.gotowe) });
      await page.screenshot({ path: z.plik, type: 'jpeg', quality: 92 });
    }
  } finally { await browser.close(); }
  return wyniki;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [data, out = 'karty-test', w = 'wszystkie'] = process.argv.slice(2);
  const E = wczytajWydania();
  const d = data ?? Object.keys(E).sort().at(-1);
  mkdirSync(out, { recursive: true });
  const warianty = w === 'wszystkie' ? LISTA_WARIANTOW : [w];
  const zad = [];
  for (const sekcja of Object.keys(SEKCJE)) (E[d]?.[sekcja] ?? []).forEach((news, i) => {
    for (const wariant of warianty) zad.push({ news, data: d, sekcja, wariant, plik: join(out, `${sekcja}-${i + 1}-${wariant}.jpg`) });
  });
  for (const r of await renderuj(zad)) console.log(r.plik, 'tytuł', r.fs + 'px', r.kadr ? 'z kadrem' : '');
}
