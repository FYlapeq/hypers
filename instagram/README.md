# Hypers na Instagramie

Na Instagram idzie **karuzela co godzinę** (godziny z `harmonogram.json`, czas Warszawy, domyślnie 8:00–23:00; `wyjatki` nadpisują listę dla konkretnego dnia): `newsow_w_poscie` (3) kart 1080×1350 (wariant E: kadr w tle, licznik 1/3 … 3/3), a na końcu slajd „Zostaw follow” z `follow_tekst`. Posty idą **na zmianę** (`na_zmiane`): newsy o twórcach (Grube ryby, Na luzie), potem ciekawostki, potem znowu newsy. Gdy wybranego rodzaju nie starczy na pełną karuzelę, idzie drugi rodzaj; gdy obu brakuje, slot jest pusty, a treści czekają. Ciekawostki biorą też nieopublikowane z ostatnich `dni_zapasu_ciekawostek` dni. Opis = numerowane tytuły z leadami, prośba o follow, źródła, kadry i hashtagi. Ręczny tryb `publikuj` z polem `tylko` nadal wrzuca jeden news jako zwykły post. Workflow `.github/workflows/instagram.yml` działa w trybie **zegar** (`zegar.sh`): startuje po pushu nowego wydania (zmiana `data/editions.js`), czeka do pełnej godziny slotu i publikuje o czasie, wybierając najświeższe nieopublikowane newsy z dziś i wczoraj. Przed każdym slotem pobiera świeże `main` i stan, więc popołudniowe wydanie wchodzi do kolejki samo. Job żyje maks. ok. 5 h, potem uruchamia swojego następcę (`workflow_dispatch`, tryb `zegar`). Cron co 15 min to tylko zapas, gdy łańcuch się zerwie; spóźniony post wychodzi do `maks_opoznienie_min` (50) min po czasie, później slot przepada, żeby zaległe godziny nie szły jedna po drugiej. Ręcznie: Actions → Instagram → Run workflow → `zegar` (wznawia łańcuch) albo `publikuj` (tylko slot, który już przypada; czeka w kolejce, gdy zegar działa).

**Oznaczanie twórców:** przy tytule każdego newsa w opisie idzie @konto osoby, a na jej slajdzie tag (`user_tags`). Konta biorą się z pola `ig` newsa, a gdy go brak, z mapy `konta.json` (po nazwie z `who`). Gdy Instagram odrzuci tag, slajd idzie bez niego, @ w opisie zostaje.

**Tylko oryginalna grafika:** post wychodzi wyłącznie z prawdziwą miniaturą filmu z pola `image`. Gdy miniatury nie da się pobrać albo news ma `noImage`, automat bierze następny news; zastępczej karty nigdy nie publikuje.

## Jak to działa
- `karta.mjs` renderuje karty w headless Chromium (czcionki Anton i Work Sans z `/fonts`). Kadr w tle tylko wtedy, gdy news ma na stronie `image` (`kadr` z i.ytimg.com albo `prasowe`); newsy z `noImage` dostają kartę bez zdjęcia (wariant A). Na karcie i w opisie jest podpis „Kadr: Twórca / YouTube”.
- `publikuj.mjs` wybiera newsy, których nie ma w stanie, renderuje karty, wrzuca je na gałąź `instagram` i publikuje przez Instagram API (graph.instagram.com). Kolejność w slocie: najnowszy dzień, porcja 15:00 przed 7:00, potem kolejność ze strony.
- Gałąź `instagram` jest za każdym razem tworzona od zera: trzyma tylko `opublikowane.json` (co już poszło) i karty bieżącego uruchomienia, więc grafiki nie zaśmiecają historii repo. Nie commituj na nią ręcznie.
- Pierwsze uruchomienie oznacza całe archiwum jako pominięte: na IG idą tylko wydania od momentu włączenia.
- Nieudany post jest ponawiany przy kolejnym uruchomieniu; po 3 błędach zostaje pominięty (powód w `opublikowane.json`).

## Konfiguracja (raz)
1. **Konto IG**: załóż konto Hypers i przełącz je na konto **profesjonalne** (Ustawienia → Typ konta i narzędzia → Przełącz na konto profesjonalne → Twórca albo Firma).
2. **Aplikacja Meta**: na developers.facebook.com/apps → **Create App** → przypadek użycia **Other** → typ **Business** → nazwa (np. „Hypers IG”) i e-mail. Na liście produktów przy **Instagram** kliknij **Set up**.
3. **Token**: w *Instagram → API setup with Instagram login* w kroku **Generate access tokens** dodaj konto Hypers (musi być publiczne), zaloguj się nim i skopiuj wygenerowany token. Aplikacja zostaje w trybie deweloperskim, bo publikuje tylko na konto, które ma w niej rolę.
4. **Sekrety repo** (Settings → Secrets and variables → Actions → Secrets → New repository secret):
   - `IG_TOKEN`: token z punktu 3 (ważny 60 dni, workflow odświeża go co poniedziałek),
   - `IG_SECRETS_PAT`: fine-grained token GitHub (github.com/settings/personal-access-tokens) tylko dla repo `FYlapeq/hypers`, uprawnienie **Secrets: Read and write**. Bez niego token wygaśnie po 60 dniach.
   - `IG_USER_ID` jest opcjonalny: skrypt sam ustala konto z tokenu.
5. **Próba**: Actions → Instagram → Run workflow → tryb `proba`. Karty i `podglad.md` z opisami pojawią się na gałęzi `instagram-podglad`.
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
