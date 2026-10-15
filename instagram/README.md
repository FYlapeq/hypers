# Hypers na Instagramie

Każdy nowy news z wydania trafia na Instagram jako osobny post: karta 1080×1350 (wariant E: kadr z filmu w tle, tytuł na dole) i opis z treścią newsa, źródłami i hashtagami. Robi to workflow `.github/workflows/instagram.yml` po każdym pushu zmieniającym `data/urls.js`, czyli po każdym wydaniu.

## Jak to działa
- `karta.mjs` renderuje karty w headless Chromium (czcionki Anton i Work Sans z `/fonts`). Kadr w tle tylko wtedy, gdy news ma na stronie `image` (`kadr` z i.ytimg.com albo `prasowe`); newsy z `noImage` dostają kartę bez zdjęcia (wariant A). Na karcie i w opisie jest podpis „Kadr: Twórca / YouTube”.
- `publikuj.mjs` wybiera newsy, których nie ma w stanie, renderuje karty, wrzuca je na gałąź `instagram` i publikuje przez Instagram API (graph.instagram.com). Kolejność: temat dnia idzie ostatni, żeby był na górze profilu. Między postami 3 min przerwy.
- Gałąź `instagram` jest za każdym razem tworzona od zera: trzyma tylko `opublikowane.json` (co już poszło) i karty bieżącego uruchomienia, więc grafiki nie zaśmiecają historii repo. Nie commituj na nią ręcznie.
- Pierwsze uruchomienie oznacza całe archiwum jako pominięte: na IG idą tylko wydania od momentu włączenia.
- Nieudany post jest ponawiany przy kolejnym uruchomieniu; po 3 błędach zostaje pominięty (powód w `opublikowane.json`).

## Konfiguracja (raz)
1. **Konto IG**: załóż konto Hypers i przełącz je na konto **profesjonalne** (Ustawienia → Typ konta i narzędzia → Przełącz na konto profesjonalne → Twórca albo Firma).
2. **Aplikacja Meta**: na developers.facebook.com → My Apps → Create App → przypadek użycia „Manage messaging & content on Instagram”. W sekcji *Instagram → API setup with Instagram business login* dodaj konto Hypers jako testera/właściciela i wygeneruj token dostępu (uprawnienia `instagram_business_basic`, `instagram_business_content_publish`). Aplikacja może zostać w trybie deweloperskim, bo publikuje tylko na Twoje konto.
3. **ID konta**: w tym samym panelu przy wygenerowanym tokenie widać ID konta Instagram (liczba).
4. **Sekrety repo** (Settings → Secrets and variables → Actions → Secrets):
   - `IG_TOKEN`: token z punktu 2 (ważny 60 dni, odświeżany co tydzień automatycznie),
   - `IG_USER_ID`: ID z punktu 3,
   - `IG_SECRETS_PAT`: fine-grained token GitHub tylko dla repo `FYlapeq/hypers` z uprawnieniem **Secrets: Read and write** (potrzebny do zapisu odświeżonego tokenu).
5. **Próba**: Actions → Instagram → Run workflow → tryb `proba`. Pobierz artefakt `instagram-podglad`: karty i `podglad.md` z opisami.
6. **Włączenie**: Settings → Secrets and variables → Actions → **Variables** → `IG_WLACZONY` = `1`.

## Zmienne (Variables, opcjonalne)
| Zmienna | Domyślnie | Co robi |
|---|---|---|
| `IG_WLACZONY` | `0` | `1` = publikuje; `0` = workflow nic nie wrzuca (wyłącznik awaryjny) |
| `IG_WARIANT` | `e` | wygląd karty: `a` niebieska, `b` jasna z leadem, `c` ciemna, `d` kadr u góry, `e` kadr w tle |
| `IG_KADRY` | `1` | `0` = karty bez miniatur z YouTube |
| `IG_ODSTEP_MIN` | `3` | przerwa między postami w minutach |

## Lokalnie
```
cd instagram && npm ci && npx playwright install chromium && cd ..
node instagram/karta.mjs 2026-10-15 /tmp/karty wszystkie          # wszystkie warianty kart
DRY_RUN=1 IG_PODGLAD_DATA=2026-10-15 STAN_DIR=/tmp/ig node instagram/publikuj.mjs   # karty + opisy bez publikacji
```
