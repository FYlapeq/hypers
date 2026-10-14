// Narzędzie redakcji: oszczędza tokeny, bo nie trzeba czytać ani edytować całego data/editions.js.
// Bez zależności, Node 18+.
//
//   node scripts/edition.mjs recent [dni=7]        krótka lista ostatnich newsów (do sprawdzania duplikatów)
//   node scripts/edition.mjs digest <run.json> [limit=40]
//                                                   skrót pliku zbieracza: tylko to, co potrzebne do wyboru tematów
//   node scripts/edition.mjs video <run.json> <video_id>
//                                                   pełne dane jednego filmu (opis, komentarze, napisy) do napisania newsa
//   node scripts/edition.mjs add <nowe.json> [--no-build]
//                                                   waliduje i dopisuje newsy do wydania, potem uruchamia build.mjs
//   node scripts/edition.mjs remove <RRRR-MM-DD>   usuwa całe wydanie dnia (np. żeby wydać je od nowa), potem build.mjs
//
// Format <nowe.json>: { "date": "RRRR-MM-DD", "slot": "7:00"|"15:00", "ryby": [], "luz": [], "czapy": [] }
// Rano tworzy wydanie dnia. Po południu dopisuje newsy NA POCZĄTEK sekcji (zgodnie z CLAUDE.md).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data/editions.js');
const HEADER = '// Wydania Hypers: klucz = data wydania (RRRR-MM-DD)\n';
const SECTIONS = ['ryby', 'drama', 'luz', 'czapy', 'drop'];
const NEW_SECTIONS = ['ryby', 'luz', 'czapy'];

// ta sama funkcja co w build.mjs (build.mjs uruchamia się przy imporcie, więc kopia)
const PL = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
function slugify(t) {
  let s = String(t || '').toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL[c])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, '').replace(/(-[a-z]{1,2})+$/, '');
  return s || 'news';
}
const die = msg => { console.error('BŁĄD: ' + msg); process.exit(1); };

function load() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), sandbox);
  return sandbox.window.HYPERS_EDITIONS;
}
function save(ed) {
  fs.writeFileSync(FILE, HEADER + 'window.HYPERS_EDITIONS = ' + JSON.stringify(ed, null, 2) + ';\n');
}
const items = ed => Object.keys(ed).sort().reverse().flatMap(date =>
  SECTIONS.flatMap(s => (ed[date][s] || []).map(n => ({ date, section: s, n }))));
const normUrl = u => {
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return yt ? 'youtube.com/watch?v=' + yt[1] : u.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
};
const urlsOf = n => [n.embed, ...(n.sources || []).map(s => s.url)].filter(Boolean).map(normUrl);
const short = (s, max) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max - 1) + '…' : s; };

// ---------- recent ----------
function recent(days = 7) {
  const ed = load();
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  for (const { date, section, n } of items(ed)) {
    if (date < from) continue;
    const yt = urlsOf(n).find(u => /youtube/.test(u)) || urlsOf(n)[0] || '';
    console.log(`${date} ${section.padEnd(5)} ${short(n.who, 24).padEnd(24)} ${short(n.title, 90)}  ${yt}`);
  }
}

// ---------- digest / video ----------
function readRun(file) {
  if (!file || !fs.existsSync(file)) die('podaj ścieżkę do pliku runs/…json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
const GROUP_RANK = { lista: 0, zagranica: 1, streamer: 2, top100: 3 };
function digest(file, limit = 40) {
  const run = readRun(file);
  console.log('RUN', JSON.stringify(run.run || {}));
  console.log('STATUS', JSON.stringify(run.status || {}));
  if (run.to_check?.length) console.log('DO SPRAWDZENIA', run.to_check.join('; '));
  const vids = [...(run.videos || [])].sort((a, b) =>
    (GROUP_RANK[a.group] ?? 9) - (GROUP_RANK[b.group] ?? 9) || (b.stats?.views || 0) - (a.stats?.views || 0));
  console.log(`\nFILMY (${vids.length}, pokazano ${Math.min(limit, vids.length)}) - grupa | twórca | id | wyśw./lajki/kom. | short | napisy | tytuł | opis | top komentarz`);
  for (const v of vids.slice(0, limit)) {
    const s = v.stats || {};
    const top = (v.top_comments || [])[0];
    console.log([v.group, v.creator, v.video_id, `${s.views ?? '?'}/${s.likes ?? '?'}/${s.comments ?? '?'}`,
      v.is_short ? 'S' : '-', v.transcript?.status === 'ok' ? 'T' : '-', short(v.title, 100),
      short(v.description, 160), top ? short(top.text, 120) + ` (${top.likes})` : ''].join(' | '));
  }
  if (vids.length > limit) console.log(`… i ${vids.length - limit} więcej (zwiększ limit, jeśli brakuje tematów)`);
  const streams = run.streams || [];
  if (streams.length) {
    console.log(`\nSTREAMY (${streams.length})`);
    for (const st of streams) console.log([st.creator, st.platform, st.live ? 'LIVE' : 'off', st.viewers ?? '', short(st.game, 40), short(st.title, 100)].join(' | '));
  }
}
function video(file, id) {
  const v = (readRun(file).videos || []).find(x => x.video_id === id);
  if (!v) die('nie ma filmu ' + id);
  const t = v.transcript;
  if (t?.text && t.text.length > 12000) t.text = t.text.slice(0, 12000) + ' …[ucięto]';
  console.log(JSON.stringify(v, null, 1));
}

// ---------- add ----------
function validate(n, where, date) {
  const err = [];
  for (const k of ['region', 'published', 'who', 'initials', 'category', 'hype', 'title', 'summary', 'body', 'sources'])
    if (n[k] === undefined || n[k] === '' ) err.push(`brak pola ${k}`);
  if (n.region && !['pl', 'world'].includes(n.region)) err.push('region musi być pl albo world');
  if (n.hype && !(n.hype >= 1 && n.hype <= 5)) err.push('hype 1–5');
  if (n.body && (!Array.isArray(n.body) || n.body.length < 2)) err.push('body = tablica akapitów (3–5)');
  if (n.published && !/^\d{4}-\d{2}-\d{2}$/.test(n.published)) err.push('published w formacie RRRR-MM-DD');
  if (n.published && n.published > date) err.push('published późniejsze niż data wydania');
  if (!Array.isArray(n.sources) || !n.sources.length) err.push('sources nie może być puste');
  else n.sources.forEach((s, i) => { if (!/^https?:\/\//.test(s.url || '')) err.push(`sources[${i}].url niepoprawny`); });
  if (n.image) {
    if (!['kadr', 'prasowe'].includes(n.image.kind)) err.push('image.kind tylko kadr albo prasowe (bez ilustracji)');
    for (const k of ['src', 'credit', 'href', 'alt', 'caption']) if (!n.image[k]) err.push(`image.${k} wymagane`);
  }
  if ((n.image || n.embed) && !n.caption) err.push('brak caption przy materiale');
  // zdjęcie jest priorytetem: film z YouTube w źródłach = obowiązkowy kadr, chyba że podano powód w noImage
  const ytId = [n.embed, ...(n.sources || []).map(x => x.url)].filter(Boolean)
    .map(u => (u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) || [])[1]).find(Boolean);
  if (!n.image && !n.noImage) err.push(ytId
    ? `brak image: dodaj kadr z filmu ${ytId} (i.ytimg.com/vi/${ytId}/maxresdefault.jpg) albo pole noImage z powodem`
    : 'brak image: znajdź film/post twórcy lub zdjęcie prasowe; jeśli nie ma legalnego, dodaj embed i pole noImage z powodem');
  return err.map(e => `${where} „${short(n.title, 50)}”: ${e}`);
}
function add(file, build = true) {
  if (!file || !fs.existsSync(file)) die('podaj plik JSON z nowymi newsami');
  const inc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { date, slot = '7:00' } = inc;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) die('pole date w formacie RRRR-MM-DD');
  if (!['7:00', '15:00'].includes(slot)) die('slot to 7:00 albo 15:00');
  const ed = load();

  const known = new Map();
  for (const { date: d, n } of items(ed)) {
    known.set('t:' + slugify(n.title), `${d} „${short(n.title, 60)}”`);
    for (const u of urlsOf(n).filter(u => /youtube\.com\/watch|\/status\/|\/p\/|\/reel\/|\/video\//.test(u)))
      known.set('u:' + u, `${d} „${short(n.title, 60)}”`);
  }
  const errors = [], dupes = [];
  let worldToday = ed[date] ? SECTIONS.flatMap(s => ed[date][s] || []).filter(n => n.region === 'world').length : 0;
  for (const s of NEW_SECTIONS) for (const n of inc[s] || []) {
    errors.push(...validate(n, s, date));
    const hit = known.get('t:' + slugify(n.title)) || urlsOf(n).map(u => known.get('u:' + u)).find(Boolean);
    if (hit) dupes.push(`„${short(n.title, 60)}” powtarza ${hit}`);
    if (n.region === 'world') worldToday++;
  }
  for (const k of Object.keys(inc)) if (!['date', 'slot', ...NEW_SECTIONS].includes(k)) errors.push(`nieznany klucz ${k}`);
  if (dupes.length) errors.push(...dupes.map(d => 'duplikat: ' + d));
  if (worldToday > 3) errors.push(`zagranica: ${worldToday} newsów tego dnia (maks. 3)`);
  if (errors.length) die('\n- ' + errors.join('\n- '));

  const count = NEW_SECTIONS.reduce((a, s) => a + (inc[s] || []).length, 0);
  if (!count) die('brak newsów do dopisania');
  if (!ed[date]) {
    const fresh = { date, ryby: [], luz: [], czapy: [] };
    for (const s of NEW_SECTIONS) fresh[s] = (inc[s] || []).map(n => ({ ...n, slot }));
    const next = { [date]: fresh };
    for (const k of Object.keys(ed)) next[k] = ed[k];
    save(next);
  } else {
    for (const s of NEW_SECTIONS) {
      const add = (inc[s] || []).map(n => ({ ...n, slot }));
      if (!add.length) continue;
      ed[date][s] = slot === '15:00' ? [...add, ...(ed[date][s] || [])] : [...(ed[date][s] || []), ...add];
    }
    save(ed);
  }
  load(); // ponowna walidacja zapisanego pliku
  console.log(`OK: dopisano ${count} newsów do wydania ${date} (${slot}).`);
  if (build) execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { stdio: 'inherit' });
}

function remove(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) die('użycie: remove RRRR-MM-DD');
  const ed = load();
  if (!ed[date]) die(`Brak wydania ${date}, nic do usunięcia.`);
  const n = Object.values(ed[date]).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
  delete ed[date];
  save(ed);
  console.log(`OK: usunięto wydanie ${date} (${n} newsów).`);
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { stdio: 'inherit' });
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'recent') recent(Number(a) || 7);
else if (cmd === 'digest') digest(a, Number(b) || 40);
else if (cmd === 'video') video(a, b);
else if (cmd === 'add') add(a, !process.argv.includes('--no-build'));
else if (cmd === 'remove') remove(a);
else die('użycie: recent | digest <run.json> | video <run.json> <id> | add <nowe.json> | remove <data>');
