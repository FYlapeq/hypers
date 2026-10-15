# Hypers: codzienne wydanie

Strona statyczna (GitHub Pages z gałęzi `main`, domena hypers.tech w `CNAME`). Newsy w `data/editions.js` (`window.HYPERS_EDITIONS`, klucz = data `RRRR-MM-DD`, czas Europe/Warsaw). Cudzych zdjęć nie hostujemy: obrazy są wczytywane ze źródła (hotlink), a w artykule osadzany jest oryginalny post twórcy.

## Tryb pracy (oszczędność tokenów, obowiązkowy)
- NIE czytaj i NIE edytuj ręcznie `data/editions.js` (ok. 80 kB). Używaj `scripts/edition.mjs`:
  - `node scripts/edition.mjs recent 7`: co już było (sprawdzanie duplikatów).
  - `node scripts/edition.mjs digest <plik runs/…json>`: skrót danych zbieracza do wyboru tematów.
  - `node scripts/edition.mjs video <plik> <video_id>`: pełne dane jednego filmu, tylko dla wybranych tematów.
  - `node scripts/edition.mjs add nowe.json`: walidacja (pola, duplikaty, limit zagranicy, zasady zdjęć), dopisanie i build. Przy błędzie popraw `nowe.json` i uruchom ponownie.
- Nie otwieraj surowego pliku `runs/…json` ani plików w `artykuly/`.
- Najpierw dane zbieracza, wyszukiwanie w sieci dopiero tam, gdzie zasady wymagają 3 źródeł albo dane są niepełne. Nie wyszukuj tego, co już masz z API.
- WebFetch tylko dla stron, których treść jest potrzebna (daty, fakty). Pytaj w nim o konkretne fakty, nie o całą stronę.
- Klonuj z `--depth 1`. Nie czytaj `index.html`, `build.mjs` ani stron statycznych, chyba że coś nie działa.
- Podsumowanie końcowe krótkie: tytuły z sekcjami i liczbą źródeł, odrzucone tematy jednym zdaniem.

## Format
```
nowe.json = { "date": "RRRR-MM-DD", "slot": "7:00"|"15:00", "ryby": [news], "luz": [news], "czapy": [news] }
news = { region: "pl"|"world", published: "RRRR-MM-DD", who, initials, category, hype (1-5),
         title, summary, body: ["akapit", ...], sources: [{name, url, origin?: true}], embed?,
         caption?: {credit: "Autor / Platforma", text: "komentarz"},
         image?: {kind: "kadr"|"prasowe", src, fallback?, credit, href, alt, caption} }
```
- Sekcje: `ryby` (Grube ryby: duży temat z analizą, raz na kilka dni, TYLKO po akceptacji Filipa), `luz` (Na luzie: lżejsze newsy o twórcach z listy), `czapy` (Z czapy: krótkie, nieoczywiste ciekawostki w stylu dropsy.news). Klucze `drama` i `drop` są tylko w starych wydaniach.
- `summary` = 2–3 zdania na karcie. `body` = 3–5 akapitów, tylko fakty potwierdzone w źródłach, bez spekulacji.
- `embed` = link do KONKRETNEGO posta/filmu (instagram.com/p/… lub /reel/…, tiktok.com/@konto/video/…, x.com/konto/status/…, youtube.com/watch?v=… lub /shorts/…), nie do profilu. Bez `embed` strona osadzi pierwszy taki link ze źródeł (najpierw `origin: true`).
- Pole `slot` dopisuje skrypt. Popołudniowe newsy lądują na początku sekcji. Pierwszy news pierwszej niepustej sekcji (ryby → luz → czapy) jest tematem dnia.
- `pinUntil: "RRRR-MM-DD"` (opcjonalne, tylko na prośbę Filipa): news jest tematem dnia na stronie głównej od swojej daty do tej daty włącznie, także nad wydaniami z kolejnych dni. Grube ryby nie liczą się do limitu zagranicy.

## Zasady redakcyjne
- Profil: rzetelne newsy i analizy w duchu kanałów komentatorskich, nie plotkarski portal. Bez shitpostów poza Z czapy.

### Profil tematyczny (od 16.10.2026, decyzja Filipa)
Czytelnik to dorosły (ok. 20–35 lat), nie dziecko ani młody nastolatek. Wybierając tematy z digestu, kieruj się tym, co obchodzi dorosłego widza, a nie samą liczbą wyświetleń.
- **Priorytet: życiowy content twórców.** Zaręczyny, śluby, przeprowadzki, nowe etapy w życiu, własne biznesy i marki, książki, podcasty, trasy, programy TV, akcje charytatywne, duże podróże, osiągnięcia, zmiany w karierze, oświadczenia twórców we własnej sprawie (np. odpowiedź twórcy na to, co o nim mówiono). Przykłady w duchu Hypers: zaręczyny Gimpera, odpowiedź Fagaty.
- **Prywatne wydarzenia tylko z ogłoszenia samego twórcy** (`origin: true`): nie ogłaszamy niczego za twórcę (ciąża, rozstanie, zdrowie) na podstawie plotek.
- **Bez wojenek.** Konflikty i beefy między twórcami, diss tracki, trash talk przed galami, wzajemne docinki, „X odpowiada Y”, gdy chodzi o kłótnię, nie trafiają do Na luzie ani Z czapy. Duży, ważny konflikt może być co najwyżej propozycją Grubej ryby w podsumowaniu (decyduje Filip).
- **Mniej gamingu.** Sam nowy odcinek gry, aktualizacja, stream czy wynik w grze to nie news. Gaming tylko gdy wychodzi poza grę (rekord, duży turniej, nowy projekt, zmiana w karierze). Maks. 2 takie newsy dziennie.
- **Bez treści dla najmłodszych.** Challenge'e, pranki, unboxingi zabawek i formaty pod dzieci pomijamy, nawet gdy są popularne.
- Gdy po tych zasadach zostaje mniej tematów, publikuj mniej newsów: lepsze 4 dobre niż 7 na siłę.
- Obserwowani twórcy: `sources/creators.yml` w prywatnym repo FYlapeq/hypers-data (grupy lista, top100, streamer, zagranica). Tematy spoza listy tylko wyjątkowo.
- Dane: zbieracz (GitHub Actions w prywatnym hypers-data) zapisuje `runs/RRRR-MM-DD-<rano|popoludnie>.json` i kopiuje cały katalog `runs/` na gałąź `zbieracz` tego repo. Sesja bez dostępu do hypers-data czyta stamtąd: `git fetch --depth 1 origin +zbieracz:refs/remotes/origin/zbieracz` (sam `git fetch origin zbieracz` w płytkim klonie nie tworzy origin/zbieracz) i `git show origin/zbieracz:runs/<plik>`. Nie commituj nic na gałąź `zbieracz`. Harmonogram GitHuba (5:45 i 13:45) bywa spóźniony o godziny, więc gdy pliku na dziś nie ma, uruchom zbieracza sam: `gh api -X POST repos/FYlapeq/hypers/actions/workflows/uruchom-zbieracza.yml/dispatches -f ref=main -f 'inputs[slot]=<rano|popoludnie>'` i sprawdzaj gałąź co 2 minuty do 12 minut. Używaj tylko pliku z dzisiejszą datą i własnym slotem (rano dla 7:00, popoludnie dla 15:00). Plik z innego slotu albo dnia nie zastępuje uruchomienia zbieracza. `status` mówi, czy brak danych to awaria. Brak pliku lub pusty YouTube: wydanie z researchu w sieci i 3 źródła dla wszystkiego.
- Cel ok. 15 newsów dziennie: ok. 7 rano (7:00), ok. 8 po południu (15:00). To cel, nie przymus: lepiej krótsze wydanie niż słabe tematy. Zagranica (`world`) maks. 3 dziennie.
- Świeżość: Na luzie i Z czapy z ostatnich 48 godzin. Sprawdzaj datę każdego źródła (otwierając je, nie z wyników wyszukiwania).
- Źródła: w Na luzie i Z czapy wystarczy oryginał twórcy z API (`origin: true`), gdy news dotyczy tego, co twórca sam pokazał lub powiedział. Wszystko o innych osobach (zarzuty, konflikty) i Grube ryby: min. 3 niezależne źródła. Gdy się da, potwierdź u twórcy lub marki (`origin: true`).
- Żadnych niepotwierdzonych zarzutów wobec konkretnych osób (przemoc, przestępstwa, zdrowie itp.).
- Bez napisów nie opisujemy, co pada w filmie: tylko tytuł, opis, statystyki i reakcje widzów (parafrazowane, bez nicków). Statystyki podajemy z godziną odczytu.
- Grube ryby: analiza tego, co publicznie wiadomo, z oddzieleniem faktów, cudzych zarzutów i komentarza. Szkic trafia najpierw do Filipa; publikacja dopiero po akceptacji.
- Piszemy własnymi słowami po polsku, bez kopiowania tekstów.
- `caption` przy każdym newsie z osadzonym materiałem lub zdjęciem: `text` = 2–3 zdania własnego komentarza (co widać w materiale i jak łączy się z tematem; cel cytatu, nie ozdobnik), tylko fakty. `credit` = autor i platforma, np. „Książulo / YouTube”.

## Zdjęcia
- Konkretne, nie ilustracyjne. Każde musi mieć podstawę prawną, inaczej bez `image`, tylko `embed` oryginalnego posta.
  1. `kadr`: miniatura omawianego filmu YouTube (prawo cytatu, art. 29). `src` = `https://i.ytimg.com/vi/ID/maxresdefault.jpg`, `fallback` = `…/hqdefault.jpg`, `credit` = „Twórca / YouTube”. Tekst i `caption` muszą faktycznie omawiać ten film.
  2. `prasowe`: zdjęcie z newsroomu marki, tylko gdy newsroom wprost zezwala mediom (np. news.adidas.com). Nigdy ze sklepu marki ani od sklepów/portali. `credit` = „materiały prasowe Marka”, `href` = strona w newsroomie. Nowy newsroom: najpierw sprawdź warunki.
  3. Zgoda twórcy.
- Bez kadrów pokazujących dzieci; w takich newsach tylko `embed`.
- `edition.mjs add` odrzuca news bez `image`. Gdy legalnego zdjęcia naprawdę nie ma (dziecko w kadrze, brak filmu/newsroomu), dodaj `embed` oryginalnego posta i pole `noImage` z krótkim powodem. Najpierw szukaj: film twórcy na YouTube (kadr), oficjalny post programu/marki (embed).
- Obrazy tylko z i.ytimg.com i newsroomów marek (punkt 4 polityki prywatności). Nowe źródło obrazów = najpierw dopisz je do polityki.
- Nigdy: zdjęcia z portali, agencji, Google Grafika, repostów; obrazy AI z prawdziwymi osobami. Nie pobieraj plików do repo.

## Publikacja
1. `node scripts/edition.mjs add nowe.json` (dopisuje i uruchamia `scripts/build.mjs`). Nie commituj `nowe.json`.
2. Commit `Wydanie RRRR-MM-DD` (popołudniu: `Wydanie RRRR-MM-DD 15:00`) z wygenerowanymi plikami, push na `main`. Przed pushem `git pull --rebase`, bo bot mógł dopisać commit.

## Strony artykułów
- Każdy news ma stronę `artykuly/RRRR-MM-DD/<slug>.html` generowaną przez `scripts/build.mjs` razem z `archiwum.html`, `sitemap.xml` i `data/urls.js`. Nie edytuj ich ręcznie.
- Slug powstaje z tytułu. Po publikacji nie zmieniaj adresu: poprawiając tytuł, dodaj pole `slug` ze starym tytułem.
- Workflow `.github/workflows/build-articles.yml` przebudowuje strony po pushu zmieniającym `data/editions.js`.

## Instagram
- Workflow `.github/workflows/instagram.yml` sam wrzuca na IG jeden news (karta + treść) o godzinach z `instagram/harmonogram.json` (od 7:00 co 2 h), wybierając najświeższy nieopublikowany. Sesja wydania nic tu nie robi.
- Post wychodzi tylko z oryginalną miniaturą filmu z pola `image`; news z `noImage` nie trafi na IG.
- Treść posta = `title` + `body` + nazwy źródeł, więc to, co piszesz w newsie, idzie 1:1 na Instagram. Kadr w tle karty tylko z pola `image` (te same zasady co na stronie).
- Gałąź `instagram` należy do automatu: nie commituj na nią i nie czytaj jej. Szczegóły: `instagram/README.md`.
