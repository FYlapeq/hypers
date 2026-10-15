// Sprawdzenie tokenu Instagrama bez publikowania: konto, typ konta, limit publikacji.
// Wynik jako adnotacje GitHub Actions (::notice / ::error). Tokenu nie wypisuje.
const API = 'https://graph.instagram.com/v25.0';
const token = process.env.IG_TOKEN;
const blad = (m) => { console.log(`::error title=Instagram::${m}`); process.exitCode = 1; };

async function get(sciezka, params = {}) {
  const url = new URL(`${API}/${sciezka}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${r.status} ${j.error?.message ?? ''}`.trim());
  return j;
}

if (!token) blad('Brak sekretu IG_TOKEN w repo (Settings → Secrets and variables → Actions).');
else {
  try {
    const ja = await get('me', { fields: 'user_id,username,account_type,media_count' });
    console.log(`::notice title=Instagram: konto OK::@${ja.username}, typ ${ja.account_type}, postów: ${ja.media_count ?? '?'}`);
    try {
      const { data } = await get(`${ja.user_id}/content_publishing_limit`, { fields: 'quota_usage,config' });
      const d = data?.[0] ?? {};
      console.log(`::notice title=Instagram: publikowanie OK::Uprawnienie do publikacji działa. Wykorzystane ${d.quota_usage ?? 0} z ${d.config?.quota_total ?? '?'} postów w 24 h.`);
    } catch (e) {
      blad(`Token działa, ale bez prawa do publikacji (${e.message}). Dodaj instagram_business_content_publish w aplikacji Meta i wygeneruj token ponownie.`);
    }
  } catch (e) {
    blad(`Token nie działa: ${e.message}. Wygeneruj nowy w panelu Meta i podmień sekret IG_TOKEN.`);
  }
}
