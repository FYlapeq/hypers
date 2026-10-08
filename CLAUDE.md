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
         title, summary, sources: [{name, url, origin?: true}], img?: "img/plik.jpg", imgCredit? }
```
Pierwszy news z pierwszej niepustej sekcji (drama → luz → drop) jest tematem dnia na górze strony.

## Zasady redakcyjne (obowiązkowe)
- Drama: tylko newsy opublikowane w dniu wydania. Na luzie i Dropy: z ostatnich 48 godzin.
- Każdy news potwierdzony w min. 3 niezależnych źródłach; sprawdź datę publikacji każdego źródła.
- Gdy się da, potwierdź u samego twórcy/marki (YouTube, X, oficjalna strona, newsroom) i oznacz `origin: true`.
- Żadnych niepotwierdzonych zarzutów wobec konkretnych osób (przemoc, przestępstwa, sprawy zdrowotne itp.).
- Piszemy własnymi słowami po polsku, 2–4 zdania, bez kopiowania tekstów.
- Razem min. 5 newsów dziennie. Jeśli sekcja nie ma newsów spełniających zasady, zostaje krótsza; nie obniżamy poprzeczki.
- `img` dodawaj tylko gdy plik faktycznie jest w `img/`; bez zdjęcia karta wyświetla się poprawnie.

## Publikacja
Dopisz nowe wydanie na początku obiektu w `data/editions.js` (nie usuwaj starych), commit `Wydanie RRRR-MM-DD`, push na `main`.
