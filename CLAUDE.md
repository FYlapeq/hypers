# Hypers: codzienne wydanie

Strona statyczna (Netlify, auto-deploy z gałęzi `main`). Newsy w `data/editions.js` (`window.HYPERS_EDITIONS`, klucz = data `RRRR-MM-DD`, czas Europe/Warsaw). Strona nie hostuje cudzych zdjęć na swoim serwerze: obrazy są wczytywane bezpośrednio ze źródła (hotlink), a w artykule osadzany jest oryginalny post twórcy (Instagram, TikTok, X, YouTube).

## Format wydania
```
"RRRR-MM-DD": {
  "date": "RRRR-MM-DD",
  "drama": [ news ],   // cel 2: konflikty, afery, kontrowersje twórców
  "luz":   [ news ],   // cel 5: wirale, ogłoszenia, walki, kampanie (styl dropsy.news)
  "drop":  [ news ]    // cel 3: ciuchy, buty, kolaboracje modowe
}
news = { region: "pl"|"world", published: "RRRR-MM-DD", who, initials, category, hype (1-5),
         title, summary, body: ["akapit", ...], sources: [{name, url, origin?: true}], embed?,
         caption?: {credit: "Autor / Platforma", text: "komentarz"},
         image?: {kind: "kadr"|"ilustracja"|"prasowe", src, fallback?, credit, href, alt, caption} }
```
`summary` = 2–3 zdania na karcie. `body` = pełny artykuł (3–5 akapitów) widoczny po kliknięciu karty, tylko z faktów potwierdzonych w źródłach, bez spekulacji.
`embed` = link do KONKRETNEGO posta/filmu twórcy (instagram.com/p/… lub /reel/…, tiktok.com/@konto/video/…, x.com/konto/status/…, youtube.com/watch?v=… lub /shorts/…). Profil (np. instagram.com/konto/) się nie osadzi. Bez `embed` strona sama osadzi pierwszy taki link ze źródeł (najpierw `origin: true`).
Pierwszy news z pierwszej niepustej sekcji (drama → luz → drop) jest tematem dnia na górze strony.

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
- Nigdy: zdjęcia z portali, agencji, Google Grafika, repostów z IG; obrazy generowane AI przedstawiające prawdziwe osoby; ilustracje sugerujące, że pokazują prawdziwy produkt/osobę/lokal z newsa. Nie pobieraj plików do repo.

## Publikacja
Dopisz nowe wydanie na początku obiektu w `data/editions.js` (nie usuwaj starych), commit `Wydanie RRRR-MM-DD`, push na `main`.
