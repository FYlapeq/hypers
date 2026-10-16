// Zbieracz ciekawostek dla sekcji Ciekawostki. Uruchamia go GitHub Actions
// (.github/workflows/zbieracz-ciekawostek.yml) przed wydaniami 7:00 i 15:00.
// Bez zależności, Node 20+.
//
//   node scripts/zbieracz-ciekawostek.mjs <rano|popoludnie> <katalog wyjściowy>
//
// Wynik: <katalog>/RRRR-MM-DD-<slot>.json z kandydatami na ciekawostki:
//  - Wikipedia „Czy wiesz…” (PL) i „Did you know…” (EN, także archiwum z bieżącego miesiąca):
//    gotowy, sprawdzony przez wikipedystów fakt + artykuł + zdjęcie z Wikimedia Commons z autorem i licencją,
//  - Wikipedia „Unusual articles” (EN): niszowe, dziwne tematy z krótkim opisem i zdjęciem z Commons,
//  - kanały RSS serwisów z ciekawostkami (tylko temat i link; zdjęcie trzeba znaleźć).
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
const PER_SOURCE = { 'wiki-pl': 15, 'wiki-en': 30 };

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
// polska „Czy wiesz” nie trzyma haczyków w <li>: tniemy HTML po wielokropku do znaku zapytania
function hooksPl(html) {
  const out = [];
  for (const part of html.split(/…|&#8230;|&hellip;/).slice(1)) {
    const end = part.search(/\?(?=\s*(<|$))/);
    if (end < 0) continue;
    const seg = part.slice(0, end + 1);
    const text = '…' + strip(seg);
    if (text.length < 30 || text.length > 400 || !/^…\s*(że|czy|jak|kto|co|gdzie|dlaczego|ile|który|która|które|kiedy)\b/i.test(text)) continue;
    const bold = seg.match(/<b>\s*(?:<i>)?\s*<a [^>]*href="\/wiki\/([^"#?]+)"/);
    const links = [...seg.matchAll(/<a [^>]*href="\/wiki\/([^"#?]+)"/g)].map(x => decodeURIComponent(x[1]).replace(/_/g, ' ')).filter(t => !SKIP_NS.test(t));
    const title = bold ? decodeURIComponent(bold[1]).replace(/_/g, ' ') : links[0];
    if (!title || SKIP_NS.test(title)) continue;
    out.push({ lang: 'pl', hook: text.replace(/\s*\((na zdjęciu|na ilustracji)\)/gi, ''), title, links: [...new Set(links)].slice(0, 6) });
  }
  return out;
}
function hooksFromHtml(html, lang) {
  if (lang === 'pl') return hooksPl(html);
  const out = [];
  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
    const inner = m[1];
    const text = strip(inner);
    // EN: „... that …?”; PL: haczyki „…że …?” (czasem bez wielokropka, ale zawsze pytanie)
    if (!(/^(\.\.\.|…)/.test(text) || (lang === 'pl' && /\?$/.test(text))) || text.length < 25) continue;
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
// Wikipedia:Unusual articles: tabele „artykuł | opis”, świetne niszowe tematy
function unusualFromHtml(html, lang) {
  const out = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1]);
    if (cells.length < 2) continue;
    const a = cells[0].match(/<a [^>]*href="\/wiki\/([^"#?]+)"/);
    if (!a) continue;
    const title = decodeURIComponent(a[1]).replace(/_/g, ' ');
    const desc = strip(cells[1]);
    if (SKIP_NS.test(title) || desc.length < 20) continue;
    out.push({ lang, hook: `${strip(cells[0])}: ${desc}`, title, links: [] });
  }
  return out;
}
async function wikiHooks(lang, pages) {
  const all = [];
  for (const page of pages) {
    try {
      const j = await get(`https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&formatversion=2&redirects=1`);
      if (j.error) throw new Error(j.error.info);
      const hooks = page.includes('Unusual') ? unusualFromHtml(j.parse.text, lang) : hooksFromHtml(j.parse.text, lang);
      status[`wiki-${lang}:${page}`] = `ok ${hooks.length}` + (hooks.length ? '' :
        ` (li: ${(j.parse.text.match(/<li/g) || []).length}, próbka: ${(j.parse.text.match(/<li[^>]*>[\s\S]*?<\/li>/g) || []).slice(0, 3).map(strip).join(' || ').slice(0, 400)})`);
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
// bierze losowe haczyki paczkami, aż uzbiera `limit` kandydatów z wolnym zdjęciem (plus kilka bez zdjęcia)
async function wikiCandidates(lang, pages, used, limit) {
  const seen = new Set();
  const hooks = shuffle(await wikiHooks(lang, pages)).filter(h => {
    const k = `wiki:${lang}:${h.title.toLowerCase()}`;
    if (used.has(k) || seen.has(k)) return false;
    seen.add(k); return true;
  });
  const out = []; let noImg = 0;
  for (let i = 0; i < hooks.length && out.filter(c => c.image).length < limit && i < 400; i += 40) {
    for (const c of await enrich(lang, hooks.slice(i, i + 40))) {
      if (c.image) out.push(c);
      else if (noImg < 8) { out.push(c); noImg++; }
    }
  }
  return out;
}
async function enrich(lang, pick) {
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

// ---------- drugie źródło: przypisy artykułu sprawdzane automatycznie ----------
// Dla kandydatów ze zdjęciem bierzemy linki zewnętrzne artykułu Wikipedii (przypisy), pobieramy kilka z nich
// i sprawdzamy, czy strona zawiera kluczowe słowa i liczby z haczyka. Trafienie = `second_source`,
// więc sesja wydania nie musi szukać drugiego źródła w sieci (WebFetch tylko, gdy go brak).
const VERIFY_MAX = 30, REFS_PER = 6;
const SKIP_REF = /(wikipedia\.org|wikimedia\.org|wikidata\.org|mediawiki\.org|doi\.org|books\.google|google\.[a-z.]+\/(search|books)|worldcat|jstor\.org|viaf\.org|isni|orcid\.org|geohack|toolforge|wmflabs|openstreetmap|archive\.org\/details|catalog|\.pdf($|\?))/i;
const STOP = new Set(('that the and with from were was which their this have has into after before about over also only than when where while what whose most more first time years year other they them been would could being these those during under such some many during ' +
  'że czy jak kto gdzie dlaczego ile który która które kiedy jego jej ich oraz przez który była było został została zostało jako jest były także tylko może można przed około według podczas').split(' '));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
export function keyTerms(c) {
  const text = `${c.hook} ${c.article?.title || ''}`;
  const nums = [...new Set((text.match(/\d[\d.,]*\d|\d{2,}/g) || []).map(n => n.replace(/[.,]/g, '')))].filter(n => n.length >= 2);
  const words = [...new Set(norm(text).replace(/\([^)]*\)/g, ' ').split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !STOP.has(w) && !/^\d+$/.test(w)))];
  return { nums, words: words.slice(0, 12) };
}
export function scorePage(page, { nums, words }) {
  const t = norm(page), tn = t.replace(/(\d)[.,\s](?=\d)/g, '$1');
  // rdzeń słowa (pierwsze 6 liter), żeby łapać odmianę: „odchodach” ~ „odchody”
  const hit = words.filter(w => t.includes(w.slice(0, Math.max(5, Math.min(w.length, 6)))));
  const numHit = nums.filter(n => tn.includes(n));
  return { hit, numHit, ok: hit.length >= Math.max(2, Math.ceil(words.length * 0.5)) && numHit.length === nums.length };
}
async function refsOf(lang, title) {
  const j = await get(`https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=externallinks&format=json&formatversion=2&redirects=1`);
  return [...new Set((j.parse?.externallinks || []).map(u => u.startsWith('//') ? 'https:' + u : u).filter(u => /^https?:\/\//.test(u) && !SKIP_REF.test(u)))];
}
async function pageText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (!r.ok || !/text\/html|text\/plain/.test(r.headers.get('content-type') || '')) throw new Error(`HTTP ${r.status}`);
  const html = (await r.text()).slice(0, 1_500_000);
  const tytul = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 140);
  return { tytul, text: strip(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')) };
}
const siteName = u => new URL(u).hostname.replace(/^www\./, '');
async function verify(c) {
  // tylko haczyki z faktem („…że …”, „… that …”); pytania „…co/kto/dlaczego…” nie mówią, co sprawdzać
  if (!/^(…|\.\.\.)\s*(że|that)\b/i.test(c.hook)) return { status: 'haczyk bez faktu (pytanie)' };
  const terms = keyTerms(c);
  if (terms.words.length < 2) return { status: 'za mało słów kluczowych w haczyku' };
  let refs;
  try { refs = (await refsOf(c.lang, c.article.title)).slice(0, REFS_PER); } catch (e) { return { status: 'błąd przypisów: ' + e.message }; }
  if (!refs.length) return { status: 'brak przypisów online' };
  let best = null;
  for (const url of refs) {
    try {
      const { tytul, text } = await pageText(url);
      const s = scorePage(text, terms);
      if (s.ok) return { status: 'ok', url, name: siteName(url), title: tytul, matched: [...s.numHit, ...s.hit] };
      if (!best || s.hit.length > best.hit) best = { hit: s.hit.length, url };
    } catch { /* strona nie odpowiada, próbujemy następną */ }
  }
  return { status: 'nie potwierdzono automatycznie', tried: refs.length, ...(best && { closest: best.url }) };
}
async function verifyAll(cands) {
  const queue = cands.filter(c => c.image && c.source.startsWith('wiki') && /^(…|\.\.\.)\s*(że|that)\b/i.test(c.hook)).slice(0, VERIFY_MAX);
  let i = 0, ok = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < queue.length) {
      const c = queue[i++];
      const v = await verify(c).catch(e => ({ status: 'błąd: ' + e.message }));
      if (v.status === 'ok') { c.second_source = { name: v.name, url: v.url, title: v.title, matched: v.matched }; ok++; }
      else c.second_source_check = v;
    }
  }));
  status['drugie-zrodlo'] = `ok ${ok}/${queue.length}`;
}

// ---------- start ----------
if (process.argv[1] && path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url)) { /* import w testach: bez uruchamiania */ } else {
const used = usedKeys();
const results = await Promise.all([
  wikiCandidates('pl', ['Szablon:Czy wiesz', 'Wikiprojekt:Czy wiesz/ekspozycje'], used, PER_SOURCE['wiki-pl']).catch(e => { status['wiki-pl'] = 'błąd: ' + e.message; return []; }),
  wikiCandidates('en', ['Template:Did you know', 'Wikipedia:Recent additions', 'Wikipedia:Unusual articles'], used, PER_SOURCE['wiki-en']).catch(e => { status['wiki-en'] = 'błąd: ' + e.message; return []; }),
  feeds(used),
]);
const candidates = results.flat().map((c, i) => ({ id: `c${i + 1}`, ...c }));
if (process.env.BEZ_WERYFIKACJI !== '1') await verifyAll(shuffle([...candidates]));
const withImg = candidates.filter(c => c.image).length;
const verified = candidates.filter(c => c.image && c.second_source).length;
const run = { run: { date: today, slot, generated_at: new Date().toISOString(), candidates: candidates.length, with_free_image: withImg, ready: verified }, status, candidates };
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${today}-${slot}.json`);
fs.writeFileSync(file, JSON.stringify(run, null, 1) + '\n');
log(`Zapisano ${file}: ${candidates.length} kandydatów, ${withImg} z wolnym zdjęciem.`);
for (const [k, v] of Object.entries(status)) log(`  ${k}: ${v}`);
if (!candidates.length) { console.error('::error::Zero kandydatów, sprawdź status źródeł.'); process.exit(1); }
}
