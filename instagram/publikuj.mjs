// Publikuje nowe newsy Hypers na Instagramie. Tryb slot (domyślny): karuzela = newsow_w_poscie (3) newsów albo ciekawostek na zmianę (każdy na osobnej karcie
// JPEG 1080x1350) + slajd końcowy z prośbą o follow, jeden opis z listą newsów. IG_TYLKO: jeden news = jeden post.
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

const SEKCJE = ['ryby', 'luz', 'ciekawostki']; // jak w karta.mjs (bez importu, żeby nie ładować Playwrighta bez potrzeby)

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

// ---------- oznaczenia @ twórców ----------
// Konto IG osoby z newsa: najpierw pole `ig` newsa (sprawdzone przez sesję wydania), potem mapa instagram/konta.json po `who`.
const HANDLE = /^[a-z0-9._]{1,30}$/;
const kluczOsoby = (s) => bezOgonkow(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
let KONTA = null;
export function konta() {
  if (!KONTA) {
    const plik = join(ROOT, 'instagram/konta.json');
    const surowe = existsSync(plik) ? JSON.parse(readFileSync(plik, 'utf8')).konta ?? {} : {};
    KONTA = new Map(Object.entries(surowe).map(([k, v]) => [kluczOsoby(k), [].concat(v)]));
  }
  return KONTA;
}
export function oznaczenia(news, mapa = konta()) {
  let h = [].concat(news.ig ?? []);
  if (!h.length && news.who) for (const osoba of news.who.split(/\s+i\s+|,|&|\s+x\s+/)) h.push(...(mapa.get(kluczOsoby(osoba)) ?? []));
  h = h.map((x) => String(x).trim().replace(/^@/, '').toLowerCase()).filter((x) => HANDLE.test(x) && x !== 'hypers.tech');
  return [...new Set(h)];
}
const malpy = (news) => oznaczenia(news).map((x) => '@' + x).join(' ');

export function hashtagi(news, sekcja) {
  const tagi = ['#hypers'];
  for (const osoba of news.who.split(/\s+i\s+|,|&/)) if (osoba.trim()) tagi.push(hashtag(osoba));
  if (news.category) tagi.push(hashtag(news.category));
  if (sekcja === 'ciekawostki') tagi.push('#ciekawostki', '#ciekawostka', '#wiedza');
  else tagi.push('#tworcy', '#youtubepl');
  return [...new Set(tagi.filter((t) => t.length > 2))].slice(0, 8).join(' ');
}

// Tekst na Instagram: pole insta {tytul, opis} pisane luźno, po ludzku; bez niego tytuł i lead ze strony.
export const tytulIG = (news) => news.insta?.tytul || news.title;
export const opisIG = (news) => news.insta?.opis || news.summary;

// Opis karuzeli: numerowane tytuły z krótkim opisem, prośba o follow, źródła, kadry, hashtagi.
export function opisKaruzeli(lista) {
  const zrodla = [...new Set(lista.flatMap((x) => (x.news.sources ?? []).map((s) => s.name)))].join(', ');
  const kadry = [...new Set(lista.map((x) => x.news.image?.credit).filter(Boolean))].join(', ');
  const tagi = [...new Set(lista.flatMap((x) => hashtagi(x.news, x.sekcja).split(' ')))];
  const ciek = lista.filter((x) => x.sekcja === 'ciekawostki').length;
  const ile = (n, [jeden, kilka, wiele]) => `${n} ${n === 1 ? jeden : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? kilka : wiele}`;
  const glowa = ciek === lista.length
    ? `${ile(lista.length, ['rzecz', 'rzeczy', 'rzeczy'])}, o których pewnie nie wiedziałeś 👀 Przewiń ➡️`
    : ciek
      ? `Trochę newsów, trochę ciekawostek. Przewiń ➡️`
      : `Co tam u twórców? ${ile(lista.length, ['news', 'newsy', 'newsów'])} na szybko ➡️`;
  const stopka = [
    'Wrzucamy co godzinę, od 8 do 23. Daj follow @hypers.tech, żeby nic Ci nie uciekło.',
    '',
    zrodla && `Źródła: ${zrodla}`,
    kadry && `Kadry i zdjęcia: ${kadry}`,
    'Więcej szczegółów i linki do źródeł: hypers.tech (link w bio)',
    '',
    ['#hypers', ...tagi.filter((t) => t !== '#hypers')].slice(0, 15).join(' '),
  ].filter((x) => x !== false && x !== undefined && x !== null).join('\n');
  const pozycje = (zLeadem) => lista.map((x, i) => {
    const m = malpy(x.news);
    return `${i + 1}. ${tytulIG(x.news)}${m ? ` ${m}` : ''}${zLeadem[i] ? `\n${opisIG(x.news)}` : ''}`;
  });
  const sklej = (z) => [glowa, ...pozycje(z), stopka].join('\n\n');
  // Gdy się nie mieści, zdejmujemy leady od końca; tytuły zostają zawsze.
  const z = lista.map((x) => !!opisIG(x.news));
  for (let i = z.length - 1; i >= 0 && sklej(z).length > LIMIT_OPISU; i--) z[i] = false;
  let tekst = sklej(z);
  if (tekst.length > LIMIT_OPISU) tekst = tekst.slice(0, LIMIT_OPISU - 1) + '…';
  return tekst;
}

export function opis(news, { zKadrem, sekcja }) {
  const zrodla = [...new Set((news.sources ?? []).map((s) => s.name))].join(', ');
  const stopka = [
    zrodla && `Źródła: ${zrodla}`,
    zKadrem && news.image?.credit && `${news.image.kind === 'wolne' ? 'Zdjęcie' : 'Kadr'}: ${news.image.credit}`,
    'Cały artykuł i linki do źródeł: hypers.tech (link w bio)',
    '',
    hashtagi(news, sekcja),
  ].filter((x) => x !== false && x !== undefined && x !== null).join('\n');
  const glowa = [tytulIG(news), malpy(news)].filter(Boolean).join(' ');
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
    await sleep(8000);
  }
  const { id } = await api(`${env.IG_USER_ID}/media_publish`, { method: 'POST', params: { creation_id: kontener } });
  return id;
}

async function czekajNaKontener(kontener) {
  for (let i = 0; i < 20; i++) {
    const { status_code } = await api(kontener, { params: { fields: 'status_code' } });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Kontener ${kontener}: ${status_code}`);
    await sleep(8000);
  }
  throw new Error(`Kontener ${kontener}: Instagram nie przetworzył obrazu w 150 s`);
}

// Karuzela: najpierw kontener na każdy slajd (is_carousel_item), potem kontener CAROUSEL z opisem i publikacja.
// slajdy = [{ url, oznacz: ['konto', ...] }]: oznaczeni twórcy dostają też tag na swoim slajdzie (user_tags).
// Gdy Instagram odrzuci tag (np. konto zmieniło nazwę), slajd idzie bez tagu, a @ w opisie zostaje.
export function userTags(oznacz) {
  return oznacz.map((username, i) => ({ username, x: Number(((i + 1) / (oznacz.length + 1)).toFixed(2)), y: 0.85 }));
}
async function opublikujKaruzele(slajdy, caption) {
  const dzieci = [];
  for (const { url: image_url, oznacz = [] } of slajdy) {
    const params = { image_url, is_carousel_item: 'true' };
    let id;
    if (oznacz.length) {
      try {
        ({ id } = await api(`${env.IG_USER_ID}/media`, { method: 'POST', params: { ...params, user_tags: JSON.stringify(userTags(oznacz)) } }));
      } catch (e) { log(`  tagi ${oznacz.join(', ')} odrzucone (${e.message.slice(0, 120)}), slajd bez tagu`); }
    }
    if (!id) ({ id } = await api(`${env.IG_USER_ID}/media`, { method: 'POST', params }));
    dzieci.push(id);
  }
  for (const id of dzieci) await czekajNaKontener(id);
  const { id: kontener } = await api(`${env.IG_USER_ID}/media`, {
    method: 'POST', params: { media_type: 'CAROUSEL', children: dzieci.join(','), caption },
  });
  await czekajNaKontener(kontener);
  const { id } = await api(`${env.IG_USER_ID}/media_publish`, { method: 'POST', params: { creation_id: kontener } });
  return id;
}

// Ostatnie posty z profilu. Meta potrafi zwrócić błąd przy media_publish (np. „Application request limit
// reached”), a post i tak wychodzi. 9–10.11.2026 przez to każda karuzela poszła 3 razy. Dlatego przed publikacją
// i po każdym błędzie sprawdzamy profil. null = nie udało się sprawdzić (wtedy nie publikujemy, żeby nie zdublować).
async function ostatniePosty() {
  try {
    const { data = [] } = await api(`${env.IG_USER_ID}/media`, { params: { fields: 'id,caption,timestamp', limit: '30' } });
    return data;
  } catch (e) { log('Nie udało się pobrać ostatnich postów z profilu:', e.message); return null; }
}
// Post z profilu, w którego opisie jest tytuł newsa (opis karuzeli zawiera tytuły wszystkich newsów).
export function postZNewsem(news, posty) {
  const tytuly = [news?.insta?.tytul, news?.title].map((t) => t?.trim()).filter(Boolean);
  if (!tytuly.length || !posty) return null;
  return posty.find((p) => tytuly.some((t) => (p.caption ?? '').includes(t))) ?? null;
}
// Limity Meta (kody 4, 17, 32, 613): to nie błąd newsa, tylko „spróbuj później”.
export const toLimitApi = (msg = '') => /request limit|rate limit|too many calls|limit reached/i.test(msg);
const ostrzezenie = (m) => console.log(`::warning title=Instagram::${m}`);

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
// Treści dla dzieci (Roblox, Minecraft itp.) i ręcznie wykluczone artykuły nigdy nie idą na IG.
export function dlaDzieci(news, h = harmonogram()) {
  const tekst = [news.title, news.summary, news.category, news.who].filter(Boolean).join(' ').toLowerCase();
  return (h.bez_dla_dzieci ?? []).some((slowo) => tekst.includes(slowo.toLowerCase()));
}
const wykluczony = (x, h = harmonogram()) => (h.wykluczone ?? []).includes(x.sciezka) || dlaDzieci(x.news, h);

export function kandydaciSlotu(E, U, stan, dzien) {
  return kandydaciBezFiltra(E, U, stan, dzien).filter((x) => {
    if (wykluczony(x)) { console.log(`– pomijam na IG (treść dla dzieci albo wykluczona): ${x.news.title}`); return false; }
    return true;
  });
}

function kandydaciBezFiltra(E, U, stan, dzien) {
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
  // Zapas: ciekawostki są ponadczasowe, więc do kolejki ciekawostek dochodzą też nieopublikowane
  // z ostatnich `dni_zapasu_ciekawostek` dni (bez na_zmiane dopełniają karuzelę newsów).
  const zapasDni = harmonogram().dni_zapasu_ciekawostek ?? 14;
  const juz = new Set(out.map((x) => x.sciezka));
  const starsze = Object.keys(E).sort().filter((d) => d <= dzien && !daty.includes(d)).slice(-zapasDni).reverse();
  for (const data of starsze) (E[data].ciekawostki ?? []).forEach((news, i) => {
    const sciezka = U[data]?.ciekawostki?.[i];
    const st = stan?.opublikowane?.[sciezka];
    if (sciezka && !juz.has(sciezka) && !st?.media_id && !(st?.pominiete && st.pominiete !== 'archiwum sprzed startu'))
      out.push({ data, sekcja: 'ciekawostki', news, sciezka, zapas: true });
  });
  return out;
}

// Rodzaj posta: 'newsy' (Grube ryby, Na luzie) albo 'ciekawostki'.
export const rodzaj = (x) => (x.sekcja === 'ciekawostki' ? 'ciekawostki' : 'newsy');

// Przy na_zmiane: rodzaj przeciwny do ostatniej opublikowanej karuzeli (starsze sloty bez pola typ
// rozpoznajemy po sekcjach ich newsów; mieszane liczą się jako newsy). Zwraca kolejność prób.
export function kolejnoscRodzajow(stan, sekcjaSciezki) {
  const ostatni = Object.entries(stan?.sloty ?? {}).filter(([, s]) => s.media_id).sort(([a], [b]) => a.localeCompare(b)).at(-1)?.[1];
  let typ = ostatni?.typ;
  if (!typ && ostatni) {
    const sciezki = ostatni.sciezki ?? [ostatni.sciezka].filter(Boolean);
    typ = sciezki.length && sciezki.every((s) => sekcjaSciezki.get(s) === 'ciekawostki') ? 'ciekawostki' : 'newsy';
  }
  return typ === 'newsy' ? ['ciekawostki', 'newsy'] : ['newsy', 'ciekawostki'];
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
    slot = DRY ? { klucz: 'podglad', data: env.IG_PODGLAD_DATA || Object.keys(E).sort().at(-1) } : biezacySlot(stan);
    if (!slot) { log('Teraz nie ma slotu do zrobienia.'); return; }
    kandydaci = kandydaciSlotu(E, U, stan, slot.data);
  } else {
    kandydaci = wszystkie.filter((x) => !stan.opublikowane[x.sciezka]);
  }
  // Przed wyborem: newsy, które już są na profilu (np. po fałszywym błędzie Meta), oznaczamy jako opublikowane.
  if (!DRY) {
    if (!env.IG_TOKEN) throw new Error('Brak sekretu IG_TOKEN w repo.');
    // IG_USER_ID jest opcjonalny: bez niego pytamy API, do kogo należy token.
    if (!env.IG_USER_ID) {
      const ja = await api('me', { params: { fields: 'user_id,username' } });
      env.IG_USER_ID = ja.user_id;
      log(`Konto: @${ja.username} (${ja.user_id})`);
    }
    const posty = await ostatniePosty();
    if (!posty) {
      ostrzezenie('Nie da się teraz sprawdzić profilu (pewnie limit API Meta). Nic nie publikuję, żeby nie zdublować postów; newsy czekają na następną godzinę.');
      return;
    }
    let odzyskane = 0;
    kandydaci = kandydaci.filter((x) => {
      const p = postZNewsem(x.news, posty);
      if (!p) return true;
      stan.opublikowane[x.sciezka] = { media_id: p.id, kiedy: p.timestamp, odzyskane: true };
      odzyskane++;
      log(`= już jest na profilu, nie wrzucam drugi raz: ${x.news.title}`);
      return false;
    });
    if (odzyskane) zapiszStan(stan);
  }
  const karuzela = !!slot;
  const W_POSCIE = harmonogram().newsow_w_poscie ?? 5;
  const limit = karuzela ? W_POSCIE : env.IG_TYLKO ? 1 : MAKS;

  // Karty bieżącego uruchomienia (stare usuwamy, gałąź i tak jest nadpisywana).
  const kartyDir = join(STAN_DIR, 'karty');
  rmSync(kartyDir, { recursive: true, force: true });
  mkdirSync(kartyDir, { recursive: true });
  const nazwa = (x) => x.sciezka.replace(/^artykuly\//, '').replace(/\//g, '_').replace(/\.html$/, '.jpg');
  const nazwaFoto = (x) => nazwa(x).replace(/\.jpg$/, '-foto.jpg');
  const { renderuj } = await import('./karta.mjs');

  // Tylko prawdziwy kadr: renderujemy po kolei i odrzucamy newsy, dla których miniatury nie udało się pobrać.
  const wybierz = async (lista) => {
    const wynik = [];
    for (const x of lista) {
      if (wynik.length >= limit) break;
      const nr = karuzela ? `${wynik.length + 1}/${W_POSCIE}` : null;
      const [w] = await renderuj([{ ...x, wariant: WARIANT, nr, plik: join(kartyDir, nazwa(x)) }]);
      if (!w.kadr) { log(`– pomijam (brak oryginalnej miniatury): ${x.news.title}`); rmSync(w.plik, { force: true }); continue; }
      x.zKadrem = true;
      if (karuzela && x.sekcja === 'ciekawostki') {
        // Po karcie ciekawostki: slajd z całym zdjęciem (to samo legalne zdjęcie z pola image).
        const [f] = await renderuj([{ zdjecie: true, news: x.news, nr, plik: join(kartyDir, nazwaFoto(x)) }]);
        x.foto = f.kadr;
      }
      x.opis = opis(x.news, { zKadrem: true, sekcja: x.sekcja });
      wynik.push(x);
    }
    return wynik;
  };
  let nowe = [];
  let typ = null;
  if (karuzela && harmonogram().na_zmiane) {
    // Na zmianę: newsy albo ciekawostki w jednej karuzeli. Gdy wybranego rodzaju nie starczy na pełną karuzelę,
    // próbujemy drugiego; karty odrzuconej próby kasujemy.
    const sekcjaSciezki = new Map(wszystkie.map((x) => [x.sciezka, x.sekcja]));
    for (const t of kolejnoscRodzajow(stan, sekcjaSciezki)) {
      const proba = await wybierz(kandydaci.filter((x) => rodzaj(x) === t));
      if (proba.length >= W_POSCIE) { nowe = proba; typ = t; break; }
      log(`Za mało (${proba.length}/${W_POSCIE}) z kadrem w rodzaju „${t}”.`);
      for (const x of proba) { rmSync(join(kartyDir, nazwa(x)), { force: true }); rmSync(join(kartyDir, nazwaFoto(x)), { force: true }); }
      if (proba.length > nowe.length) nowe = proba;
    }
  } else {
    nowe = await wybierz(kandydaci);
  }
  if (!nowe.length) {
    log('Brak newsa z oryginalną miniaturą do publikacji.');
    if (slot && !DRY) { stan.sloty ??= {}; stan.sloty[slot.klucz] = { brak: 'brak nieopublikowanego newsa z miniaturą' }; zapiszStan(stan); commitStanu(`Instagram: slot ${slot.klucz} pusty`); }
    return;
  }
  log(`Do publikacji: ${nowe.length}${slot ? ` (slot ${slot.klucz})` : ''}`);

  // Karuzela wychodzi tylko pełna (W_POSCIE newsów z kadrem). Za mało = slot pusty, newsy czekają na następny.
  let opisK = null;
  const FOLLOW = 'zz-follow.jpg';
  if (karuzela) {
    if (nowe.length < W_POSCIE) {
      log(`Za mało newsów z miniaturą na karuzelę: ${nowe.length}/${W_POSCIE}. Czekają na następny slot.`);
      if (!DRY) { stan.sloty ??= {}; stan.sloty[slot.klucz] = { brak: `za mało newsów (${nowe.length}/${W_POSCIE})` }; zapiszStan(stan); commitStanu(`Instagram: slot ${slot.klucz} pusty`); return; }
    }
    await renderuj([{ follow: true, godziny: harmonogram().godziny, tekst: harmonogram().follow_tekst, plik: join(kartyDir, FOLLOW) }]);
    opisK = opisKaruzeli(nowe);
  }

  if (DRY) {
    const md = karuzela
      ? `## Karuzela: ${[...nowe.flatMap((x) => (x.foto ? [nazwa(x), nazwaFoto(x)] : [nazwa(x)])), FOLLOW].join(', ')}\n\n\`\`\`\n${opisK}\n\`\`\`\n`
      : nowe.map((x) => `## ${nazwa(x)}${x.zKadrem ? '' : ' (bez kadru)'}\n\n\`\`\`\n${x.opis}\n\`\`\`\n`).join('\n');
    writeFileSync(join(kartyDir, 'podglad.md'), `# Podgląd postów (${nowe.length})\n\n${md}`);
    log(`DRY_RUN: zapisano ${nowe.length} kart i podgląd opisów w ${kartyDir}`);
    return;
  }

  const sha = commitStanu(`Instagram: karty (${nowe.length})`);
  let wolne = await wolnyLimit();
  let bledy = 0;
  const raw = (plik) => `https://raw.githubusercontent.com/${REPO}/${sha}/karty/${encodeURIComponent(plik)}`;

  if (karuzela) {
    if (wolne <= 2) { ostrzezenie('Limit publikacji Instagrama na 24 h prawie wyczerpany, newsy czekają na następną godzinę.'); return; }
    try {
      const slajdy = nowe.flatMap((x) => [
        { url: raw(nazwa(x)), oznacz: oznaczenia(x.news) },
        ...(x.foto ? [{ url: raw(nazwaFoto(x)) }] : []),
      ]);
      const id = await opublikujKaruzele([...slajdy, { url: raw(FOLLOW) }], opisK);
      const kiedy = new Date().toISOString();
      for (const x of nowe) stan.opublikowane[x.sciezka] = { media_id: id, kiedy, slot: slot.klucz };
      stan.sloty ??= {};
      stan.sloty[slot.klucz] = { sciezki: nowe.map((x) => x.sciezka), media_id: id, ...(typ && { typ }) };
      log(`✓ karuzela ${slot.klucz} (${nowe.length} newsów) → ${id}`);
    } catch (e) {
      log(`✗ karuzela ${slot.klucz}: ${e.message}`);
      // Meta bywa w błędzie, a post i tak wychodzi: chwila przerwy i sprawdzenie profilu.
      await sleep(30_000);
      const posty = await ostatniePosty();
      const p = postZNewsem(nowe[0].news, posty);
      if (p) {
        for (const x of nowe) stan.opublikowane[x.sciezka] = { media_id: p.id, kiedy: p.timestamp, slot: slot.klucz };
        stan.sloty ??= {};
        stan.sloty[slot.klucz] = { sciezki: nowe.map((x) => x.sciezka), media_id: p.id, ...(typ && { typ }) };
        log(`✓ mimo błędu karuzela ${slot.klucz} jest na profilu → ${p.id}`);
      } else if (toLimitApi(e.message) || !posty) {
        // Limit Meta: nie liczymy próby (newsy nie przepadają). Następna godzina i tak najpierw sprawdzi profil.
        ostrzezenie(`Limit API Meta (${e.message.slice(0, 150)}). Karuzela ${slot.klucz} nie wyszła, newsy czekają na następną godzinę.`);
      } else {
        stan.bledy ??= {};
        for (const x of nowe) {
          stan.bledy[x.sciezka] = (stan.bledy[x.sciezka] ?? 0) + 1;
          if (stan.bledy[x.sciezka] >= 3) stan.opublikowane[x.sciezka] = { pominiete: `3 nieudane próby: ${e.message.slice(0, 200)}` };
        }
        process.exitCode = 1; // prawdziwy błąd: run na czerwono (mail z GitHuba), newsy spróbują w kolejnej godzinie
      }
    }
    zapiszStan(stan);
    commitStanu(`Instagram: karuzela ${slot.klucz}`);
    return;
  }

  for (const [i, x] of nowe.entries()) {
    if (wolne <= 2) { log('Limit publikacji Instagrama na 24 h prawie wyczerpany, reszta pójdzie w następnym uruchomieniu.'); break; }
    const url = raw(nazwa(x));
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
