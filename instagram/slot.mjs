// Harmonogram postów na IG: który slot (godzina z harmonogram.json) jest teraz do zrobienia.
// Bez zależności, żeby workflow mógł to sprawdzić przed instalacją Chromium.
// CLI: node instagram/slot.mjs <ścieżka opublikowane.json>  → wypisuje klucz slotu albo nic.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
export const harmonogram = () => JSON.parse(readFileSync(join(DIR, 'harmonogram.json'), 'utf8'));

// Data i minuty od północy w strefie Europe/Warsaw.
export function warszawa(teraz = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(teraz).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, minuty: Number(p.hour) * 60 + Number(p.minute) };
}

const naMinuty = (g) => { const [h, m] = g.split(':').map(Number); return h * 60 + m; };

// Najpóźniejszy slot dzisiaj, który już minął, ale nie dawniej niż maks_opoznienie_min. null = nic do zrobienia.
export function biezacySlot(stan, teraz = new Date(), h = harmonogram()) {
  const { data, minuty } = warszawa(teraz);
  const godziny = h.wyjatki?.[data] ?? h.godziny;
  const minione = godziny.filter((g) => naMinuty(g) <= minuty && minuty - naMinuty(g) <= h.maks_opoznienie_min);
  if (!minione.length) return null;
  const godzina = minione.sort().at(-1);
  const klucz = `${data} ${godzina}`;
  if (stan?.sloty?.[klucz]) return null;
  return { klucz, data, godzina };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plik = process.argv[2];
  const stan = plik && existsSync(plik) ? JSON.parse(readFileSync(plik, 'utf8')) : null;
  const s = biezacySlot(stan);
  if (s) console.log(s.klucz);
}
