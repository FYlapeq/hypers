# Hypers: codzienne wydanie

Strona statyczna (GitHub Pages z gałęzi `main`, domena hypers.tech w pliku `CNAME`). Newsy w `data/editions.js` (`window.HYPERS_EDITIONS`, klucz = data `RRRR-MM-DD`, czas Europe/Warsaw). Strona nie hostuje cudzych zdjęć na swoim serwerze: obrazy są wczytywane bezpośrednio ze źródła (hotlink), a w artykule osadzany jest oryginalny post twórcy (Instagram, TikTok, X, YouTube).

## Format wydania
```
"RRRR-MM-DD": {
  "date": "RRRR-MM-DD",
  "ryby":  [ news ],   // Grube ryby: duży temat (analiza, kontekst), raz na kilka dni, TYLKO po akceptacji Filipa
  "luz":   [ news ],   // Na luzie: 2 lżejsze newsy o twórcach z listy
  "czapy": [ news ]    // Z czapy: krótkie, nieoczywiste ciekawostki ze świata twórców (styl dropsy.news)
}
// Od 2026-10-12 nowe wydania używają ryby/luz/czapy. Klucze "drama" i "drop" zostają tylko w starych wydaniach (archiwum).
news = { region: "pl"|"world", published: "RRRR-MM-DD", slot?: "7:00"|"15:00", who, initials, category, hype (1-5),
         title, summary, body: ["akapit", ...], sources: [{name, url, origin?: true}], embed?,
         caption?: {credit: "Autor / Platforma", text: "komentarz"},
         image?: {kind: "kadr"|"ilustracja"|"prasowe", src, fallback?, credit, href, alt, caption} }
```
`summary` = 2–3 zdania na karcie. `body` = pełny artykuł (3–5 akapitów) widoczny po kliknięciu karty, tylko z faktów potwierdzonych w źródłach, bez spekulacji.
`embed` = link do KONKRETNEGO posta/filmu twórcy (instagram.com/p/… lub /reel/…, tiktok.com/@konto/video/…, x.com/konto/status/…, youtube.com/watch?v=… lub /shorts/…). Profil (np. instagram.com/konto/) się nie osadzi. Bez `embed` strona sama osadzi pierwszy taki link ze źródeł (najpierw `origin: true`).
Pierwszy news z pierwszej niepustej sekcji (ryby → drama → luz → czapy → drop) jest tematem dnia na górze strony.

## Zasady od 2026-10-12 (mają pierwszeństwo przed starszymi punktami niżej)
- Profil: nie plotkarski portal, tylko rzetelne newsy i analizy w duchu kanałów komentatorskich. Bez shitpostów poza sekcją Z czapy.
- Obserwowani twórcy: lista w prywatnym repo FYlapeq/hypers-data (`sources/creators.yml`): grupy lista, top100 (PL), streamer, zagranica (top 50 prawdziwych twórców świata). Tematy spoza listy tylko wyjątkowo.
- Dane: zbieracz (GitHub Actions w hypers-data) o 5:45 i 13:45 zapisuje `runs/RRRR-MM-DD-<rano|popoludnie>.json` z nowymi filmami (tytuł, opis, statystyki, top komentarze bez nicków, opcjonalnie napisy) i streamami. Redakcja startuje od najnowszego pliku; `status` mówi, czy brak danych to awaria. Przebieg można wymusić commitem pliku `trigger/force_slot` (treść: rano|popoludnie).
- Cel ok. 15 newsów dziennie: 7 w porcji porannej (7:00), 8 w popołudniowej (15:00). Cel, nie przymus: bez dopychania słabych tematów. Zagranica (region "world") maks. 3 dziennie.
- Popołudniowe newsy dopisujemy NA POCZĄTEK list sekcji wydania danego dnia z polem `slot: "15:00"` (poranne: `slot: "7:00"` lub bez pola).
- Źródła: w Na luzie i Z czapy wystarczy oryginał twórcy z API (`origin: true`), gdy news dotyczy tego, co twórca sam pokazał lub powiedział. Wszystko o innych osobach (zarzuty, konflikty) i Grube ryby: min. 3 niezależne źródła.
- Bez napisów nie opisujemy, co pada w filmie: tylko tytuł, opis, statystyki i reakcje widzów (parafrazowane, bez nicków). Statystyki podajemy z godziną odczytu.
- Na luzie i Z czapy: z ostatnich 48 godzin.
- Grube ryby: analiza tego, co publicznie wiadomo, z oddzieleniem faktów, cudzych zarzutów i komentarza. Szkic trafia najpierw do Filipa; publikacja dopiero po jego akceptacji.
- Zdjęcia: konkretne, nie ilustracyjne. Każde musi mieć podstawę: `prasowe` (newsroom zezwala mediom), zgoda twórcy, albo `kadr` jako cytat (tekst i `caption` faktycznie omawiają materiał, pełne oznaczenie autora). Gdy żadna podstawa nie wchodzi w grę: bez `image`, tylko `embed` oryginalnego posta. Nie używamy już `ilustracja`.
- Nie używamy kadrów pokazujących dzieci; w takich newsach tylko `embed`.
- Nie ma minimum 5 newsów dziennie: lepiej krótsze wydanie niż obniżona poprzeczka.

## Zasady redakcyjne (obowiązkowe)
- Drama: tylko newsy opublikowane w dniu wydania. Na luzie i Dropy: z ostatnich 48 godzin.
- Każdy news potwierdzony w min. 3 niezależnych źródłach; sprawdź datę publikacji każdego źródła.
- Gdy się da, potwierdź u samego twórcy/marki (YouTube, X, oficjalna strona, newsroom) i oznacz `origin: true`.
- Żadnych niepotwierdzonych zarzutów wobec konkretnych osób (przemoc, przestępstwa, sprawy zdrowotne itp.).
- Piszemy własnymi słowami po polsku, bez kopiowania tekstów.
- Razem min. 5 newsów dziennie. Jeśli sekcja nie ma newsów spełniających zasady, zostaje krótsza; nie obniżamy poprzeczki.
- Podpis (`caption`): przy każdym newsie z osadzonym materiałem dodaj `caption`. `text` = 2–3 zdania własnego komentarza: co widać w materiale i jak łączy się z tematem artykułu (cel komentarza/cytatu, nie ozdobnik). Tylko fakty z materiału lub źródeł. `credit` = autor i platforma, np. „Książulo / YouTube”. Strona pokazuje pod materiałem podpis, autora i link do oryginału.
- Dropy: najpierw `prasowe`, czyli oryginalne zdjęcie produktu z newsroomu marki, ale tylko gdy newsroom wprost zezwala mediom na użycie (np. news.adidas.com: treści wolne od opłat do celów redakcyjnych). Nigdy zdjęcia ze sklepu marki (adidas.com, nike.com itp.) ani od sklepów/portali. `credit` = „materiały prasowe Marka”, `href` = strona materiału w newsroomie, `caption` = co pokazuje zdjęcie (model, kolorystyka). Przed użyciem nowego newsroomu sprawdź jego warunki; marki bez takiego newsroomu (np. Vans) → kolejne opcje poniżej.
- Zdjęcia są priorytetem: KAŻDY news ma mieć `image` (pokazywane na karcie i na górze artykułu). Kolejność wyboru:
  1. `kadr`: miniatura filmu YouTube omawianego w artykule (prawo cytatu, art. 29). `src` = `https://i.ytimg.com/vi/ID/maxresdefault.jpg`, `fallback` = `.../hqdefault.jpg`. Pisz newsa tak, żeby tekst faktycznie omawiał ten film, a `caption` = 2–3 zdania komentarza, czym jest ten materiał i jak łączy się z tematem. `credit` = „Twórca / YouTube”.
  2. `prasowe`: zdjęcie z newsroomu/press kitu marki, tylko gdy strona wprost pozwala mediom go używać.
  3. `ilustracja`: luźno powiązane darmowe zdjęcie z Unsplash (tylko darmowe images.unsplash.com, nie Unsplash+), `credit` = „Autor / Unsplash (licencja Unsplash)”, `href` = strona zdjęcia. `caption` MUSI zaczynać się od „Zdjęcie ilustracyjne.” i mówić, czego NIE przedstawia, żeby nie wprowadzać w błąd.
- Obrazy wczytujemy tylko z i.ytimg.com, images.unsplash.com i newsroomów marek (tak opisuje to punkt 4 polityki prywatności). Nowy rodzaj źródła obrazów = najpierw dopisz go do polityki.
- Nigdy: zdjęcia z portali, agencji, Google Grafika, repostów z IG; obrazy generowane AI przedstawiające prawdziwe osoby; ilustracje sugerujące, że pokazują prawdziwy produkt/osobę/lokal z newsa. Nie pobieraj plików do repo.

## Publikacja
Dopisz nowe wydanie na początku obiektu w `data/editions.js` (nie usuwaj starych), commit `Wydanie RRRR-MM-DD`, push na `main`.
