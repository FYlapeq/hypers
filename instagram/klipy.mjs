// Posty z klipami GTA 6 na Instagram (prośba Filipa 18.11.2026): karuzela = 2 klipy wideo (Twitch, Kick) + slajd „Daj follow”.
// Uruchamiane przez .github/workflows/instagram-klipy.yml co godzinę (zaplanowane zadanie Claude, workflow_dispatch).
//
// Skąd klipy, w tej kolejności:
//   1. instagram/klipy-reczne.json: linki do klipów, które Filip zrobił sam (Twitch albo Kick), najstarsze pierwsze.
//   2. Twitch Helix API (oficjalne, token aplikacji z TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET): najpopularniejsze klipy
//      z kategorii Grand Theft Auto VI z ostatnich KLIPY_GODZIN godzin, najpierw po polsku, potem po angielsku, potem reszta.
// Filtr bezpieczeństwa (zasady IG): filtr obrazu NudeNet (instagram/nagosc.py) na każdym klipie, klip do 60 s, bez słów z KLIPY_STOP w tytule (nagość, wulgaryzmy, wyzwiska),
// bez ocenzurowanych przekleństw (***), każdy streamer najwyżej raz na post i nie w dwóch postach z rzędu.
// Wideo: kadr 1080x1350 (4:5 jak karty Hypers), rozmyte tło z tego samego klipu, klip na środku, u góry nazwa streamera,
// na dole skąd klip. Pliki idą na gałąź instagram-klipy (orphan, nadpisywana), Instagram pobiera je z raw.githubusercontent.com.
//
// Zmienne: IG_TOKEN, IG_USER_ID, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, STAN_DIR (checkout gałęzi instagram-klipy),
//          DRY_RUN=1 (tylko pliki, bez publikacji), KLIPY_GODZIN (domyślnie 6), KLIPY_MIN_WYSWIETLEN (domyślnie 300).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const DRY = env.DRY_RUN === '1';
const STAN_DIR = resolve(env.STAN_DIR || join(ROOT, 'klipy-stan'));
const STAN_PLIK = join(STAN_DIR, 'klipy.json');
const REPO = env.GITHUB_REPOSITORY || 'FYlapeq/hypers';
const IG_API = 'https://graph.instagram.com/v25.0';
const GRA = 'Grand Theft Auto VI';
const GODZIN = Number(env.KLIPY_GODZIN || 6);
const MIN_WYSW = Number(env.KLIPY_MIN_WYSWIETLEN || 300);
const NA_POST = 2;
const TMP = join(tmpdir(), 'hypers-klipy');
const MAKS_S = 59;
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Słowa, przez które klip nie idzie na IG (nagość, seks, wyzwiska). Sprawdzane w tytule i nazwie kanału.
export const KLIPY_STOP = /strip|стрип|naked|nude|nudes|nsfw|boob|tits|titt|сис|голая|секс|\bsex|porn|порн|18\+|hooters|onlyfans|nigg|negr|faggot|pedał|cwel|retard|kurw|chuj|huj|pizd|jeb|fuck|shit|сук|бля|хуй|пизд|ебат|жоп/i;
// Automatycznie bierzemy tylko klipy z tytułem w alfabecie łacińskim: filtr słów nie działa na tytułach, których nie umiemy sprawdzić.
export const bezpieczny = (k) => !KLIPY_STOP.test(`${k.tytul} ${k.kanal}`) && !/\*{2,}/.test(k.tytul) && (k.czas ?? 0) <= 60 && !!tytulDoOpisu(k.tytul);
// Tytuł klipu (napisany przez widza) wstawiamy do opisu tylko, gdy jest krótki i w alfabecie łacińskim.
export const tytulDoOpisu = (t) => (t && t.length <= 80 && /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{Emoji_Presentation}]+$/u.test(t) ? t : null);

// ---------- stan ----------
function wczytajStan() {
  return existsSync(STAN_PLIK) ? JSON.parse(readFileSync(STAN_PLIK, 'utf8')) : { opublikowane: {}, posty: [] };
}
const git = (...a) => execFileSync('git', ['-C', STAN_DIR, ...a], { encoding: 'utf8' }).trim();
function commitStanu(stan, wiadomosc) {
  writeFileSync(STAN_PLIK, JSON.stringify(stan, null, 1) + '\n');
  if (DRY) {
    // Próba: pliki na osobną gałąź podglądu (nadpisywana), stan bez zmian.
    git('add', '-A');
    if (git('status', '--porcelain') !== '') git('commit', '-q', '-m', wiadomosc);
    git('push', '-q', '--force', 'origin', 'HEAD:instagram-klipy-podglad');
    return null;
  }
  git('add', '-A');
  if (git('status', '--porcelain') !== '') git('commit', '-q', '-m', wiadomosc);
  git('push', '-q', '--force', 'origin', 'HEAD:instagram-klipy');
  return git('rev-parse', 'HEAD');
}

// ---------- źródła klipów ----------
export function klipRecznie(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  let m;
  if (host === 'clips.twitch.tv') return { klucz: `twitch:${u.pathname.slice(1)}`, url, platforma: 'Twitch', kanal: null };
  if (host.endsWith('twitch.tv') && (m = u.pathname.match(/^\/([^/]+)\/clip\/([^/?]+)/)))
    return { klucz: `twitch:${m[2]}`, url, platforma: 'Twitch', kanal: m[1], login: m[1] };
  if (host === 'kick.com' && (m = u.pathname.match(/^\/([^/]+)\/clips\/([^/?]+)/)))
    return { klucz: `kick:${m[2]}`, url, platforma: 'Kick', kanal: m[1], login: m[1] };
  if (host === 'kick.com' && (m = u.pathname.match(/^\/([^/]+)\/?$/)) && u.searchParams.get('clip'))
    return { klucz: `kick:${u.searchParams.get('clip')}`, url, platforma: 'Kick', kanal: m[1], login: m[1] };
  throw new Error(`Nieznany link do klipu: ${url}`);
}

function reczne() {
  const plik = join(ROOT, 'instagram/klipy-reczne.json');
  if (!existsSync(plik)) return [];
  const lista = JSON.parse(readFileSync(plik, 'utf8'));
  return lista.flatMap((x) => {
    const o = typeof x === 'string' ? { url: x } : x;
    try { return [{ ...klipRecznie(o.url), tytul: o.opis ?? '', reczny: true, opis: o.opis ?? null, czas: 0, ...(o.kto && { kanal: o.kto }) }]; }
    catch (e) { log(`– ${e.message}`); return []; }
  });
}

async function twitch(sciezka, token) {
  const r = await fetch(`https://api.twitch.tv/helix/${sciezka}`, {
    headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Twitch ${sciezka.split('?')[0]}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function zTwitcha() {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) { log('Brak sekretów TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET: tylko klipy ręczne.'); return []; }
  const t = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST', body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' }),
  }).then((r) => r.json());
  if (!t.access_token) throw new Error(`Twitch token: ${JSON.stringify(t)}`);
  const { data: [gra] = [] } = await twitch(`games?name=${encodeURIComponent(GRA)}`, t.access_token);
  if (!gra) throw new Error(`Twitch: nie ma kategorii ${GRA}`);
  const od = new Date(Date.now() - GODZIN * 3600_000).toISOString();
  const { data = [] } = await twitch(`clips?game_id=${gra.id}&started_at=${od}&ended_at=${new Date().toISOString()}&first=100`, t.access_token);
  const ids = [...new Set(data.map((c) => c.broadcaster_id))];
  const loginy = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const { data: u = [] } = await twitch(`users?${ids.slice(i, i + 100).map((id) => `id=${id}`).join('&')}`, t.access_token);
    for (const x of u) loginy.set(x.id, x.login);
  }
  return data.map((c) => ({
    klucz: `twitch:${c.id}`, url: c.url, platforma: 'Twitch', kanal: c.broadcaster_name, login: loginy.get(c.broadcaster_id) ?? c.broadcaster_name.toLowerCase(),
    tytul: c.title, miniatura: c.thumbnail_url, wyswietlenia: c.view_count, czas: c.duration, jezyk: c.language, utworzono: c.created_at,
  }));
}

const PRIORYTET_JEZYKA = (j) => (j === 'pl' ? 0 : j === 'en' ? 1 : 2);
// Ile razy klip już poszedł na IG. Było 4 (18.11.2026); od 23.11.2026 każdy klip najwyżej raz: ten sam film wrzucany
// kilka razy to dla Instagrama spam i treść nieoryginalna, a 20.11 konto dostało dobę bez zasięgu.
export const MAKS_RAZY = 1;
// Od 23.11.2026 domyślnie same rolki, bez karuzel z klipami (karuzele miały 0 reakcji, rolki ~180 wyświetleń).
// Powrót do karuzel: zmienna repo KLIPY_KARUZELA = 1.
const BEZ_KARUZELI = env.KLIPY_BEZ_KARUZELI === '1';
export const razy = (st) => st?.razy ?? (st?.media_id ? 1 : 0);
export function wybierz(kandydaci, stan, ile = NA_POST) {
  const ostatniPost = (stan.posty ?? []).at(-1);
  // Starsze wpisy nie mają `klucze`: wtedy klipy ostatniego posta szukamy po media_id.
  const zOstatniego = new Set(ostatniPost?.klucze ?? Object.entries(stan.opublikowane).filter(([, v]) => ostatniPost && v.media_id === ostatniPost.media_id).map(([k]) => k));
  const wolne = kandydaci.filter((k) => {
    const st = stan.opublikowane[k.klucz];
    if (st?.pominiete || razy(st) >= MAKS_RAZY || zOstatniego.has(k.klucz)) return false;
    if (BEZ_KARUZELI && stan.rolki?.[k.klucz]) return false;
    return k.reczny || (bezpieczny(k) && (k.wyswietlenia ?? 0) >= MIN_WYSW);
  });
  const posort = [...wolne.filter((k) => k.reczny), ...wolne.filter((k) => !k.reczny)
    .sort((a, b) => b.wyswietlenia - a.wyswietlenia || PRIORYTET_JEZYKA(a.jezyk) - PRIORYTET_JEZYKA(b.jezyk))];
  const out = [];
  for (const k of posort) {
    const kto = (k.login ?? k.kanal ?? '').toLowerCase();
    if (!k.reczny && out.some((x) => (x.login ?? x.kanal ?? '').toLowerCase() === kto)) continue;
    out.push(k);
    if (out.length === ile) break;
  }
  return out;
}

// ---------- nagłówki ----------
// Nagłówek slajdu przed klipem pisze zaplanowane zadanie Claude (input `naglowki` workflow = JSON {klucz: tekst}) na
// podstawie kandydaci.json z poprzedniego przebiegu. Zapamiętujemy go w stanie, żeby powtórki miały ten sam napis.
export function naglowek(k, stan) {
  const n = stan.naglowki?.[k.klucz];
  if (n) return n;
  return `${k.kanal ?? k.login} w GTA 6`;
}
function wczytajNaglowki(stan) {
  try {
    const n = JSON.parse(env.KLIPY_NAGLOWKI || '{}');
    for (const [klucz, tekst] of Object.entries(n)) if (typeof tekst === 'string' && tekst.trim()) (stan.naglowki ??= {})[klucz] = tekst.trim().slice(0, 90);
  } catch (e) { log(`– nagłówki z inputu nieczytelne: ${e.message}`); }
}

// Miniatury (pierwsza klatka klipu z Twitcha) dla 8 najpopularniejszych bez nagłówka: zadanie Claude ogląda je,
// żeby nagłówek miał hook, a nie tylko suchy tytuł. Pliki kandydaci/<klucz>.jpg na gałęzi instagram-klipy.
async function miniaturyDlaNaglowkow(kandydaci, stan) {
  const lista = JSON.parse(readFileSync(join(STAN_DIR, 'kandydaci.json'), 'utf8'));
  mkdirSync(join(STAN_DIR, 'kandydaci'), { recursive: true });
  let n = 0;
  for (const x of lista) {
    if (n >= 8 || x.naglowek) continue;
    const src = kandydaci.find((k) => k.klucz === x.klucz)?.miniatura;
    if (!src) continue;
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const plik = `kandydaci/${x.klucz.replace(/[^a-z0-9_-]/gi, '_')}.jpg`;
      writeFileSync(join(STAN_DIR, plik), Buffer.from(await r.arrayBuffer()));
      x.miniatura = plik; n++;
    } catch { /* bez miniatury */ }
  }
  writeFileSync(join(STAN_DIR, 'kandydaci.json'), JSON.stringify(lista, null, 1) + '\n');
}

// ---------- wideo ----------
const b64 = (p) => readFileSync(join(ROOT, p)).toString('base64');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const FONTY = () => `@font-face{font-family:Anton;src:url(data:font/woff2;base64,${b64('fonts/anton-latin.woff2')}) format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:Anton;src:url(data:font/woff2;base64,${b64('fonts/anton-latin-ext.woff2')}) format('woff2');unicode-range:U+0100-024F}
@font-face{font-family:WS;src:url(data:font/woff2;base64,${b64('fonts/worksans-latin.woff2')}) format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:WS;src:url(data:font/woff2;base64,${b64('fonts/worksans-latin-ext.woff2')}) format('woff2');unicode-range:U+0100-024F}`;
function htmlNakladki(k, nr, ile) {
  const fonty = FONTY();
  const zrodlo = k.login ? `${k.platforma.toLowerCase()}.${k.platforma === 'Twitch' ? 'tv' : 'com'}/${k.login}` : k.platforma;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonty}
html,body{margin:0;width:1080px;height:1350px;background:transparent;color:#fff;font-family:WS,sans-serif}
.g{position:absolute;left:64px;right:64px;top:70px}.e{display:inline-block;background:#0a84ff;color:#fff;font:600 30px WS;padding:10px 20px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
.n{font:400 96px/1.05 Anton;margin-top:26px;text-shadow:0 4px 24px rgba(0,0,0,.6);text-transform:uppercase;word-break:break-word}
.d{position:absolute;left:64px;right:64px;bottom:70px;display:flex;justify-content:space-between;align-items:flex-end;font:500 32px WS;text-shadow:0 2px 12px rgba(0,0,0,.7)}
.d b{font-weight:700}.nr{opacity:.85}</style></head><body>
<div class="g"><span class="e">GTA 6 · ${esc(k.platforma)}</span><div class="n">${esc(k.kanal ?? k.login ?? 'Klip')}</div></div>
<div class="d"><span>Klip: <b>${esc(zrodlo)}</b><br>@hypers.tech</span></div></body></html>`;
}

function htmlNaglowka(tekst, k) {
  const fonty = FONTY();
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonty}
html,body{margin:0;width:1080px;height:1350px;background:transparent;color:#fff;font-family:WS,sans-serif}
.w{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 80px}
.e{align-self:flex-start;background:#0a84ff;font:600 32px WS;padding:12px 24px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
.t{font:400 104px/1.04 Anton;margin-top:34px;text-transform:uppercase;text-shadow:0 6px 30px rgba(0,0,0,.7)}
.s{font:600 34px WS;margin-top:36px;opacity:.9}.f{position:absolute;left:80px;bottom:70px;font:500 32px WS;opacity:.85}</style></head><body>
<div class="w"><span class="e">GTA 6 · ${esc(k.platforma)}</span><div class="t">${esc(tekst)}</div><div class="s">Przesuń ➡️</div></div><div class="f">@hypers.tech</div></body></html>`;
}

// Rolka 9:16: nagłówek POD klipem (prośba Filipa 18.11.2026), u góry etykieta, na dole @hypers.tech.
function htmlRolki(k, tekst) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTY()}
html,body{margin:0;width:1080px;height:1920px;background:transparent;color:#fff;font-family:WS,sans-serif}
.e{position:absolute;left:70px;top:420px;background:#0a84ff;font:600 34px WS;padding:12px 26px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
.t{position:absolute;left:70px;right:70px;top:1250px;font:400 92px/1.05 Anton;text-transform:uppercase;text-shadow:0 6px 30px rgba(0,0,0,.7)}
.f{position:absolute;left:70px;top:1640px;font:600 36px WS;opacity:.9}</style></head><body>
<span class="e">GTA 6 · ${esc(k.platforma)} · ${esc(k.kanal ?? k.login)}</span><div class="t">${esc(tekst)}</div><div class="f">@hypers.tech · codziennie nowe klipy</div></body></html>`;
}
async function nakladkaRolki(k, tekst, plik) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(htmlRolki(k, tekst), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: plik, omitBackground: true });
  await b.close();
}

async function nakladki(lista, dir, stan) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const [i, k] of lista.entries()) {
    await p.setContent(htmlNakladki(k, i + 1, lista.length), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: join(dir, `nakladka-${i + 1}.png`), omitBackground: true });
    await p.setContent(htmlNaglowka(naglowek(k, stan), k), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: join(dir, `naglowek-${i + 1}.png`), omitBackground: true });
  }
  await b.close();
}

function pobierz(k, plik) {
  execFileSync('yt-dlp', ['-q', '--no-warnings', '--no-playlist', ...(env.FFMPEG ? ['--ffmpeg-location', env.FFMPEG] : []), '-f', 'best[ext=mp4]/best', '-o', plik, k.url], { stdio: 'inherit', timeout: 180_000 });
}
export function sprawdzObraz(plik) {
  try {
    execFileSync(env.NUDENET_PY || 'python3', [join(ROOT, 'instagram/nagosc.py'), plik], { encoding: 'utf8', timeout: 240_000, stdio: ['ignore', 'pipe', 'ignore'] });
    return null;
  } catch (e) { return (e.stdout || e.message || 'błąd').toString().trim().split('\n').pop().slice(0, 150); }
}
function czasTrwania(plik) {
  return Number(execFileSync(env.FFPROBE || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', plik], { encoding: 'utf8' }).trim()) || 0;
}
// Slajd z napisem: 4 s rozmytego klipu w tle + nagłówek, bez dźwięku (cisza, żeby IG miał ścieżkę audio).
function slajdNaglowka(wej, nakladka, wyj) {
  const filtr = '[0:v]fps=30,scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,boxblur=40:6,eq=brightness=-0.42[tlo];[tlo][1:v]overlay=0:0,format=yuv420p[v]';
  execFileSync(env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', wej, '-i', nakladka, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', filtr, '-map', '[v]', '-map', '2:a', '-t', '4', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', wyj], { stdio: 'inherit', timeout: 120_000 });
}
// Slajd „Daj follow” jako 4-sekundowe wideo z karty JPEG (Filip: w postach z klipami tylko wideo).
function slajdObrazu(jpg, wyj) {
  execFileSync(env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', jpg, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-vf', 'fps=30,scale=1080:1350,format=yuv420p', '-t', '4', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', wyj], { stdio: 'inherit', timeout: 120_000 });
}
function zmontujRolke(wej, nakladka, wyj) {
  const filtr = '[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:5,eq=brightness=-0.35[tlo];'
    + '[0:v]fps=30,scale=1080:-2[klip];[tlo][klip]overlay=0:540[v1];[v1][1:v]overlay=0:0,format=yuv420p[v]';
  execFileSync(env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', wej, '-i', nakladka, '-filter_complex', filtr, '-map', '[v]', '-map', '0:a?',
    '-t', String(MAKS_S), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'high', '-level', '4.1',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', wyj], { stdio: 'inherit', timeout: 300_000 });
}
export function opisRolki(k, tekst) {
  return [tekst, `Klip: ${k.kanal ?? k.login} (${k.platforma}) ${k.url}`, 'Codziennie najlepsze klipy z GTA 6. Daj follow @hypers.tech 🎮',
    '#gta6 #gtavi #grandtheftauto6 #twitch #streamer #reels #hypers'].join('\n\n');
}
function zmontuj(wej, nakladka, wyj) {
  const filtr = '[0:v]fps=30,scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,boxblur=30:5,eq=brightness=-0.28[tlo];'
    + '[0:v]fps=30,scale=1080:-2[klip];[tlo][klip]overlay=(W-w)/2:(H-h)/2[v1];[v1][1:v]overlay=0:0,format=yuv420p[v]';
  execFileSync(env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', wej, '-i', nakladka, '-filter_complex', filtr, '-map', '[v]', '-map', '0:a?',
    '-t', String(MAKS_S), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'high', '-level', '4.1',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', wyj], { stdio: 'inherit', timeout: 300_000 });
}

// ---------- opis ----------
function kontaIG() {
  try { return JSON.parse(readFileSync(join(ROOT, 'instagram/konta.json'), 'utf8')); } catch { return {}; }
}
export function opisPosta(lista, konta = kontaIG()) {
  const klucz = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const mapa = new Map(Object.entries(konta).map(([k, v]) => [klucz(k), v]));
  const pozycje = lista.map((k, i) => {
    const ig = mapa.get(klucz(k.kanal)) ?? mapa.get(klucz(k.login));
    const kto = `${k.kanal ?? k.login}${ig ? ` @${ig}` : ''}`;
    return `${i + 1}. ${k._naglowek ?? kto} (${kto}, ${k.platforma})`;
  });
  return [
    'GTA 6 na streamach: najgorętsze klipy 🎮 Przewiń ➡️',
    pozycje.join('\n'),
    `Klipy: ${lista.map((k) => k.url).join(' , ')}`,
    'Codziennie klipy i newsy. Daj follow @hypers.tech, żeby nic Ci nie uciekło.',
    '#gta6 #gtavi #grandtheftauto6 #twitch #kick #streamer #hypers',
  ].join('\n\n');
}

// ---------- Instagram ----------
async function ig(sciezka, { method = 'GET', params = {} } = {}) {
  const url = new URL(`${IG_API}/${sciezka}`);
  const o = { method, headers: { Authorization: `Bearer ${env.IG_TOKEN}` } };
  if (method === 'GET') for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else o.body = new URLSearchParams(params);
  const r = await fetch(url, o);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram API ${sciezka}: ${r.status} ${j.error?.message ?? JSON.stringify(j)}`);
  return j;
}
async function czekaj(id, s = 300) {
  for (let i = 0; i < s / 10; i++) {
    const { status_code, status } = await ig(id, { params: { fields: 'status_code,status' } });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Kontener ${id}: ${status_code} ${status ?? ''}`);
    await sleep(10_000);
  }
  throw new Error(`Kontener ${id}: Instagram nie przetworzył pliku w ${s} s`);
}
// Post z tymi klipami opublikowany w TYM przebiegu (Meta potrafi zwrócić błąd, a post i tak wychodzi). Powtórki klipów są dozwolone.
// Gotowe rolki do ręcznego wrzucenia na YouTube Shorts (prośba Filipa 18.11.2026): GitHub Releases, jedno wydanie
// na dzień („Rolki RRRR-MM-DD”), w nim .mp4 i .txt z tytułem i opisem. Wydania starsze niż 7 dni są usuwane.
async function gh(sciezka, { method = 'GET', body, host = 'api.github.com', typ } = {}) {
  const r = await fetch(`https://${host}/repos/${REPO}/${sciezka}`, {
    method, body, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', ...(typ && { 'Content-Type': typ }) },
  });
  if (r.status === 404 && method === 'GET') return null;
  if (!r.ok) throw new Error(`GitHub ${method} ${sciezka.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? {} : r.json();
}
async function rolkaDoFolderu(k, tekst, plikMp4) {
  if (!env.GH_TOKEN) return log('– brak GH_TOKEN, rolka nie trafi do Releases');
  const dzien = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  const godz = new Date().toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' }).replace(':', '');
  const tag = `rolki-${dzien}`;
  let rel = await gh(`releases/tags/${tag}`);
  rel ??= await gh('releases', { method: 'POST', typ: 'application/json', body: JSON.stringify({
    tag_name: tag, target_commitish: 'main', name: `Rolki ${dzien}`, prerelease: true,
    body: 'Gotowe rolki z klipami GTA 6 do wrzucenia na YouTube Shorts. Do każdego .mp4 jest .txt z tytułem i opisem.' }) });
  const nazwa = `${godz}-${(k.login ?? k.kanal ?? 'klip').replace(/[^a-z0-9_-]/gi, '')}`;
  const opisYT = [`TYTUŁ: ${tekst} #shorts`, '', 'OPIS:', tekst, '', `Klip: ${k.kanal ?? k.login} (${k.platforma}) ${k.url}`, 'Więcej klipów z GTA 6: instagram.com/hypers.tech', '', '#gta6 #gtavi #shorts'].join('\n');
  const up = (n, body, typ) => gh(`releases/${rel.id}/assets?name=${encodeURIComponent(n)}`, { method: 'POST', host: 'uploads.github.com', body, typ });
  await up(`${nazwa}.mp4`, readFileSync(plikMp4), 'video/mp4');
  await up(`${nazwa}.txt`, Buffer.from(opisYT + '\n'), 'text/plain; charset=utf-8');
  log(`Rolka w Releases: ${rel.html_url}`);
  // Sprzątanie: wydania rolki-* starsze niż 7 dni.
  const granica = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  for (const r of (await gh('releases?per_page=50')) ?? []) {
    const d = r.tag_name.match(/^rolki-(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (d && d < granica) { await gh(`releases/${r.id}`, { method: 'DELETE' }); await gh(`git/refs/tags/${r.tag_name}`, { method: 'DELETE' }); }
  }
}

async function rolkaJuzJest(url, od) {
  try {
    const { data = [] } = await ig(`${env.IG_USER_ID}/media`, { params: { fields: 'id,caption,timestamp,media_product_type', limit: '20' } });
    return data.find((p) => p.media_product_type === 'REELS' && new Date(p.timestamp) >= new Date(od) && p.caption?.includes(url)) ?? null;
  } catch { return undefined; }
}
async function postyZKlipem(urls, od) {
  try {
    const { data = [] } = await ig(`${env.IG_USER_ID}/media`, { params: { fields: 'id,caption,timestamp,media_product_type', limit: '20' } });
    return data.find((p) => p.media_product_type !== 'REELS' && new Date(p.timestamp) >= new Date(od) && urls.every((u) => p.caption?.includes(u))) ?? null;
  } catch { return undefined; }
}

// Tryb „tylko rolki” (input tylko_rolki = JSON [{url, naglowek}]): rolki z podanych klipów od razu, bez karuzeli.
async function tylkoRolki(lista, stan) {
  const dir = join(STAN_DIR, 'klipy');
  mkdirSync(dir, { recursive: true }); mkdirSync(TMP, { recursive: true });
  stan.rolki ??= {};
  const gotowe = [];
  for (const [i, x] of lista.entries()) {
    const k = { ...klipRecznie(x.url), reczny: true };
    if (stan.rolki[k.klucz]) { log(`– już była rolką: ${k.url}`); continue; }
    const surowy = join(TMP, `r-${i}.mp4`); rmSync(surowy, { force: true });
    pobierz(k, surowy);
    const ocena = sprawdzObraz(surowy);
    if (ocena) { log(`– odrzucony przez filtr obrazu (${ocena}): ${k.url}`); continue; }
    const tekst = (x.naglowek || naglowek(k, stan)).slice(0, 90);
    await nakladkaRolki(k, tekst, join(TMP, `r-${i}.png`));
    zmontujRolke(surowy, join(TMP, `r-${i}.png`), join(dir, `rolka-${i}.mp4`));
    gotowe.push({ k, tekst, plik: `rolka-${i}.mp4` });
  }
  if (DRY || !gotowe.length) { commitStanu(stan, 'Klipy: rolki (podgląd)'); return; }
  const sha = commitStanu(stan, 'Klipy: rolki');
  const raw = (p) => `https://raw.githubusercontent.com/${REPO}/${sha}/klipy/${p}`;
  if (!env.IG_USER_ID) env.IG_USER_ID = (await ig('me', { params: { fields: 'user_id' } })).user_id;
  const start = new Date(Date.now() - 60_000).toISOString();
  for (const { k, tekst, plik } of gotowe) {
    try {
      let rid = (await rolkaJuzJest(k.url, start))?.id;
      if (!rid) {
        const { id: kont } = await ig(`${env.IG_USER_ID}/media`, { method: 'POST', params: { media_type: 'REELS', video_url: raw(plik), caption: opisRolki(k, tekst), share_to_feed: 'true' } });
        await czekaj(kont, 400);
        ({ id: rid } = await ig(`${env.IG_USER_ID}/media_publish`, { method: 'POST', params: { creation_id: kont } }));
      }
      stan.rolki[k.klucz] = { media_id: rid, kiedy: new Date().toISOString() };
      commitStanu(stan, `Klipy: rolka ${rid}`);
      log(`Opublikowano rolkę ${rid}: ${tekst}`);
      await rolkaDoFolderu(k, tekst, join(dir, plik)).catch((e) => log(`– rolka nie trafiła do Releases: ${e.message.slice(0, 200)}`));
    } catch (e) { log(`– rolka nie wyszła (${k.url}): ${e.message.slice(0, 200)}`); process.exitCode = 1; }
  }
}

async function main() {
  const stan = wczytajStan();
  stan.opublikowane ??= {}; stan.posty ??= []; stan.naglowki ??= {};
  wczytajNaglowki(stan);
  if (env.KLIPY_TYLKO_ROLKI) return tylkoRolki(JSON.parse(env.KLIPY_TYLKO_ROLKI), stan);
  const start = new Date(Date.now() - 60_000).toISOString();
  const kandydaci = [...reczne(), ...(await zTwitcha())];
  log(`Kandydaci: ${kandydaci.length}`);
  // Lista dla zaplanowanego zadania, które pisze nagłówki na kolejny przebieg (najpopularniejsze bez nagłówka).
  writeFileSync(join(STAN_DIR, 'kandydaci.json'), JSON.stringify(wybierz(kandydaci, stan, 30)
    .map(({ klucz, kanal, login, platforma, tytul, wyswietlenia, jezyk, url }) => ({ klucz, kanal, login, platforma, tytul, wyswietlenia, jezyk, url,
      razy: razy(stan.opublikowane[klucz]), naglowek: stan.naglowki[klucz] ?? null })), null, 1) + '\n');
  await miniaturyDlaNaglowkow(kandydaci, stan);
  const dir = join(STAN_DIR, 'klipy');
  mkdirSync(dir, { recursive: true });
  mkdirSync(TMP, { recursive: true });

  // Pobieramy po kolei; klip, którego nie da się pobrać albo jest za długi, odpada i bierzemy następny.
  stan.rolki ??= {};
  const ILE = BEZ_KARUZELI ? 1 : NA_POST;
  const gotowe = [];
  let lista = wybierz(kandydaci, stan, kandydaci.length);
  for (const k of lista) {
    if (gotowe.length === ILE) break;
    if (gotowe.some((x) => !k.reczny && (x.login ?? x.kanal) === (k.login ?? k.kanal))) continue;
    const surowy = join(TMP, `surowy-${k.klucz.replace(/[^a-z0-9_-]/gi, '_')}.mp4`);
    rmSync(surowy, { force: true });
    try {
      pobierz(k, surowy);
      const s = czasTrwania(surowy);
      if (!k.reczny && s > 61) { log(`– za długi (${s} s): ${k.url}`); continue; }
      // Filtr obrazu (NudeNet, instagram/nagosc.py): każdy klip, także ręczny. Błąd sprawdzenia = klip odpada.
      const ocena = sprawdzObraz(surowy);
      if (ocena) { log(`– odrzucony przez filtr obrazu (${ocena}): ${k.url}`); stan.opublikowane[k.klucz] = { ...stan.opublikowane[k.klucz], pominiete: `filtr obrazu: ${ocena}`.slice(0, 200) }; continue; }
      gotowe.push({ ...k, surowy, _naglowek: naglowek(k, stan) });
      log(`✓ ${k.kanal ?? k.login} (${k.platforma}) ${k.url} [${k.wyswietlenia ?? 'ręczny'} wyśw.] „${k.tytul}”`);
    } catch (e) { log(`– nie udało się pobrać ${k.url}: ${e.message.slice(0, 200)}`); stan.opublikowane[k.klucz] = { pominiete: 'pobieranie' }; }
  }
  if (gotowe.length < ILE) { log(`Za mało klipów (${gotowe.length}/${ILE}), post czeka na kolejne uruchomienie.`); commitStanu(stan, 'Klipy: brak posta'); return; }
  if (BEZ_KARUZELI) return samaRolka(gotowe[0], stan, dir, start);

  await nakladki(gotowe, TMP, stan);
  gotowe.forEach((k, i) => {
    slajdNaglowka(k.surowy, join(TMP, `naglowek-${i + 1}.png`), join(dir, `${i + 1}a-napis.mp4`));
    zmontuj(k.surowy, join(TMP, `nakladka-${i + 1}.png`), join(dir, `${i + 1}b-klip.mp4`));
  });
  const { renderuj } = await import('./karta.mjs');
  const { harmonogram } = await import('./slot.mjs');
  await renderuj([{ follow: true, godziny: harmonogram().godziny, tekst: 'Codziennie klipy i newsy', plik: join(TMP, 'follow.jpg') }]);
  slajdObrazu(join(TMP, 'follow.jpg'), join(dir, 'zz-follow.mp4'));
  // Rolka (KLIPY_ROLKA=1, co drugi przebieg): pierwszy klip tego posta, który nie był jeszcze rolką.
  stan.rolki ??= {};
  const rolka = env.KLIPY_ROLKA === '1' ? gotowe.find((k) => !stan.rolki[k.klucz]) : null;
  if (rolka) {
    await nakladkaRolki(rolka, rolka._naglowek, join(TMP, 'rolka.png'));
    zmontujRolke(rolka.surowy, join(TMP, 'rolka.png'), join(dir, 'rolka.mp4'));
    writeFileSync(join(dir, 'opis-rolki.txt'), opisRolki(rolka, rolka._naglowek) + '\n');
  }
  const opis = opisPosta(gotowe);
  writeFileSync(join(dir, 'opis.txt'), opis + '\n');
  log(`\n${opis}\n`);
  if (DRY) { log('DRY_RUN: bez publikacji.'); commitStanu(stan, 'Klipy: podgląd'); return; }

  // Pliki muszą być w sieci, zanim Instagram je pobierze: commit na gałąź, potem adresy raw z konkretnym SHA.
  const sha = commitStanu(stan, `Klipy: ${gotowe.map((k) => k.kanal ?? k.login).join(', ')}`);
  const raw = (p) => `https://raw.githubusercontent.com/${REPO}/${sha}/klipy/${p}`;
  if (!env.IG_TOKEN) throw new Error('Brak sekretu IG_TOKEN w repo.');
  if (!env.IG_USER_ID) {
    const ja = await ig('me', { params: { fields: 'user_id,username' } });
    env.IG_USER_ID = ja.user_id;
    log(`Konto: @${ja.username} (${ja.user_id})`);
  }
  const juz = await postyZKlipem(gotowe.map((k) => k.url), start);
  if (juz === undefined) throw new Error('Nie udało się sprawdzić profilu IG, nie publikuję (żeby nie zdublować).');
  let id = juz?.id;
  if (!id) {
    try {
      const dzieci = [];
      // Kolejność slajdów: napis 1, klip 1, napis 2, klip 2, follow. Wszystko jako wideo.
      const pliki = [...gotowe.flatMap((_, i) => [`${i + 1}a-napis.mp4`, `${i + 1}b-klip.mp4`]), 'zz-follow.mp4'];
      for (const f of pliki)
        dzieci.push((await ig(`${env.IG_USER_ID}/media`, { method: 'POST', params: { media_type: 'VIDEO', video_url: raw(f), is_carousel_item: 'true' } })).id);
      for (const d of dzieci) await czekaj(d);
      const { id: kont } = await ig(`${env.IG_USER_ID}/media`, { method: 'POST', params: { media_type: 'CAROUSEL', children: dzieci.join(','), caption: opis } });
      await czekaj(kont, 120);
      ({ id } = await ig(`${env.IG_USER_ID}/media_publish`, { method: 'POST', params: { creation_id: kont } }));
    } catch (e) {
      await sleep(20_000);
      const p = await postyZKlipem(gotowe.map((k) => k.url), start);
      if (!p) { commitStanu(stan, 'Klipy: błąd'); throw e; }
      id = p.id; log(`Błąd API (${e.message.slice(0, 150)}), ale post jest na profilu.`);
    }
  }
  const kiedy = new Date().toISOString();
  for (const k of gotowe) stan.opublikowane[k.klucz] = { media_id: id, kiedy, url: k.url, razy: razy(stan.opublikowane[k.klucz]) + 1 };
  stan.posty = [...stan.posty, { media_id: id, kiedy, kanaly: gotowe.map((k) => k.login ?? k.kanal), klucze: gotowe.map((k) => k.klucz) }].slice(-200);
  commitStanu(stan, `Klipy: opublikowano ${id}`);
  log(`Opublikowano post ${id}.`);

  // Rolka po karuzeli; jej błąd nie psuje przebiegu (karuzela już jest).
  if (rolka) {
    try {
      const jest = await rolkaJuzJest(rolka.url, start);
      let rid = jest?.id;
      if (jest === undefined) throw new Error('nie udało się sprawdzić profilu');
      if (!rid) {
        const { id: kont } = await ig(`${env.IG_USER_ID}/media`, { method: 'POST', params: { media_type: 'REELS', video_url: raw('rolka.mp4'), caption: opisRolki(rolka, rolka._naglowek), share_to_feed: 'true' } });
        await czekaj(kont, 400);
        ({ id: rid } = await ig(`${env.IG_USER_ID}/media_publish`, { method: 'POST', params: { creation_id: kont } }));
      }
      stan.rolki[rolka.klucz] = { media_id: rid, kiedy: new Date().toISOString() };
      commitStanu(stan, `Klipy: rolka ${rid}`);
      log(`Opublikowano rolkę ${rid}.`);
      await rolkaDoFolderu(rolka, rolka._naglowek, join(dir, 'rolka.mp4')).catch((e) => log(`– rolka nie trafiła do Releases: ${e.message.slice(0, 200)}`));
    } catch (e) {
      await sleep(20_000);
      const p = await rolkaJuzJest(rolka.url, start).catch(() => null);
      if (p) { stan.rolki[rolka.klucz] = { media_id: p.id, kiedy: p.timestamp }; commitStanu(stan, `Klipy: rolka ${p.id}`); log(`Rolka jest na profilu mimo błędu API.`); }
      else { log(`– rolka nie wyszła: ${e.message.slice(0, 200)}`); process.exitCode = 1; }
    }
  }
}

// Tryb domyślny od 23.11.2026: jedna rolka z najpopularniejszym klipem, który nie był jeszcze na IG, bez karuzeli.
async function samaRolka(k, stan, dir, start) {
  await nakladkaRolki(k, k._naglowek, join(TMP, 'rolka.png'));
  zmontujRolke(k.surowy, join(TMP, 'rolka.png'), join(dir, 'rolka.mp4'));
  writeFileSync(join(dir, 'opis-rolki.txt'), opisRolki(k, k._naglowek) + '\n');
  log(`\n${opisRolki(k, k._naglowek)}\n`);
  if (DRY) { log('DRY_RUN: bez publikacji.'); commitStanu(stan, 'Klipy: podgląd rolki'); return; }
  const sha = commitStanu(stan, `Klipy: rolka ${k.kanal ?? k.login}`);
  const raw = (p) => `https://raw.githubusercontent.com/${REPO}/${sha}/klipy/${p}`;
  if (!env.IG_TOKEN) throw new Error('Brak sekretu IG_TOKEN w repo.');
  if (!env.IG_USER_ID) env.IG_USER_ID = (await ig('me', { params: { fields: 'user_id' } })).user_id;
  const jest = await rolkaJuzJest(k.url, start);
  if (jest === undefined) throw new Error('Nie udało się sprawdzić profilu IG, nie publikuję (żeby nie zdublować).');
  let rid = jest?.id;
  if (!rid) {
    try {
      const { id: kont } = await ig(`${env.IG_USER_ID}/media`, { method: 'POST', params: { media_type: 'REELS', video_url: raw('rolka.mp4'), caption: opisRolki(k, k._naglowek), share_to_feed: 'true' } });
      await czekaj(kont, 400);
      ({ id: rid } = await ig(`${env.IG_USER_ID}/media_publish`, { method: 'POST', params: { creation_id: kont } }));
    } catch (e) {
      await sleep(20_000);
      const p = await rolkaJuzJest(k.url, start).catch(() => null);
      if (!p) { commitStanu(stan, 'Klipy: błąd rolki'); throw e; }
      rid = p.id; log(`Błąd API (${e.message.slice(0, 150)}), ale rolka jest na profilu.`);
    }
  }
  const kiedy = new Date().toISOString();
  stan.rolki[k.klucz] = { media_id: rid, kiedy };
  stan.opublikowane[k.klucz] = { media_id: rid, kiedy, url: k.url, razy: razy(stan.opublikowane[k.klucz]) + 1 };
  stan.posty = [...stan.posty, { media_id: rid, kiedy, kanaly: [k.login ?? k.kanal], klucze: [k.klucz], rolka: true }].slice(-200);
  commitStanu(stan, `Klipy: rolka ${rid}`);
  log(`Opublikowano rolkę ${rid}: ${k._naglowek}`);
  await rolkaDoFolderu(k, k._naglowek, join(dir, 'rolka.mp4')).catch((e) => log(`– rolka nie trafiła do Releases: ${e.message.slice(0, 200)}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
