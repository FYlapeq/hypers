# Zbieracz danych Hypers – projekt

Data: 2026-10-12 · Status: do przeglądu przez Filipa

## Cel

Hypers publikuje ok. 15 newsów dziennie o twórcach internetowych (7 rano, 8 po południu). Redakcja (zaplanowane zadanie Claude'a) nie ma dostępu do YouTube'a, Twitcha ani Kicka. Zbieracz pobiera dane z tych serwisów przez oficjalne API, zanim redakcja zacznie pracę, i zapisuje je w prywatnym repo, skąd czyta je redakcja.

Kryteria sukcesu:
- Dwa razy dziennie (5:45 i 13:45 czasu polskiego) powstaje plik z nowymi filmami i streamami obserwowanych twórców.
- Redakcja o 6:15 i 14:15 ma wszystko, czego potrzebuje, a wydania są na stronie o 7:00 i 15:00.
- Awaria jednej platformy nie zatrzymuje reszty i jest widoczna w pliku.

## Poza zakresem

- Instagram, TikTok, relacje (brak dostępu przez oficjalne API dla tej skali; do rozważenia później).
- Przebudowa wyglądu strony (osobny projekt).
- Samo pisanie newsów (zasady w `CLAUDE.md` repo `hypers`).

## Architektura

```
GitHub Actions (hypers-data, prywatne)        Zadanie Claude'a (Claude Code)          GitHub Pages
5:45 / 13:45  zbieracz.py  ──commit──▶  runs/RRRR-MM-DD-<slot>.json  ──▶  6:15 / 14:15 redakcja ──push──▶ hypers (publiczne) ──▶ hypers.tech 7:00 / 15:00
```

- Repo `FYlapeq/hypers-data` (prywatne): kod zbieracza, lista twórców, pliki z danymi. Sekrety: `YOUTUBE_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`.
- Repo `FYlapeq/hypers` (publiczne): tylko strona i wydania. Surowe dane (komentarze, napisy) nigdy tu nie trafiają.

## 1. Dane wejściowe: `sources/creators.yml`

```yaml
- name: Książulo
  group: lista          # lista | top100 | streamer | zagranica
  youtube: [UC...]      # stałe ID kanałów; kilka dla grup (np. Ekipa)
  twitch: null
  kick: null
  pinned: true          # tylko dla list ruchomych: nie usuwać przy odświeżaniu
```

Grupy:
- `lista`: Friz, Wersow, Ekipa (wszystkie kanały członków), EKIPA WK (@EKIPAWK), Budda, Książulo, Blowek, ReZigiusz, Sylwester Wardęga, Krzysztof Gonciarz, Konopskyy, Gimper. Zmiany tylko na prośbę Filipa.
- `top100`: top 100 polskiego YouTube'a, odświeżane raz w miesiącu na podstawie publicznych rankingów, subskrypcje sprawdzane przez `channels.list`. Bez duplikatów z `lista`.
- `streamer` (Twitch/Kick): Xayoo, Gucio, Izak, Mork, Bagi, Kubon, Rybson, Kasix, Diables, Overpow.
- `zagranica`: top 50 twórców świata, wyłącznie prawdziwi twórcy (osoby i grupy; bez wytwórni, stacji TV, kanałów firmowych i dziecięcych), odświeżane raz w miesiącu. Zawsze obecni (`pinned`): MrBeast, KSI, Sidemen, IShowSpeed, Kai Cenat, Logan Paul, Jake Paul, PewDiePie.

Rozwiązywanie ID: handle/nazwy są zamieniane na stałe ID przez API i zapisywane w pliku. Niejednoznaczne konta trafiają do `to_check`, nigdy nie są zgadywane. Otwarte: „Ludwig” (kanał nieustalony).

## 2. Przebieg skryptu

1. Wczytaj `creators.yml`, uzupełnij brakujące ID.
2. YouTube: dla każdego kanału `playlistItems.list` na liście „przesłane” (10 ostatnich), filtr `published > since`. Szczegóły paczkami po 50 przez `videos.list` (tytuł, opis, data, długość, Short, statystyki). Dla nowych filmów `commentThreads.list` (20 najpopularniejszych): tylko tekst i polubienia, bez nicków.
3. Streamy: Twitch Helix (live, tytuł, gra, widzowie, nowe VOD-y), Kick (oficjalne API). Uwierzytelnienie client credentials.
4. Napisy (moduł z wyłącznikiem `transcripts.enabled` w `config.yml`): tylko nowe filmy z `lista` i `zagranica` z ostatnich 48 h; limit czasu na próbę; błąd = `status: "niedostępne"`. Moduł nieoficjalny (poza API), świadomie zaakceptowany przez Filipa razem z ryzykiem naruszenia regulaminu YouTube'a i blokad z serwerów chmurowych.
5. Godzina: workflow ma crony UTC pokrywające czas letni i zimowy; skrypt działa tylko, gdy w Europe/Warsaw jest 5:45 lub 13:45 (tolerancja 30 minut na opóźnienia GitHuba) i dany slot jeszcze się nie odbył.
6. Zapis `runs/RRRR-MM-DD-<rano|popoludnie>.json`, aktualizacja `state.json` (`last_success`), commit. Pliki starsze niż 15 dni są usuwane.

Szacowany koszt YouTube API: ok. 350 z 10 000 jednostek dziennie (ok. 175 kanałów × 2 przebiegi, plus komentarze).

## 3. Format pliku

```json
{
  "run": { "date": "2026-10-13", "slot": "rano", "started": "05:45", "since": "2026-10-12T13:45+02:00" },
  "status": { "youtube": "ok", "twitch": "ok", "kick": "błąd: …", "transcripts": "12/15" },
  "videos": [ { "creator", "group", "channel_id", "video_id", "url", "title", "description",
                "published", "duration_s", "is_short", "stats": {"views","likes","comments"},
                "top_comments": [ {"text","likes"} ], "transcript": {"status","lang","text"} } ],
  "streams": [ { "creator", "platform", "live", "title", "game", "viewers", "started" } ],
  "to_check": [ "…" ]
}
```

- `since` = czas ostatniego udanego przebiegu, więc nic nie wpada dwa razy ani nie przepada.
- `status` rozróżnia awarię od braku nowości.

## 4. Obsługa błędów

Zbieracz:
- Błąd platformy: 2 ponowienia z odstępem, potem wpis w `status` i dalej.
- Limit API: kolejność obsługi `lista` → `zagranica` → `streamer` → `top100`; odpadają najmniej ważne.
- Napisy: błąd nie przerywa przebiegu. Gdy przez 3 dni z rzędu działa mniej niż połowa, redakcja informuje Filipa.
- Awaria całego przebiegu: GitHub wysyła maila; następny przebieg nadrabia dzięki `since`.

Redakcja:
- Brak pliku lub pusty YouTube: wydanie z researchu w sieci z zasadą 3 źródeł dla wszystkiego.
- Za mało newsów spełniających zasady: wydanie krótsze niż 15, bez dopychania.
- Przed pushem: walidacja `data/editions.js` i render strony bez błędów; przy błędzie brak publikacji i opis problemu.
- Grube ryby: wyłącznie szkic do akceptacji Filipa.

## 5. Testy

Automatyczne (pytest, bez prawdziwych zapytań, na zapisanych odpowiedziach API), uruchamiane przy każdej zmianie:
- filtrowanie po `since`, brak duplikatów;
- pilnowanie godziny przed i po zmianie czasu (25.10.2026);
- kolejność grup przy wyczerpaniu limitu;
- odporność na błąd platformy i napisów;
- zgodność pliku ze schematem, brak nicków w komentarzach;
- usuwanie plików starszych niż 15 dni;
- filtr „prawdziwych twórców” w `zagranica`.

Na żywo: jeden ręczny przebieg na prawdziwych kluczach, wspólny przegląd pliku (zgodność kanałów, działanie napisów z serwerów GitHuba), dopiero potem włączenie harmonogramu i zadań redakcyjnych.

## Zmiany zasad redakcyjnych związane ze zbieraczem

Do przeniesienia do `CLAUDE.md` przy wdrożeniu:
- Cel ok. 15 newsów dziennie (7 rano, 8 po południu), bez dopychania słabych tematów.
- Na luzie i Z czapy: wystarczy źródło pierwotne (oryginał twórcy z API), gdy news dotyczy tego, co twórca sam powiedział lub pokazał. 3 niezależne źródła dla wszystkiego, co dotyczy innych osób, oraz dla grubych ryb.
- Zagranica: maks. 3 newsy dziennie.
- Popołudniowe newsy na górze wydania danego dnia, z etykietą godziny (wymaga drobnej zmiany na stronie).
