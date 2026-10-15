HYPERS - strona z porannymi newsami

Jak uruchomic:
  Kliknij dwukrotnie index.html - strona otworzy sie w przegladarce.
  (Czcionki sa w folderze fonts/, wiec dzialaja tez bez internetu. Internet potrzebny do zdjec i osadzonych postow.)

Struktura:
  index.html          - strona (wyglad + logika)
  data/editions.js    - newsy; kazde wydanie to osobny wpis z data RRRR-MM-DD
  scripts/edition.mjs - narzedzie redakcji: recent / digest / video / add (oszczedza tokeny, opis w CLAUDE.md)
  scripts/build.mjs   - generuje strony artykulow (artykuly/), archiwum.html, sitemap.xml, data/urls.js
                        uruchom: node scripts/build.mjs (robi to tez automat w GitHub Actions)

Dodanie nowego wydania:
  Zapisz newsy w nowe.json ({ "date", "slot", "ryby", "luz", "ciekawostki" }, format w CLAUDE.md)
  i uruchom: node scripts/edition.mjs add nowe.json Do newsa mozna dodac pole "embed" z linkiem do posta tworcy (Instagram, TikTok, X, YouTube) - zostanie osadzony w artykule.

Publikacja:
  Strona stoi na GitHub Pages (galaz main, domena hypers.tech z pliku CNAME).
  Kazdy push na main publikuje zmiany po 1-2 minutach.
