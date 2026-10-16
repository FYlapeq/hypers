// Generuje statyczne strony artykułów z data/editions.js, żeby każdy news miał własny adres
// (Google, AdSense i udostępnianie linków widzą pełną treść bez JavaScriptu).
// Uruchom: node scripts/build.mjs   (bez zależności, Node 18+)
// Wynik: artykuly/RRRR-MM-DD/<slug>.html, archiwum.html, data/urls.js, sitemap.xml
// oraz najnowsze wydanie wstawione do index.html (znaczniki <!-- wydanie… -->)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://hypers.tech';
const OUT_DIR = 'artykuly';

const SECTIONS = [
  { key: 'ryby', title: 'Grube ryby' },
  { key: 'drama', title: 'Drama' },
  { key: 'luz', title: 'Na luzie' },
  { key: 'ciekawostki', title: 'Ciekawostki' },
  { key: 'czapy', title: 'Z czapy' },
  { key: 'drop', title: 'Dropy' },
];
const MONTHS = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
const KIND = { kadr: 'Kadr z filmu', ilustracja: 'Zdjęcie ilustracyjne', prasowe: 'Materiał prasowy', wolne: 'Zdjęcie' };
const THUMB_HOST = /^https:\/\/(i\.ytimg\.com|upload\.wikimedia\.org)\//;

// ---------- dane ----------
function loadEditions() {
  const code = fs.readFileSync(path.join(ROOT, 'data/editions.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: 'editions.js' });
  const ed = sandbox.window.HYPERS_EDITIONS;
  if (!ed || typeof ed !== 'object') throw new Error('data/editions.js: brak window.HYPERS_EDITIONS');
  return ed;
}

// ---------- pomocnicze ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';
const PL = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
export function slugify(t) {
  let s = String(t || '').toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL[c])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, '').replace(/(-[a-z]{1,2})+$/, '');
  return s || 'news';
}
const plDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
// przesunięcie Europe/Warsaw dla danej daty (+01:00 zimą, +02:00 latem)
function warsawOffset(iso) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'longOffset' });
  const name = f.formatToParts(new Date(iso + 'T12:00:00Z')).find(p => p.type === 'timeZoneName').value;
  return name.replace('GMT', '') || '+00:00';
}
const isoTime = (date, slot) => {
  const [h, m] = String(slot || '7:00').split(':').map(Number);
  return `${date}T${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00${warsawOffset(date)}`;
};

function parseEmbed(u) {
  if (!u) return null; let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/))) return { p: 'yt', name: 'YouTube', label: 'Film na YouTube', id: m[1], url: u };
  if ((m = u.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/))) return { p: 'ig', name: 'Instagram', label: 'Post na Instagramie', url: `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/` };
  if ((m = u.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/))) return { p: 'tt', name: 'TikTok', label: 'Film na TikToku', id: m[1], url: u };
  if ((m = u.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/))) return { p: 'x', name: 'X', label: 'Wpis na X', id: m[1], url: u.replace('x.com', 'twitter.com') };
  return null;
}
function embedOf(n) {
  const src = n.sources || [];
  for (const u of [n.embed, ...src.filter(x => x.origin).map(x => x.url), ...src.map(x => x.url)]) {
    const e = parseEmbed(u); if (e) return e;
  }
  return null;
}

// ---------- lista artykułów ze stabilnymi adresami ----------
function collect(editions) {
  const items = [];
  for (const date of Object.keys(editions).sort().reverse()) {
    const ed = editions[date]; const used = new Set();
    for (const sec of SECTIONS) {
      (ed[sec.key] || []).forEach((n, i) => {
        let slug = n.slug ? slugify(n.slug) : slugify(n.title), k = 2;
        while (used.has(slug)) slug = `${slugify(n.slug || n.title)}-${k++}`;
        used.add(slug);
        items.push({ n, date, sec, i, slug, rel: `${OUT_DIR}/${date}/${slug}.html` });
      });
    }
  }
  return items;
}

// ---------- szablony ----------
function head({ title, desc, canonical, image, prefix, extra = '', current = '' }) {
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#276787">
<meta property="og:site_name" content="Hypers">
<meta property="og:locale" content="pl_PL">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
${extra}<link rel="preload" href="${prefix}fonts/anton-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${prefix}fonts/fonts.css">
<link rel="stylesheet" href="${prefix}assets/hypers.css">
</head>
<body>
<header class="mast"><div class="wrap"><a class="logo" href="${prefix}">Hypers</a><div class="issue">Newsy o twórcach<span>codziennie o 7:00 i 15:00</span></div></div></header>
<div class="bar-sentinel" id="bar-sentinel"></div>
<nav class="bar" id="bar" aria-label="Nawigacja"><div class="wrap"><a class="mini" href="${prefix}" tabindex="-1" aria-hidden="true">Hypers</a><div class="seg"><a href="${prefix}">Najnowsze wydanie</a><a href="${prefix}archiwum.html"${current === 'arch' ? ' aria-current="page"' : ''}>Archiwum</a></div></div></nav>
`;
}
function foot(prefix) {
  return `<footer class="wrap site-foot">
  <p><strong>Hypers</strong> wychodzi codziennie o 7:00 i 15:00. Źródła każdego newsa podajemy pod artykułem.</p>
  <nav aria-label="Informacje"><a href="${prefix}archiwum.html">Archiwum</a><a href="${prefix}o-nas.html">O nas</a><a href="${prefix}kontakt.html">Kontakt</a><a href="${prefix}polityka-prywatnosci.html">Polityka prywatności</a><a href="${prefix}regulamin.html">Regulamin</a><button class="linkbtn" id="c-open">Ustawienia cookies</button></nav>
</footer>
<div class="consent" id="consent" role="dialog" aria-labelledby="c-title" hidden>
  <div class="wrap">
    <strong id="c-title">Zdjęcia i filmy w Hypers</strong>
    <p>Pokazujemy oryginalne posty i filmy twórców z Instagrama, TikToka, X i YouTube'a. Te serwisy zapisują pliki cookies i mogą używać ich także do reklam. Jeśli się zgodzisz, posty wyświetlą się od razu. Bez zgody zobaczysz tylko teksty i nasze grafiki. Zgodę zmienisz w każdej chwili w stopce. <a href="${prefix}polityka-prywatnosci.html">Polityka prywatności</a></p>
    <div class="acts"><button class="btn" id="c-yes">Akceptuję</button><button class="btn alt" id="c-no">Odrzuć</button></div>
  </div>
</div>
<script src="${prefix}assets/article.js"></script>
</body>
</html>
`;
}

function imgCredit(im) {
  return `${KIND[im.kind] || 'Zdjęcie'}: ${esc(im.credit || '')}${im.href ? `, <a href="${esc(safeUrl(im.href))}" target="_blank" rel="noopener">źródło</a>` : ''}`;
}
function photoFigure(n) {
  const im = n.image; if (!im) return '';
  const fb = im.fallback ? ` data-fallback="${esc(safeUrl(im.fallback))}"` : '';
  return `<figure class="fig"><div class="photo"><img src="${esc(safeUrl(im.src))}" alt="${esc(im.alt || '')}" referrerpolicy="no-referrer"${fb}><span class="cr-pill">${esc((KIND[im.kind] || 'Zdjęcie') + ': ' + (im.credit || ''))}</span></div><figcaption>${im.caption ? esc(im.caption) : ''}<span class="cr">${imgCredit(im)}</span></figcaption></figure>`;
}
function embedBlock(n, prefix) {
  const e = embedOf(n); if (!e) return '';
  const c = n.caption || {};
  const cr = `Materiał: ${c.credit ? '' : 'Źródło: '}${esc(c.credit || e.name)}, <a href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener">oryginał</a>`;
  return `<figure class="fig"><div class="embed" id="embed" data-p="${e.p}" data-id="${esc(e.id || '')}" data-url="${esc(e.url)}" data-title="${esc(n.title)}">
    <div class="embed-gate">
      <span class="plat">${e.label}</span>
      <p>Ten materiał ładuje się z serwisu ${e.name}, który może zapisać pliki cookies. Bez Twojej zgody go nie wczytujemy. Możesz wyświetlić tylko ten jeden post albo włączyć posty na stałe (<a href="${prefix}polityka-prywatnosci.html">więcej</a>).</p>
      <div class="acts"><button class="btn" data-load>Pokaż</button><button class="ghost" data-always>Zawsze pokazuj posty</button>
      <a class="orig-link" href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener">Otwórz w serwisie ${e.name}</a></div>
    </div></div><figcaption>${c.text ? esc(c.text) : ''}<span class="cr">${cr}</span></figcaption></figure>`;
}
function metaLine(it) {
  const n = it.n; const ok = (n.sources || []).some(x => x.origin); const e = embedOf(n);
  return `<div class="meta">${n.slot ? `<span class="slot">${esc(n.slot)}</span>` : ''}<span class="tag">${esc(it.sec.title)}</span>${n.region === 'world' ? '<span class="tag world">Świat</span>' : ''}<span>${esc(n.who || '')}</span><span>${esc(n.category)}</span><span>Wydanie z ${plDate(it.date)}</span>${ok ? '<span class="ok">Potwierdzone u źródła</span>' : ''}${e ? `<span class="emb">▶ ${e.name}</span>` : ''}</div>`;
}

function articlePage(it, siblings) {
  const n = it.n, prefix = '../../', canonical = `${SITE}/${it.rel}`;
  const img = n.image && /^https?:/.test(n.image.src || '') ? n.image.src : `${SITE}/og.png`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: n.title, description: n.summary, inLanguage: 'pl-PL',
    datePublished: isoTime(it.date, n.slot), dateModified: isoTime(it.date, n.slot),
    image: [img], mainEntityOfPage: canonical, articleSection: it.sec.title,
    author: { '@type': 'Person', name: 'Filip Mioduszewski', url: `${SITE}/o-nas.html` },
    publisher: { '@type': 'Organization', name: 'Hypers', url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/og.png` } },
  };
  const body = (n.body && n.body.length ? n.body : [n.summary]).map(p => `<p>${esc(p)}</p>`).join('\n    ');
  const srcs = (n.sources || []).map(x => `<li><a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${esc(x.name)}</a>${x.origin ? ' <span class="orig">✓ u twórcy</span>' : ''}</li>`).join('');
  const more = siblings.filter(s => s !== it).slice(0, 6).map(s => {
    const im = s.n.image && THUMB_HOST.test(s.n.image.src || '') ? s.n.image : null;
    const fb = im && im.fallback ? ` data-fallback="${esc(safeUrl(im.fallback))}"` : '';
    const thumb = im ? `<div class="media"><div class="photo"><img src="${esc(safeUrl(im.src))}" alt="" loading="lazy" referrerpolicy="no-referrer"${fb}><span class="cr-pill">${esc((im.kind === 'kadr' ? 'Kadr: ' : '') + (im.credit || ''))}</span></div></div>` : '';
    return `<li><article class="card">${thumb}<div class="body"><div class="meta"><span class="tag">${esc(s.sec.title)}</span><span>${esc(s.n.who || '')}</span></div><h3 class="hl"><a class="card-link" href="${prefix}${s.rel}">${esc(s.n.title)}</a></h3></div></article></li>`;
  }).join('');
  return head({
    title: `${n.title} | Hypers`, desc: n.summary, canonical, image: img, prefix,
    extra: `<meta property="og:type" content="article">\n<meta property="article:published_time" content="${ld.datePublished}">\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n`,
  }) + `<main class="wrap">
  <article class="article">
    <p class="crumbs"><a href="${prefix}">Hypers</a> › <a href="${prefix}archiwum.html#d-${it.date}">${plDate(it.date)}</a> › ${esc(it.sec.title)}</p>
    <h1 class="hl">${esc(n.title)}</h1>
    ${metaLine(it)}
    <p class="lede">${esc(n.summary)}</p>
    ${photoFigure(n)}
    ${embedBlock(n, prefix)}
    <div class="body">
    ${body}
    </div>
    <div class="article-src"><h2>Źródła</h2><ul>${srcs}</ul></div>
    <p class="ai-note">Przy szukaniu źródeł i szkicu tekstu korzystaliśmy z narzędzi AI. Fakty sprawdziła i za treść odpowiada redakcja. <a href="${prefix}o-nas.html">Jak pracujemy</a> · <a href="${prefix}kontakt.html">Zgłoś błąd</a></p>
    ${more ? `<nav class="more-list" aria-label="Więcej z wydania"><h2>Więcej z ${plDate(it.date)}</h2><ul>${more}</ul></nav>` : ''}
    <a class="back" href="${prefix}">Wróć do najnowszego wydania</a>
  </article>
</main>
` + foot(prefix);
}

function archivePage(items) {
  const byDate = new Map();
  for (const it of items) { if (!byDate.has(it.date)) byDate.set(it.date, []); byDate.get(it.date).push(it); }
  const days = [...byDate].map(([d, list]) => `<h2 id="d-${d}">${plDate(d)}</h2><ul>${list.map(it => `<li><a href="${it.rel}">${esc(it.n.title)}</a><small>${esc(it.sec.title)} · ${esc(it.n.category || '')}${it.n.slot ? ' · ' + esc(it.n.slot) : ''}</small></li>`).join('')}</ul>`).join('\n  ');
  return head({ title: 'Archiwum | Hypers', desc: 'Wszystkie artykuły Hypers ułożone według dni wydania.', canonical: `${SITE}/archiwum.html`, image: `${SITE}/og.png`, prefix: '', current: 'arch', extra: '<meta property="og:type" content="website">\n' })
    + `<main class="wrap"><div class="arch">
  <h1>Archiwum</h1>
  <p>Wszystkie artykuły z wcześniejszych wydań. Najnowsze wydanie znajdziesz na <a href="./">stronie głównej</a>.</p>
  ${days}
</div></main>
` + foot('');
}

function sitemap(items) {
  const today = new Date().toISOString().slice(0, 10);
  const latest = items[0] ? items[0].date : today;
  const urls = [
    { loc: `${SITE}/`, lastmod: latest, freq: 'daily' },
    { loc: `${SITE}/archiwum.html`, lastmod: latest, freq: 'daily' },
    ...['o-nas', 'kontakt', 'regulamin', 'polityka-prywatnosci'].map(p => ({ loc: `${SITE}/${p}.html` })),
    ...items.map(it => ({ loc: `${SITE}/${it.rel}`, lastmod: it.date })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.freq ? `<changefreq>${u.freq}</changefreq>` : ''}</url>`).join('\n')}
</urlset>
`;
}

// mapa adresów dla strony głównej: data -> sekcja -> [adres artykułu wg indeksu w liście]
function urlsJs(items) {
  const map = {};
  for (const it of items) {
    ((map[it.date] ||= {})[it.sec.key] ||= [])[it.i] = it.rel;
  }
  return `// Wygenerowane przez scripts/build.mjs, nie edytuj ręcznie.\nwindow.HYPERS_URLS = ${JSON.stringify(map, null, 1)};\n`;
}

// ---------- strona główna: najnowsze wydanie w statycznym HTML ----------
// index.html renderuje wydanie w JS, ale roboty (Google, Facebook, AdSense) i czytelnicy bez JS
// mają dostać gotową treść od razu. Build wstawia ostatnie wydanie między znaczniki w index.html;
// skrypt strony i tak przerysowuje #view po wczytaniu, więc wygląd się nie zmienia.
const HOME_SECTIONS = [
  { key: 'ryby', sub: 'Duże tematy: analiza i kontekst' },
  { key: 'drama', sub: 'Konflikty, afery, kontrowersje' },
  { key: 'luz', sub: 'Newsy o twórcach' },
  { key: 'ciekawostki', sub: 'Krótko, nieoczywiście, z całego internetu' },
  { key: 'czapy', sub: 'Krótko i nieoczywiście' },
  { key: 'drop', sub: 'Ciuchy, buty i kolaboracje' },
];
const DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const pad2 = n => String(n).padStart(2, '0');
const nyNewsy = n => n === 1 ? '1 news' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? n + ' newsy' : n + ' newsów';

function homeCard(it, lead) {
  const n = it.n, im = n.image && THUMB_HOST.test(n.image.src || '') ? n.image : null;
  const fb = im && im.fallback ? ` onerror="this.onerror=null;this.src='${esc(safeUrl(im.fallback))}'"` : '';
  const media = im ? `<div class="media"><div class="photo"><img src="${esc(safeUrl(im.src))}" alt="${esc(im.alt || '')}"${lead ? '' : ' loading="lazy"'} referrerpolicy="no-referrer"${fb}><span class="cr-pill">${esc((im.kind === 'kadr' ? 'Kadr: ' : im.kind === 'wolne' ? 'Fot.: ' : '') + (im.credit || ''))}</span></div></div>` : '';
  const meta = `<div class="meta">${lead ? '<span class="tag top">Temat dnia</span>' : ''}${n.region === 'world' ? '<span class="tag world">Świat</span>' : ''}<span class="tag">${esc(n.category || it.sec.title)}</span><span>${esc(n.who || '')}</span>${n.slot && n.slot !== '7:00' ? `<span class="slot">${esc(n.slot)}</span>` : ''}</div>`;
  return `<article class="card${lead ? ' lead' : ''}" data-card="${it.sec.key}:${it.i}">${media}<div class="body">${meta}<h3 class="hl"><a class="card-link" href="${it.rel}">${esc(n.title)}</a></h3><p class="sum">${esc(n.summary)}</p></div></article>`;
}

function homeStatic(items) {
  const date = items[0] && items[0].date; if (!date) return null;
  const day = items.filter(it => it.date === date);
  const bySec = key => day.filter(it => it.sec.key === key);
  // temat dnia: pierwszy news ze zdjęciem w Grubych rybach, potem w Na luzie (jak w index.html)
  const leadIt = ['ryby', 'luz'].map(k => bySec(k).find(it => it.n.image)).find(Boolean) || null;
  const sections = HOME_SECTIONS.map(s => {
    const list = bySec(s.key); if (!list.length) return '';
    const rest = list.filter(it => it !== leadIt).sort((a, b) => (!!b.n.image - !!a.n.image) || (a.i - b.i));
    const hasLead = leadIt && leadIt.sec.key === s.key;
    const title = list[0].sec.title;
    return `<section class="sec sec-${s.key}" id="${s.key}" data-sec="${s.key}">
    <div class="sec-head"><h2>${esc(title)}</h2><span class="sec-sub">${s.sub}</span></div>
    ${hasLead ? homeCard(leadIt, true) : ''}
    ${rest.length ? `<div class="feedgrid">${rest.map(it => homeCard(it, false)).join('')}</div>` : ''}</section>`;
  }).join('\n  ');
  const [y, m, d] = date.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  const slots = [...new Set(day.map(it => it.n.slot || '7:00'))].sort((a, b) => parseInt(a) - parseInt(b));
  const dates = [...new Set(items.map(it => it.date))];
  return {
    issue: `${DAYS[dt.getUTCDay()]} ${d}.${pad2(m)}<span>wydanie nr ${dates.length} · ${slots.join(' i ')} · ${nyNewsy(day.length)}</span>`,
    ticker: day.map(it => `<span>${esc(it.n.title)} <i>/</i></span>`).join(''),
    view: `<h2 class="visually-hidden">Wydanie z ${plDate(date)}</h2>\n  ${sections}\n  <p class="more-arch"><a href="archiwum.html">Wszystkie wcześniejsze wydania w archiwum</a></p>`,
  };
}

// podmienia treść między <!-- nazwa:start --> i <!-- nazwa:end -->; bez znaczników rzuca błąd, żeby nie zgubić zmiany po cichu
function fillMarker(html, name, content) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(html)) throw new Error(`index.html: brak znaczników <!-- ${name}:start/end -->`);
  return html.replace(re, (_, a, b) => `${a}${content}${b}`);
}

function writeHome(items) {
  const file = path.join(ROOT, 'index.html'), home = homeStatic(items);
  if (!home) return;
  let html = fs.readFileSync(file, 'utf8');
  html = fillMarker(html, 'wydanie-naglowek', home.issue);
  html = fillMarker(html, 'wydanie-pasek', home.ticker);
  html = fillMarker(html, 'wydanie', `\n  ${home.view}\n  `);
  fs.writeFileSync(file, html);
}

// ---------- zapis ----------
function main() {
  const items = collect(loadEditions());
  fs.rmSync(path.join(ROOT, OUT_DIR), { recursive: true, force: true });
  const byDate = new Map();
  for (const it of items) { if (!byDate.has(it.date)) byDate.set(it.date, []); byDate.get(it.date).push(it); }
  for (const it of items) {
    const file = path.join(ROOT, it.rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, articlePage(it, byDate.get(it.date)));
  }
  fs.writeFileSync(path.join(ROOT, 'archiwum.html'), archivePage(items));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(items));
  fs.writeFileSync(path.join(ROOT, 'data/urls.js'), urlsJs(items));
  writeHome(items);
  console.log(`Zbudowano ${items.length} artykułów z ${byDate.size} wydań.`);
}
main();
