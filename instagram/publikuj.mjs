// Publikuje nowe newsy Hypers na Instagramie: jedna karta (JPEG 1080x1350) + opis = jeden post.
// Uruchamiane przez .github/workflows/instagram.yml po każdym nowym wydaniu.
//
// Stan i grafiki leżą na osobnej gałęzi `instagram` (katalog STAN_DIR = jej checkout):
//   opublikowane.json  – lista opublikowanych newsów (klucz = ścieżka artykułu, stała po publikacji)
//   karty/*.jpg        – karty bieżącego uruchomienia; Instagram pobiera je z raw.githubusercontent.com
// Gałąź jest za każdym razem tworzona od zera (orphan), więc grafiki nie zostają w historii repo.
//
// Zmienne: IG_TOKEN, IG_USER_ID (sekrety), DRY_RUN=1 (tylko karty + podgląd opisów),
//          IG_WARIANT (domyślnie e), IG_ODSTEP_MIN (przerwa między postami, domyślnie 3), IG_MAKS (domyślnie 20),
//          IG_KADRY=0 (bez miniatur w tle), STAN_DIR (domyślnie ./ig-stan), REPO (owner/repo),
//          IG_TRYB=slot (jeden post wg harmonogram.json; domyślny tryb workflow), IG_TYLKO=<ścieżka> (jeden wskazany news).
// Zasada: post wychodzi WYŁĄCZNIE z prawdziwym kadrem (miniaturą filmu z pola image). Bez kadru news jest pomijany,
// nigdy nie idzie karta zastępcza.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { biezacySlot, harmonogram } from './slot.mjs';

const SEKCJE = ['ryby', 'luz', 'czapy']; // jak w karta.mjs (bez importu, żeby nie ładować Playwrighta bez potrzeby)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://graph.instagram.com/v25.0';
const env = process.env;
const DRY = env.DRY_RUN === '1';
const WARIANT = env.IG_WARIANT || 'e';
const ODSTEP_MS = Number(env.IG_ODSTEP_MIN ?? 3) * 60_000;
const MAKS = Number(env.IG_MAKS ?? 20);
const STAN_DIR = resolve(env.STAN_DIR || join(ROOT, 'ig-stan'));
const REPO = env.REPO || env.GITHUB_REPOSITORY || 'FYlapeq/hypers';
const STAN_PLIK = join(STAN_DIR, 'opublikowane.json');
const LIMIT_OPISU = 2200;

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- dane ----------
function wczytaj() {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'data/editions.js'), 'utf8'), ctx);
  vm.runInNewContext(readFileSync(join(ROOT, 'data/urls.js'), 'utf8'), ctx);
  return { E: ctx.window.HYPERS_EDITIONS, U: ctx.window.HYPERS_URLS };
}

// Wszystkie newsy z obecnych sekcji, w kolejności publikacji na IG:
// od najstarszego wydania; w wydaniu od końca strony, żeby temat dnia był na górze profilu.
export function listaNewsow(E, U) {
  const out = [];
  for (const data of Object.keys(E).sort()) {
    const wyd = [];
    for (const sekcja of SEKCJE) (E[data][sekcja] ?? []).forEach((news, i) => {
      const sciezka = U[data]?.[sekcja]?.[i];
      if (sciezka) wyd.push({ data, sekcja, news, sciezka });
    });
    out.push(...wyd.reverse());
  }
  return out;
}

// ---------- opis posta ----------
const bezOgonkow = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
const hashtag = (s) => '#' + bezOgonkow(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

export function hashtagi(news) {
  const tagi = ['#hypers'];
  for (const osoba of news.who.split(/\s+i\s+|,|&/)) if (osoba.trim()) tagi.push(hashtag(osoba));
  if (news.category) tagi.push(hashtag(news.category));
  tagi.push('#tworcy', '#youtubepl');
  return [...new Set(tagi.filter((t) => t.length > 2))].slice(0, 8).join(' ');
}

export function opis(news, { zKadrem }) {
  const zrodla = [...new Set((news.sources ?? []).map((s) => s.name))].join(', ');
  const stopka = [
    zrodla && `Źródła: ${zrodla}`,
    zKadrem && news.image?.credit && `Kadr: ${news.image.credit}`,
    'Cały artykuł i linki do źródeł: hypers.tech (link w bio)',
    '',
    hashtagi(news),
  ].filter((x) => x !== false && x !== undefined && x !== null).join('\n');
  const glowa = news.title;
  // Treść jak na stronie (body); gdy się nie mieści, ucinamy całe akapity, a w ostateczności dajemy summary.
  const akapity = [...(news.body?.length ? news.body : [news.summary])];
  const sklej = (a) => [glowa, ...a, stopka].join('\n\n');
  while (akapity.length > 1 && sklej(akapity).length > LIMIT_OPISU) akapity.pop();
  let tekst = sklej(akapity);
  if (tekst.length > LIMIT_OPISU) tekst = sklej([news.summary]);
  if (tekst.length > LIMIT_OPISU) tekst = tekst.slice(0, LIMIT_OPISU - 1) + '…';
  return tekst;
}

// ---------- stan na gałęzi instagram ----------
function wczytajStan() {
  if (!existsSync(STAN_PLIK)) return null;
  return JSON.parse(readFileSync(STAN_PLIK, 'utf8'));
}
function zapiszStan(stan) {
  mkdirSync(STAN_DIR, { recursive: true });
  writeFileSync(STAN_PLIK, JSON.stringify(stan, null, 1) + '\n');
}
const git = (...a) => execFileSync('git', ['-C', STAN_DIR, ...a], { encoding: 'utf8' }).trim();
function commitStanu(wiadomosc) {
  if (DRY) return null;
  git('add', '-A');
  if (git('status', '--porcelain') === '') return git('rev-parse', 'HEAD');
  git('commit', '-q', '-m', wiadomosc);
  git('push', '-q', '--force', 'origin', 'HEAD:instagram');
  return git('rev-parse', 'HEAD');
}

// ---------- Instagram API ----------
async function api(sciezka, { method = 'GET', params = {} } = {}) {
  const url = new URL(`${API}/${sciezka}`);
  const opcje = { method, headers: { Authorization: `Bearer ${env.IG_TOKEN}` } };
  if (method === 'GET') for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else opcje.body = new URLSearchParams(params);
  const r = await fetch(url, opcje);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram API ${sciezka}: ${r.status} ${j.error?.message ?? JSON.stringify(j)}`);
  return j;
}

async function opublikuj(imageUrl, caption) {
  const { id: kontener } = await api(`${env.IG_USER_ID}/media`, { method: 'POST', params: { image_url: imageUrl, caption } });
  // Czekamy, aż Instagram przetworzy obraz (zwykle kilka sekund).
  for (let i = 0; i < 30; i++) {
    const { status_code } = await api(kontener, { params: { fields: 'status_code' } });
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Kontener ${kontener}: ${status_code}`);
    await sleep(5000);
  }
  const { id } = await api(`${env.IG_USER_ID}/media_publish`, { method: 'POST', params: { creation_id: kontener } });
  return id;
}

async function wolnyLimit() {
  try {
    const { data } = await api(`${env.IG_USER_ID}/content_publishing_limit`, { params: { fields: 'quota_usage,config' } });
    const d = data?.[0];
    return (d?.config?.quota_total ?? 50) - (d?.quota_usage ?? 0);
  } catch (e) { log('Nie udało się sprawdzić limitu:', e.message); return 50; }
}

// Kandydaci na slot: newsy z dnia slotu i `dni_wstecz` dni wcześniej, bez publikacji na IG
// (oznaczenie „archiwum sprzed startu” się nie liczy). Kolejność: najnowszy dzień, popołudniowa porcja
// przed poranną, potem kolejność ze strony (temat dnia pierwszy).
export function kandydaciSlotu(E, U, stan, dzien) {
  const dni = harmonogram().dni_wstecz ?? 1;
  const daty = Object.keys(E).sort().filter((d) => d <= dzien).slice(-(dni + 1)).reverse();
  const out = [];
  for (const data of daty) {
    const dnia = [];
    for (const sekcja of SEKCJE) (E[data][sekcja] ?? []).forEach((news, i) => {
      const sciezka = U[data]?.[sekcja]?.[i];
      const st = stan?.opublikowane?.[sciezka];
      const zajety = st?.media_id || (st?.pominiete && st.pominiete !== 'archiwum sprzed startu');
      if (sciezka && !zajety) dnia.push({ data, sekcja, news, sciezka, popol: news.slot === '15:00' ? 1 : 0, poz: dnia.length });
    });
    dnia.sort((a, b) => b.popol - a.popol || a.poz - b.poz);
    out.push(...dnia);
  }
  return out;
}

// ---------- główny przebieg ----------
async function main() {
  const { E, U } = wczytaj();
  const wszystkie = listaNewsow(E, U);
  let stan = wczytajStan();

  // Podgląd wybranego dnia (DRY_RUN + IG_PODGLAD_DATA): ignoruje stan, nic nie zapisuje.
  if (DRY && env.IG_PODGLAD_DATA) {
    stan = { opublikowane: Object.fromEntries(wszystkie.filter((x) => x.data !== env.IG_PODGLAD_DATA).map((x) => [x.sciezka, {}])) };
  }

  // Pierwsze uruchomienie: oznacz całe archiwum jako „już było”, żeby nie wrzucić 50 starych newsów naraz.
  if (!stan) {
    stan = { od: new Date().toISOString(), opublikowane: {} };
    for (const x of wszystkie) stan.opublikowane[x.sciezka] = { pominiete: 'archiwum sprzed startu' };
    zapiszStan(stan);
    commitStanu('Instagram: start, archiwum pominięte');
    log(`Start: ${wszystkie.length} istniejących newsów oznaczono jako pominięte. Kolejne wydania pójdą na IG.`);
    return;
  }

  // Tryb slot: jeden post o godzinie z harmonogram.json, najświeższy nieopublikowany news (dziś, potem wczoraj).
  let slot = null;
  let kandydaci;
  if (env.IG_TYLKO) {
    kandydaci = wszystkie.filter((x) => x.sciezka === env.IG_TYLKO.trim());
    if (!kandydaci.length) throw new Error(`Nie ma newsa ${env.IG_TYLKO} w data/urls.js`);
  } else if (env.IG_TRYB === 'slot') {
    slot = biezacySlot(stan);
    if (!slot && !DRY) { log('Teraz nie ma slotu do zrobienia.'); return; }
    slot ??= { klucz: 'podglad', data: Object.keys(E).sort().at(-1) };
    kandydaci = kandydaciSlotu(E, U, stan, slot.data);
  } else {
    kandydaci = wszystkie.filter((x) => !stan.opublikowane[x.sciezka]);
  }
  const limit = env.IG_TRYB === 'slot' || env.IG_TYLKO ? 1 : MAKS;

  // Karty bieżącego uruchomienia (stare usuwamy, gałąź i tak jest nadpisywana).
  const kartyDir = join(STAN_DIR, 'karty');
  rmSync(kartyDir, { recursive: true, force: true });
  mkdirSync(kartyDir, { recursive: true });
  const nazwa = (x) => x.sciezka.replace(/^artykuly\//, '').replace(/\//g, '_').replace(/\.html$/, '.jpg');
  const { renderuj } = await import('./karta.mjs');

  // Tylko prawdziwy kadr: renderujemy po kolei i odrzucamy newsy, dla których miniatury nie udało się pobrać.
  const nowe = [];
  for (const x of kandydaci) {
    if (nowe.length >= limit) break;
    const [w] = await renderuj([{ ...x, wariant: WARIANT, plik: join(kartyDir, nazwa(x)) }]);
    if (!w.kadr) { log(`– pomijam (brak oryginalnej miniatury): ${x.news.title}`); rmSync(w.plik, { force: true }); continue; }
    x.zKadrem = true;
    x.opis = opis(x.news, { zKadrem: true });
    nowe.push(x);
  }
  if (!nowe.length) {
    log('Brak newsa z oryginalną miniaturą do publikacji.');
    if (slot && !DRY) { stan.sloty ??= {}; stan.sloty[slot.klucz] = { brak: 'brak nieopublikowanego newsa z miniaturą' }; zapiszStan(stan); commitStanu(`Instagram: slot ${slot.klucz} pusty`); }
    return;
  }
  log(`Do publikacji: ${nowe.length}${slot ? ` (slot ${slot.klucz})` : ''}`);

  if (DRY) {
    const md = nowe.map((x) => `## ${nazwa(x)}${x.zKadrem ? '' : ' (bez kadru)'}\n\n\`\`\`\n${x.opis}\n\`\`\`\n`).join('\n');
    writeFileSync(join(kartyDir, 'podglad.md'), `# Podgląd postów (${nowe.length})\n\n${md}`);
    log(`DRY_RUN: zapisano ${nowe.length} kart i podgląd opisów w ${kartyDir}`);
    return;
  }

  if (!env.IG_TOKEN) throw new Error('Brak sekretu IG_TOKEN w repo.');
  // IG_USER_ID jest opcjonalny: bez niego pytamy API, do kogo należy token.
  if (!env.IG_USER_ID) {
    const ja = await api('me', { params: { fields: 'user_id,username' } });
    env.IG_USER_ID = ja.user_id;
    log(`Konto: @${ja.username} (${ja.user_id})`);
  }
  const sha = commitStanu(`Instagram: karty (${nowe.length})`);
  let wolne = await wolnyLimit();
  let bledy = 0;

  for (const [i, x] of nowe.entries()) {
    if (wolne <= 2) { log('Limit publikacji Instagrama na 24 h prawie wyczerpany, reszta pójdzie w następnym uruchomieniu.'); break; }
    const url = `https://raw.githubusercontent.com/${REPO}/${sha}/karty/${encodeURIComponent(nazwa(x))}`;
    try {
      const id = await opublikuj(url, x.opis);
      stan.opublikowane[x.sciezka] = { media_id: id, kiedy: new Date().toISOString(), ...(slot && { slot: slot.klucz }) };
      if (slot) { stan.sloty ??= {}; stan.sloty[slot.klucz] = { sciezka: x.sciezka, media_id: id }; }
      wolne--;
      log(`✓ ${x.news.title} → ${id}`);
    } catch (e) {
      bledy++;
      log(`✗ ${x.news.title}: ${e.message}`);
      // Błąd nie blokuje kolejki: próbujemy ponownie przy następnym uruchomieniu, po 3 nieudanych próbach odpuszczamy.
      stan.bledy ??= {};
      stan.bledy[x.sciezka] = (stan.bledy[x.sciezka] ?? 0) + 1;
      if (stan.bledy[x.sciezka] >= 3) stan.opublikowane[x.sciezka] = { pominiete: `3 nieudane próby: ${e.message.slice(0, 200)}` };
    }
    zapiszStan(stan);
    commitStanu(`Instagram: ${x.sciezka}`);
    if (i < nowe.length - 1) await sleep(ODSTEP_MS);
  }
  // Nieudana publikacja w slocie: slot zostaje otwarty i kolejne uruchomienie (za ok. 15 min) spróbuje ponownie.
  if (bledy) { process.exitCode = 1; log(`Błędy: ${bledy}`); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
