# Hypers: codzienne wydanie

Strona statyczna (GitHub Pages z gałęzi `main`, domena hypers.tech w `CNAME`). Newsy w `data/editions.js` (`window.HYPERS_EDITIONS`, klucz = data `RRRR-MM-DD`, czas Europe/Warsaw). Cudzych zdjęć nie hostujemy: obrazy są wczytywane ze źródła (hotlink), a w artykule osadzany jest oryginalny post twórcy.

## GitHub Actions: twarde zasady (po blokadzie konta 17.10.2026)
- Workflow nigdy nie uruchamia innego workflow ani samego siebie (żadnych `dispatches` z jobów, żadnych łańcuchów, `sleep` do godziny ani jobów trwających dłużej niż kilka minut). Pętla trybu „zegar” w nocy 16/17.10 (99 samouruchomień w 80 min) najpewniej spowodowała blokadę konta.
- Każdy job ma `timeout-minutes`. Nowy cron częściej niż raz na godzinę tylko po zgodzie Filipa.
- Sesja wydania uruchamia ręcznie najwyżej po jednym przebiegu zbieracza i zbieracza ciekawostek na slot. Nie ponawiaj w pętli: przy braku danych zrób research w sieci.

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
nowe.json = { "date": "RRRR-MM-DD", "slot": "7:00"|"15:00", "ryby": [news], "luz": [news], "ciekawostki": [news] }
news = { region: "pl"|"world", published: "RRRR-MM-DD", who, initials, category, hype (1-5),
         title, summary, body: ["akapit", ...], sources: [{name, url, origin?: true}], embed?,
         caption?: {credit: "Autor / Platforma", text: "komentarz"}, ig?: ["konto_ig", ...],
         image?: {kind: "kadr"|"prasowe"|"wolne", src, fallback?, credit, href, alt, caption} }
```
- Sekcje: `ryby` (Grube ryby: duży temat z analizą, raz na kilka dni, TYLKO po akceptacji Filipa), `luz` (Na luzie: wszystkie newsy o twórcach, dłuższe i krótkie w stylu dropsy.news; od 16.10.2026 obejmuje dawne Z czapy), `ciekawostki` (Ciekawostki: krótkie, niszowe fakty z całego internetu, nie o twórcach, patrz niżej). Klucz `czapy` już nie istnieje (stare newsy przeniesione do `luz`); `drama` i `drop` są tylko w starych wydaniach.
- `summary` = 2–3 zdania na karcie. `body` = 3–5 akapitów, tylko fakty potwierdzone w źródłach, bez spekulacji.
- `embed` = link do KONKRETNEGO posta/filmu (instagram.com/p/… lub /reel/…, tiktok.com/@konto/video/…, x.com/konto/status/…, youtube.com/watch?v=… lub /shorts/…), nie do profilu. Bez `embed` strona osadzi pierwszy taki link ze źródeł (najpierw `origin: true`).
- Pole `slot` dopisuje skrypt. Popołudniowe newsy lądują na początku sekcji. Tematem dnia jest pierwszy news ze zdjęciem w ryby, potem luz (Ciekawostki nie są tematem dnia).
- `pinUntil: "RRRR-MM-DD"` (opcjonalne, tylko na prośbę Filipa): news jest tematem dnia na stronie głównej od swojej daty do tej daty włącznie, także nad wydaniami z kolejnych dni. Grube ryby nie liczą się do limitu zagranicy.

## Zasady redakcyjne
- Profil: rzetelne newsy i analizy w duchu kanałów komentatorskich, nie plotkarski portal. Bez shitpostów (krótkie, luźne newsy o twórcach są OK w Na luzie).

### Profil tematyczny (od 16.10.2026, decyzja Filipa)
Czytelnik to dorosły (ok. 20–35 lat), nie dziecko ani młody nastolatek. Wybierając tematy z digestu, kieruj się tym, co obchodzi dorosłego widza, a nie samą liczbą wyświetleń.
- **Priorytet: życiowy content twórców.** Zaręczyny, śluby, przeprowadzki, nowe etapy w życiu, własne biznesy i marki, książki, podcasty, trasy, programy TV, akcje charytatywne, duże podróże, osiągnięcia, zmiany w karierze, oświadczenia twórców we własnej sprawie (np. odpowiedź twórcy na to, co o nim mówiono). Przykłady w duchu Hypers: zaręczyny Gimpera, odpowiedź Fagaty.
- **Prywatne wydarzenia tylko z ogłoszenia samego twórcy** (`origin: true`): nie ogłaszamy niczego za twórcę (ciąża, rozstanie, zdrowie) na podstawie plotek.
- **Beefy i spiny są OK.** Konflikty między twórcami, diss tracki, trash talk przed galami i odpowiedzi jednych na drugich mogą trafiać do Na luzie. Zawsze z zasadą 3 źródeł (to temat o innych osobach), z oddzieleniem faktów od tego, co kto twierdzi, bez stawania po żadnej stronie i bez niepotwierdzonych zarzutów.
- **Polityka i kontrowersje w umiarkowanej dawce** (ok. 1–2 dziennie). Gdy dotyczą twórców lub internetu: twórca komentuje politykę lub prawo, polityk u influencera, kontrowersyjny materiał, który wywołał dyskusję, sprawy regulacji platform. Pisane neutralnie: kto co powiedział, z jakimi argumentami obu stron, bez opinii Hypers. 3 źródła. Przemoc i tragedie dalej nie trafiają do Na luzie ani Ciekawostek.
- **Mniej gamingu.** Sam nowy odcinek gry, aktualizacja, stream czy wynik w grze to nie news. Gaming tylko gdy wychodzi poza grę (rekord, duży turniej, nowy projekt, zmiana w karierze). Maks. 2 takie newsy dziennie.
- **Bez treści stricte dla dzieci.** Roblox, Minecraft dla najmłodszych, challenge'e, pranki, unboxingi zabawek i inne formaty pod dzieci pomijamy, nawet gdy są popularne. `edition.mjs add` odrzuca newsy ze słowami z listy `bez_dla_dzieci` w `instagram/harmonogram.json` (ta sama lista co dla IG).
- Gdy po tych zasadach zostaje mniej tematów, publikuj mniej newsów: lepsze 4 dobre niż 7 na siłę.
- Obserwowani twórcy: `sources/creators.yml` w prywatnym repo FYlapeq/hypers-data (grupy lista, top100, streamer, zagranica). Tematy spoza listy tylko wyjątkowo.
- Dane: zbieracz (GitHub Actions w prywatnym hypers-data) zapisuje `runs/RRRR-MM-DD-<rano|popoludnie>.json` i kopiuje cały katalog `runs/` na gałąź `zbieracz` tego repo. Sesja bez dostępu do hypers-data czyta stamtąd: `git fetch --depth 1 origin +zbieracz:refs/remotes/origin/zbieracz` (sam `git fetch origin zbieracz` w płytkim klonie nie tworzy origin/zbieracz) i `git show origin/zbieracz:runs/<plik>`. Nie commituj nic na gałąź `zbieracz`. Zbieracz nie ma już harmonogramu (od 11.2026, ograniczenie użycia Actions), więc gdy pliku na dziś nie ma, uruchom go sam: `gh api -X POST repos/FYlapeq/hypers/actions/workflows/uruchom-zbieracza.yml/dispatches -f ref=main -f 'inputs[slot]=<rano|popoludnie>'` i sprawdzaj gałąź co 2 minuty do 12 minut. Używaj tylko pliku z dzisiejszą datą i własnym slotem (rano dla 7:00, popoludnie dla 15:00). Plik z innego slotu albo dnia nie zastępuje uruchomienia zbieracza. `status` mówi, czy brak danych to awaria. Brak pliku lub pusty YouTube: wydanie z researchu w sieci i 3 źródła dla wszystkiego.
- Cel ok. 26 newsów dziennie: w każdym slocie (7:00 i 15:00) ok. 8 w Na luzie i ok. 5 Ciekawostek. To cel, nie przymus: lepiej krótsze wydanie niż słabe tematy. Zagranica (`world`) w Na luzie maks. 3 dziennie (Ciekawostek i Grubych ryb nie liczymy).
- Minimum dla Instagrama (to już przymus): każdy slot musi dać co najmniej 8 newsów ze zdjęciem (`image`, razem Na luzie i Ciekawostki), bo IG wrzuca co godzinę (8:00–23:00) karuzelę z 3 newsów albo 3 ciekawostek na zmianę. Gdy w Na luzie brakuje tematów ze zdjęciem, najpierw dobierz więcej Ciekawostek (do 8 w slocie, zbieracz ma ich setki), potem rozszerz research: `digest <plik> 150`, starsze filmy z 48 h, twórcy spoza listy z dużym zasięgiem i inne strony (portale, X, TikTok, Instagram), zawsze z zasadami źródeł i zdjęć.
- Świeżość: Na luzie z ostatnich 48 godzin. Sprawdzaj datę każdego źródła (otwierając je, nie z wyników wyszukiwania).
- Źródła: w Na luzie wystarczy oryginał twórcy z API (`origin: true`), gdy news dotyczy tego, co twórca sam pokazał lub powiedział. Wszystko o innych osobach (zarzuty, konflikty) i Grube ryby: min. 3 niezależne źródła. Gdy się da, potwierdź u twórcy lub marki (`origin: true`).
- Żadnych niepotwierdzonych zarzutów wobec konkretnych osób (przemoc, przestępstwa, zdrowie itp.).
- Bez napisów nie opisujemy, co pada w filmie: tylko tytuł, opis, statystyki i reakcje widzów (parafrazowane, bez nicków). Statystyki podajemy z godziną odczytu.
- Grube ryby: analiza tego, co publicznie wiadomo, z oddzieleniem faktów, cudzych zarzutów i komentarza. Szkic trafia najpierw do Filipa; publikacja dopiero po akceptacji.
- Piszemy własnymi słowami po polsku, bez kopiowania tekstów.
- `caption` przy każdym newsie z osadzonym materiałem lub zdjęciem: `text` = 2–3 zdania własnego komentarza (co widać w materiale i jak łączy się z tematem; cel cytatu, nie ozdobnik), tylko fakty. `credit` = autor i platforma, np. „Książulo / YouTube”.

## Ciekawostki
- Krótkie, niszowe fakty, które dają „wow” w kilka sekund (np. najpopularniejsza pizza w Szwecji to pizza z kebabem). Z całego internetu i każdej dziedziny: jedzenie, historia, przyroda, kosmos, technologia, kraje, rekordy, język, ludzkie ciało. Nie o twórcach (to Na luzie) i nie newsy dnia.
- Dane: zbieracz ciekawostek (`.github/workflows/zbieracz-ciekawostek.yml`, skrypt `scripts/zbieracz-ciekawostek.mjs`) zapisuje `runs/RRRR-MM-DD-<rano|popoludnie>.json` na gałęzi `ciekawostki`. Pobierz: `git fetch --depth 1 origin +ciekawostki:refs/remotes/origin/ciekawostki` i `git show origin/ciekawostki:runs/<plik>`. Gdy pliku nie ma, uruchom: `gh api -X POST repos/FYlapeq/hypers/actions/workflows/zbieracz-ciekawostek.yml/dispatches -f ref=main -f 'inputs[slot]=<rano|popoludnie>'` i sprawdzaj co 2 minuty do 10 minut. Skrót: `node scripts/edition.mjs ciekawostki <plik>`, szczegóły jednego: `ciekawostka <plik> <id>`. Zbieracz sam sprawdza drugie źródło (przypisy artykułu Wikipedii zawierające słowa i liczby z faktu): kandydaci oznaczeni `GOTOWE` mają je w `second_source`, a `ciekawostka` wypisuje `szkic` z gotowymi `sources` i `image` do wklejenia (uzupełnij tylko `alt` i `caption`). Wybieraj najpierw GOTOWE i nie rób dla nich WebFetch ani wyszukiwań; ręcznie szukaj źródła tylko dla świetnego kandydata bez GOTOWE. Kandydaci: Wikipedia „Czy wiesz” PL, „Did you know” i „Unusual articles” EN (gotowe zdjęcie z Commons z autorem i licencją), RSS serwisów z ciekawostkami (bez zdjęcia: poszukaj go sam). Nie commituj na gałąź `ciekawostki`. Bez danych: research w sieci (WebSearch), te same zasady.
- Wybór: najbardziej zaskakujące i zrozumiałe bez kontekstu. Pomijaj nudne, zbyt specjalistyczne, o polityce bieżącej, przemocy, tragediach i chorobach. Nie powtarzaj tematów (skrypt sprawdza artykuły Wikipedii i linki).
- Format: `title` = sama ciekawostka jednym zdaniem, maks. 110 znaków (to ona ma przyciągać). `summary` = 1–2 zdania. `body` = 1–2 krótkie akapity z kontekstem. `who` = temat (np. „Szwecja”, „Kosmos”), `category` = dziedzina, `published` = data wydania, `region` = `pl` gdy dotyczy Polski, inaczej `world`.
- Źródła: min. 2 niezależne. Artykuł Wikipedii to jedno; drugie to źródło, na które powołuje się Wikipedia, albo inna rzetelna strona (WebFetch: potwierdź konkretny fakt, liczby i daty). Jeśli fakt się nie potwierdza albo jest nieaktualny, odrzuć. Liczby tylko te, które są w źródłach.
- Grafika obowiązkowa i ściśle związana z faktem (pokazuje dokładnie to, o czym jest ciekawostka, nie ogólny klimat). Bez pasującej legalnej grafiki ciekawostka nie wchodzi. Najpierw zdjęcie z kandydata (`image`), a gdy pasuje słabo, szukaj lepszego pliku na Wikimedia Commons (strona pliku pokazuje autora i licencję).

## Zdjęcia
- Konkretne, nie ilustracyjne. Każde musi mieć podstawę prawną, inaczej bez `image`, tylko `embed` oryginalnego posta.
  1. `kadr`: miniatura omawianego filmu YouTube (prawo cytatu, art. 29). `src` = `https://i.ytimg.com/vi/ID/maxresdefault.jpg`, `fallback` = `…/hqdefault.jpg`, `credit` = „Twórca / YouTube”. Tekst i `caption` muszą faktycznie omawiać ten film.
  2. `prasowe`: zdjęcie z newsroomu marki, tylko gdy newsroom wprost zezwala mediom (np. news.adidas.com). Nigdy ze sklepu marki ani od sklepów/portali. `credit` = „materiały prasowe Marka”, `href` = strona w newsroomie. Nowy newsroom: najpierw sprawdź warunki.
  3. `wolne`: plik z Wikimedia Commons na wolnej licencji (CC0, domena publiczna, CC BY, CC BY-SA), głównie do Ciekawostek. `src` = `https://upload.wikimedia.org/wikipedia/commons/…` (miniatura 1280 px z kandydata albo `thumburl`), `href` = strona pliku `https://commons.wikimedia.org/wiki/File:…`, `credit` = „Autor / Wikimedia Commons, licencja”, np. „Jan Kowalski / Wikimedia Commons, CC BY-SA 4.0” (licencja i autor dokładnie ze strony pliku). Nigdy plików z en.wikipedia.org/upload bez Commons (często niewolne, „fair use”).
  4. Zgoda twórcy.
- Bez kadrów pokazujących dzieci; w takich newsach tylko `embed`.
- `edition.mjs add` odrzuca news bez `image`. Gdy legalnego zdjęcia naprawdę nie ma (dziecko w kadrze, brak filmu/newsroomu), dodaj `embed` oryginalnego posta i pole `noImage` z krótkim powodem. Najpierw szukaj: film twórcy na YouTube (kadr), oficjalny post programu/marki (embed).
- Obrazy tylko z i.ytimg.com, upload.wikimedia.org (Commons) i newsroomów marek (punkt 4 polityki prywatności). Nowe źródło obrazów = najpierw dopisz je do polityki.
- Nigdy: zdjęcia z portali, agencji, Google Grafika, repostów; obrazy AI z prawdziwymi osobami. Nie pobieraj plików do repo.

## Sesja wydania (zadania 7:00 i 15:00)
Slot `rano` = 7:00, `popoludnie` = 15:00. Pracujesz bez nadzoru: bez pytań, decydujesz sam; kończysz dopiero po pushu, chyba że wydanie slotu już jest albo coś naprawdę blokuje (wtedy w podsumowaniu: krok i błąd).
1. `node scripts/edition.mjs recent 3`. Jeśli wydanie tego slotu już jest (7:00: klucz z dzisiejszą datą w `data/urls.js`; 15:00: commit „Wydanie RRRR-MM-DD 15:00” w `git log`), zakończ bez zmian. Wcześniejszych tematów nie powtarzaj.
2. Dane twórców i ciekawostek: sekcje „Zasady redakcyjne” (Dane) i „Ciekawostki” niżej. Zapisuj pliki do scratchpadu, czytaj tylko skrótami (`digest <plik> 80`, `ciekawostki <plik>`). Brak danych nigdy nie blokuje publikacji: wtedy research w sieci i informacja w podsumowaniu.
3. Ok. 8 newsów do `luz` i ok. 5 do `ciekawostki`, razem min. 8 ze zdjęciem. Nic w `ryby`: gruby temat tylko jako propozycja w podsumowaniu.
4. `nowe.json` = {"date","slot","luz","ciekawostki"}, `add`, commit i push (sekcja „Publikacja”), sprawdź `git log origin/main -1`.
5. Podsumowanie krótkie: skąd dane (o czasie / uruchomiony zbieracz / research i dlaczego, osobno ciekawostki), tytuły z sekcją, liczbą źródeł i zdjęciem, ile ze zdjęciem idzie na IG, odrzucone tematy po jednym zdaniu, propozycje grubych ryb, pozycje „DO SPRAWDZENIA” ze zbieracza.

## Publikacja
1. `node scripts/edition.mjs add nowe.json` (dopisuje i uruchamia `scripts/build.mjs`). Nie commituj `nowe.json`.
2. Commit `Wydanie RRRR-MM-DD` (popołudniu: `Wydanie RRRR-MM-DD 15:00`) z wygenerowanymi plikami, push na `main`. Przed pushem `git pull --rebase`, bo bot mógł dopisać commit.

## Strony artykułów
- Każdy news ma stronę `artykuly/RRRR-MM-DD/<slug>.html` generowaną przez `scripts/build.mjs` razem z `archiwum.html`, `sitemap.xml` i `data/urls.js`. Build wstawia też najnowsze wydanie do `index.html` między znaczniki `<!-- wydanie… -->` (statyczny HTML dla Google i podglądów linków). Nie edytuj tych miejsc ręcznie i commituj `index.html` razem z wydaniem.
- Usunięcie pojedynczego newsa (np. niezgodnego z profilem): `node scripts/edition.mjs drop RRRR-MM-DD <sekcja> "fragment tytułu"` (usuwa i przebudowuje).
- Slug powstaje z tytułu. Po publikacji nie zmieniaj adresu: poprawiając tytuł, dodaj pole `slug` ze starym tytułem.
- Workflow `.github/workflows/build-articles.yml` przebudowuje strony po pushu zmieniającym `data/editions.js`.

## Instagram
- Workflow `.github/workflows/instagram.yml` (krótki przebieg raz na godzinę, wywoływany o 8:01–23:01 przez zaplanowane zadanie Claude „Hypers – post na Instagram”; bez czekających jobów) sam wrzuca na IG karuzele co godzinę (godziny z `instagram/harmonogram.json`, 8:00–23:00): 3 slajdy (newsy o twórcach albo ciekawostki, na zmianę) + slajd „Zostaw follow”, wybierając najświeższe nieopublikowane. Sesja wydania nic tu nie robi.
- Treści dla dzieci nie idą na IG: automat pomija newsy ze słowami z `bez_dla_dzieci` w `instagram/harmonogram.json` (Roblox, Minecraft, Brawl Stars, Brainrot…), a pojedyncze artykuły można wykluczyć ścieżką w `wykluczone`.
- Post wychodzi tylko z prawdziwym obrazem z pola `image` (kadr, prasowe albo wolne z Commons dla Ciekawostek); news z `noImage` nie trafi na IG.
- Oznaczanie twórców (od 16.10.2026): każdy news o twórcy/osobie dostaje pole `ig` = konta Instagram osób z `who` (bez @, małe litery, np. `["ksiazulo"]`). Automat dopisuje @konto przy tytule w opisie i oznacza je na slajdzie. Konto bierz tylko z pewnego miejsca: link z kanału YouTube twórcy, jego strony, posta będącego źródłem albo zweryfikowanego profilu; przy wątpliwości (fan-konto, podobne nazwy) pomiń pole, nigdy nie zgaduj. Nowo potwierdzone konto dopisz też do `instagram/konta.json` (`"Nazwa jak w who": "konto"`), żeby kolejne newsy oznaczały się same. Ciekawostki i marki bez konta osoby: bez `ig`.
- Opis karuzeli = numerowane `title` + `summary` każdego newsa + nazwy źródeł, więc to, co piszesz w newsie, idzie 1:1 na Instagram. Kadr w tle karty tylko z pola `image` (te same zasady co na stronie).
- Gałąź `instagram` należy do automatu: nie commituj na nią i nie czytaj jej. Szczegóły: `instagram/README.md`.
