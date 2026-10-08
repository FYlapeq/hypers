# Hypers: codzienne wydanie

Strona statyczna (Netlify, auto-deploy z gałęzi `main`). Newsy w `data/editions.js` (`window.HYPERS_EDITIONS`, klucz = data `RRRR-MM-DD`, czas Europe/Warsaw). Zdjęcia w `img/`.

## Format wydania
```
"RRRR-MM-DD": {
  "date": "RRRR-MM-DD",
  "drama": [ news ],   // cel 2: konflikty, afery, kontrowersje twórców
  "luz":   [ news ],   // cel 5: wirale, ogłoszenia, walki, kampanie (styl dropsy.news)
  "drop":  [ news ]    // cel 3: ciuchy, buty, kolaboracje modowe
}
news = { region: "pl"|"world", published: "RRRR-MM-DD", who, initials, category, hype (1-5),
         title, summary, body: ["akapit", ...], sources: [{name, url, origin?: true}], img?, imgCredit? }
```
`summary` = 2–3 zdania na karcie. `body` = pełny artykuł (3–5 akapitów) widoczny po kliknięciu karty, tylko z faktów potwierdzonych w źródłach, bez spekulacji.
Pierwszy news z pierwszej niepustej sekcji (drama → luz → drop) jest tematem dnia na górze strony.

## Zasady redakcyjne (obowiązkowe)
- Drama: tylko newsy opublikowane w dniu wydania. Na luzie i Dropy: z ostatnich 48 godzin.
- Każdy news potwierdzony w min. 3 niezależnych źródłach; sprawdź datę publikacji każdego źródła.
- Gdy się da, potwierdź u samego twórcy/marki (YouTube, X, oficjalna strona, newsroom) i oznacz `origin: true`.
- Żadnych niepotwierdzonych zarzutów wobec konkretnych osób (przemoc, przestępstwa, sprawy zdrowotne itp.).
- Piszemy własnymi słowami po polsku, bez kopiowania tekstów.
- Razem min. 5 newsów dziennie. Jeśli sekcja nie ma newsów spełniających zasady, zostaje krótsza; nie obniżamy poprzeczki.
- Nie dodawaj `img` ręcznie. Po pushu GitHub Actions (`.github/workflows/images.yml`, `scripts/fetch-images.mjs`) sam pobiera zdjęcie (og:image) z pierwszego źródła, które je ma, i dopisuje `img` + `imgCredit`. Dlatego pierwszym źródłem dawaj artykuł ze zdjęciem (portal/newsroom), nie Instagram.

## Publikacja
Dopisz nowe wydanie na początku obiektu w `data/editions.js` (nie usuwaj starych), commit `Wydanie RRRR-MM-DD`, push na `main`.
