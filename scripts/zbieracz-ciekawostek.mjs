// Zbieracz ciekawostek dla sekcji Ciekawostki. Uruchamia go GitHub Actions
// (.github/workflows/zbieracz-ciekawostek.yml) przed wydaniami 7:00 i 15:00.
// Bez zależności, Node 20+.
//
//   node scripts/zbieracz-ciekawostek.mjs <rano|popoludnie> <katalog wyjściowy>
//
// Wynik: <katalog>/RRRR-MM-DD-<slot>.json z kandydatami na ciekawostki:
//  - Wikipedia „Czy wiesz…” (PL) i „Did you know…” (EN, także archiwum z bieżącego miesiąca):
//    gotowy, sprawdzony przez wikipedystów fakt + artykuł + zdjęcie z Wikimedia Commons z autorem i licencją,
//  - Reddit r/todayilearned i kanały RSS serwisów z ciekawostkami (tylko temat i link; zdjęcie trzeba znaleźć).
// Kandydaci użyci już na stronie (ten sam artykuł Wikipedii albo link) są pomijani.
// Każde źródło może zawieść osobno: błąd trafia do `status`, reszta działa dalej.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'HypersBot/1.0 (https://hypers.tech; kontakt@hypers.tech)';
const [slot = 'rano', outDir = 'ciekawostki-out'] = process.argv.slice(2);
const IMG_WIDTH = 1280;
const PER_SOURCE = { 'wiki-pl': 30, 'wiki-en': 35 };

const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
const status = {};
const log = (...a) => console.log(...a);

async function get(url, { json = true, tries = 2 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': json ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return json ? await r.json() : await r.text();
    } catch (e) {
      if (i === tries - 1) throw new Error(`${e.message} (${url.slice(0, 120)})`);
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}
const strip = s => String(s || '').replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/\s+/g, ' ').trim();
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- co już było na stronie ----------
function usedKeys() {
  const sandbox = { window: {} };
  try { vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/editions.js'), 'utf8'), sandbox); } catch { return new Set(); }
  const set = new Set();
  for (const day of Object.values(sandbox.window.HYPERS_EDITIONS || {}))
    for (const list of Object.values(day)) if (Array.isArray(list))
      for (const n of list) for (const u of [n.embed, ...(n.sources || []).map(s => s.url)].filter(Boolean)) set.add(key(u));
  return set;
}
function key(u) {
  const w = String(u).match(/(\w+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/);
  if (w) return `wiki:${w[1]}:${decodeURIComponent(w[2]).replace(/_/g, ' ').toLowerCase()}`;
  return String(u).replace(/^https?:\/\/(www\.|old\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
}

// ---------- Wikipedia: „Czy wiesz” / „Did you know” ----------
const SKIP_NS = /^(Plik|File|Image|Grafika|Wikipedia|Wikiprojekt|Szablon|Template|Specjalna|Special|Pomoc|Help|Kategoria|Category|Portal|Dyskusja|Talk|Wikipedysta|User)[: ]/i;
function hooksFromHtml(html, lang) {
  const out = [];
  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
    const inner = m[1];
    const text = strip(inner);
    if (!/^(\.\.\.|…)/.test(text) || text.length < 25) continue;
    // główny artykuł = pogrubiony link; inaczej pierwszy link do artykułu
    const links = [...inner.matchAll(/<a [^>]*href="\/wiki\/([^"#?]+)"[^>]*>/g)].map(x => decodeURIComponent(x[1]).replace(/_/g, ' '));
    const bold = inner.match(/<b>\s*(?:<i>)?\s*<a [^>]*href="\/wiki\/([^"#?]+)"/);
    const title = bold ? decodeURIComponent(bold[1]).replace(/_/g, ' ') : links.find(t => !SKIP_NS.test(t));
    if (!title || SKIP_NS.test(title)) continue;
    const hook = text.replace(/\s*\((pictured|na zdjęciu|na ilustracji|pictured above|on ilustracji)\)/gi, '').replace(/\s+([?.,])/g, '$1');
    out.push({ lang, hook, title, links: [...new Set(links.filter(t => !SKIP_NS.test(t)))].slice(0, 6) });
  }
  return out;
}
async function wikiHooks(lang, pages) {
  const all = [];
  for (const page of pages) {
    try {
      const j = await get(`https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&formatversion=2&redirects=1`);
      if (j.error) throw new Error(j.error.info);
      const hooks = hooksFromHtml(j.parse.text, lang);
      status[`wiki-${lang}:${page}`] = `ok ${hooks.length}`;
      all.push(...hooks.map(h => ({ ...h, page })));
    } catch (e) { status[`wiki-${lang}:${page}`] = 'błąd: ' + e.message; }
  }
  return all;
}
// dane artykułów (wstęp, adres, główny obraz) w paczkach po 20
async function articles(lang, titles) {
  const res = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const part = titles.slice(i, i + 20);
    const j = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|pageimages|info&exintro=1&explaintext=1&exsentences=4&piprop=name&inprop=url&titles=${encodeURIComponent(part.join('|'))}`);
    const redir = new Map([...(j.query?.normalized || []), ...(j.query?.redirects || [])].map(r => [r.from, r.to]));
    const byTitle = new Map((j.query?.pages || []).map(p => [p.title, p]));
    for (const t of part) {
      let cur = t; for (let k = 0; k < 3 && redir.has(cur); k++) cur = redir.get(cur);
      const p = byTitle.get(cur);
      if (p && !p.missing) res.set(t, { title: p.title, url: p.fullurl, extract: (p.extract || '').slice(0, 900), image: p.pageimage || null });
    }
  }
  return res;
}
// licencja i autor plików z Commons; plik lokalny (np. niewolny z en.wiki) nie istnieje na Commons i odpada
const FREE = /^(CC0|CC[ -]BY(-SA)?( \d\.\d)?( \w+)?|Public domain|PD\b.*)$/i;
async function commons(files) {
  const res = new Map();
  for (let i = 0; i < files.length; i += 40) {
    const part = files.slice(i, i + 40);
    const j = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=${IMG_WIDTH}&titles=${encodeURIComponent(part.map(f => 'File:' + f).join('|'))}`);
    const norm = new Map((j.query?.normalized || []).map(r => [r.to, r.from]));
    for (const p of j.query?.pages || []) {
      const ii = p.imageinfo?.[0]; if (!ii || p.missing) continue;
      const md = ii.extmetadata || {};
      const lic = strip(md.LicenseShortName?.value || '');
      const nonFree = String(md.NonFree?.value || '').toLowerCase() === 'true';
      const name = (norm.get(p.title) || p.title).replace(/^File:/, '');
      res.set(name.replace(/_/g, ' '), {
        src: ii.thumburl || ii.url, file_page: ii.descriptionurl, file: p.title,
        artist: strip(md.Artist?.value || '').slice(0, 120) || 'nieznany autor',
        license: lic, license_url: md.LicenseUrl?.value || null,
        width: ii.width, height: ii.height,
        ok: !nonFree && FREE.test(lic) && /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(ii.thumburl || ii.url || ''),
      });
    }
  }
  return res;
}
async function wikiCandidates(lang, pages, used, limit) {
  const hooks = shuffle(await wikiHooks(lang, pages));
  const seen = new Set(); const pick = [];
  for (const h of hooks) {
    const k = `wiki:${lang}:${h.title.toLowerCase()}`;
    if (used.has(k) || seen.has(k)) continue;
    seen.add(k); pick.push(h);
    if (pick.length >= limit) break;
  }
  if (!pick.length) return [];
  const arts = await articles(lang, pick.map(h => h.title));
  const files = [...new Set([...arts.values()].map(a => a.image).filter(Boolean).map(f => f.replace(/_/g, ' ')))];
  const imgs = files.length ? await commons(files) : new Map();
  return pick.filter(h => arts.has(h.title)).map(h => {
    const a = arts.get(h.title);
    const im = a.image ? imgs.get(a.image.replace(/_/g, ' ')) : null;
    return {
      source: `wiki-${lang}`, lang, hook: h.hook,
      article: { title: a.title, url: a.url, extract: a.extract },
      related: h.links.filter(t => t !== h.title),
      image: im && im.ok ? im : null,
      image_rejected: im && !im.ok ? `${im.license || 'brak licencji'} (${im.file})` : (a.image && !im ? `plik ${a.image} nie jest na Commons (prawdopodobnie niewolny)` : undefined),
    };
  });
}

// ---------- Reddit r/todayilearned ----------
async function reddit(used) {
  try {
    const j = await get('https://www.reddit.com/r/todayilearned/top.json?t=day&limit=40&raw_json=1');
    const out = (j.data?.children || []).map(c => c.data).filter(d => !d.stickied && !d.over_18 && d.url && !used.has(key(d.url)))
      .map(d => ({ source: 'reddit-til', lang: 'en', hook: d.title.replace(/^TIL( that)?:?\s*/i, ''), article: { title: d.title, url: d.url, extract: '' },
        discussion: 'https://www.reddit.com' + d.permalink, score: d.score, image: null }));
    status['reddit-til'] = `ok ${out.length}`;
    return out.slice(0, 25);
  } catch (e) { status['reddit-til'] = 'błąd: ' + e.message; return []; }
}

// ---------- RSS serwisów z ciekawostkami ----------
const FEEDS = [
  { name: 'Atlas Obscura', url: 'https://www.atlasobscura.com/feeds/latest', lang: 'en' },
  { name: 'Mental Floss', url: 'https://www.mentalfloss.com/rss.xml', lang: 'en' },
  { name: 'Smithsonian Smart News', url: 'https://www.smithsonianmag.com/rss/smart-news/', lang: 'en' },
  { name: 'Ciekawostki historyczne', url: 'https://ciekawostkihistoryczne.pl/feed/', lang: 'pl' },
];
async function feeds(used) {
  const out = [];
  for (const f of FEEDS) {
    try {
      const xml = await get(f.url, { json: false });
      const items = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)].map(m => m[0]);
      let n = 0;
      for (const it of items.slice(0, 12)) {
        const title = strip((it.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, ''));
        const link = (it.match(/<link>([^<]+)<\/link>/) || it.match(/<link[^>]+href="([^"]+)"/) || [])[1];
        const date = strip((it.match(/<(pubDate|published|updated)>([^<]+)</) || [])[2]);
        const desc = strip((it.match(/<(description|summary)[^>]*>([\s\S]*?)<\/\1>/) || [])[2]?.replace(/<!\[CDATA\[|\]\]>/g, '')).slice(0, 400);
        if (!title || !link || used.has(key(link))) continue;
        out.push({ source: 'rss', feed: f.name, lang: f.lang, hook: title, article: { title, url: link.trim(), extract: desc }, published: date, image: null });
        n++;
      }
      status['rss:' + f.name] = `ok ${n}`;
    } catch (e) { status['rss:' + f.name] = 'błąd: ' + e.message; }
  }
  return out;
}

// ---------- start ----------
const used = usedKeys();
const month = new Date().toLocaleString('en-US', { month: 'long', timeZone: 'Europe/Warsaw' });
const year = today.slice(0, 4);
const results = await Promise.all([
  wikiCandidates('pl', ['Szablon:Czy wiesz', 'Wikiprojekt:Czy wiesz/ekspozycje'], used, PER_SOURCE['wiki-pl']).catch(e => { status['wiki-pl'] = 'błąd: ' + e.message; return []; }),
  wikiCandidates('en', ['Template:Did you know', 'Wikipedia:Recent additions', `Wikipedia:Recent additions/${year}/${month}`], used, PER_SOURCE['wiki-en']).catch(e => { status['wiki-en'] = 'błąd: ' + e.message; return []; }),
  reddit(used),
  feeds(used),
]);
const candidates = results.flat().map((c, i) => ({ id: `c${i + 1}`, ...c }));
const withImg = candidates.filter(c => c.image).length;
const run = { run: { date: today, slot, generated_at: new Date().toISOString(), candidates: candidates.length, with_free_image: withImg }, status, candidates };
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${today}-${slot}.json`);
fs.writeFileSync(file, JSON.stringify(run, null, 1) + '\n');
log(`Zapisano ${file}: ${candidates.length} kandydatów, ${withImg} z wolnym zdjęciem.`);
for (const [k, v] of Object.entries(status)) log(`  ${k}: ${v}`);
if (!candidates.length) { console.error('::error::Zero kandydatów, sprawdź status źródeł.'); process.exit(1); }
