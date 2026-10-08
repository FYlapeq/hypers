// Pobiera zdjęcia do newsów bez pola `img`: bierze og:image / twitter:image ze źródeł,
// zmniejsza do 1200 px (JPEG) i zapisuje w img/. Uruchamiane przez GitHub Actions.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const FILE = 'data/editions.js';
const raw = fs.readFileSync(FILE, 'utf8');
const prefix = raw.slice(0, raw.indexOf('window.HYPERS_EDITIONS = '));
const window = {};
eval(raw);
const editions = window.HYPERS_EDITIONS;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SKIP = /instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com/i;
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

async function getText(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'pl,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
function findImage(html, base) {
  const pats = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
  ];
  for (const p of pats) { const m = html.match(p); if (m) return new URL(m[1].replace(/&amp;/g, '&'), base).href; }
  return null;
}
function youtubeThumb(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

let changed = 0;
for (const [date, ed] of Object.entries(editions)) {
  for (const sec of ['drama', 'luz', 'drop']) {
    for (const n of ed[sec] || []) {
      if (n.img && fs.existsSync(n.img)) continue;
      for (const src of n.sources || []) {
        if (!src.url || SKIP.test(src.url)) continue;
        try {
          const imgUrl = youtubeThumb(src.url) || findImage(await getText(src.url), src.url);
          if (!imgUrl) continue;
          const r = await fetch(imgUrl, { headers: { 'user-agent': UA, referer: src.url }, signal: AbortSignal.timeout(20000) });
          const type = r.headers.get('content-type') || '';
          if (!r.ok || !type.startsWith('image/')) continue;
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 5000 || buf.length > 15e6) continue;
          const out = path.join('img', `${date}-${slug(n.who || n.title)}.jpg`);
          const meta = await sharp(buf).metadata();
          if ((meta.width || 0) < 400) continue;
          await sharp(buf).rotate().resize({ width: 1200, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 80, progressive: true }).toFile(out);
          n.img = out.replace(/\\/g, '/');
          n.imgCredit = src.name;
          changed++;
          console.log(`OK  ${date} ${sec} ${n.who}: ${src.name}`);
          break;
        } catch (e) {
          console.log(`--  ${date} ${sec} ${n.who}: ${src.name}: ${e.message}`);
        }
      }
      if (!n.img) console.log(`BRAK ${date} ${sec} ${n.who}`);
    }
  }
}
if (changed) fs.writeFileSync(FILE, prefix + 'window.HYPERS_EDITIONS = ' + JSON.stringify(editions, null, 2) + ';\n');
console.log(`Dodano zdjęć: ${changed}`);
