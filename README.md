HYPERS - strona z porannymi newsami

Jak uruchomic:
  Kliknij dwukrotnie index.html - strona otworzy sie w przegladarce.
  (Czcionki sa w folderze fonts/, wiec dzialaja tez bez internetu. Internet potrzebny do zdjec i osadzonych postow.)

Struktura:
  index.html          - strona (wyglad + logika)
  data/editions.js    - newsy; kazde wydanie to osobny wpis z data RRRR-MM-DD
  scripts/build.mjs   - generuje strony artykulow (artykuly/), archiwum.html, sitemap.xml, data/urls.js
                        uruchom: node scripts/build.mjs (robi to tez automat w GitHub Actions)

Dodanie nowego wydania:
  Dopisz w data/editions.js nowy klucz z data, np. "2026-10-09": { "drama": [...], "luz": [...], "drop": [...] }
  w tym samym formacie co istniejace wydanie. Do newsa mozna dodac pole "embed" z linkiem do posta tworcy (Instagram, TikTok, X, YouTube) - zostanie osadzony w artykule.

Publikacja:
  Strona stoi na GitHub Pages (galaz main, domena hypers.tech z pliku CNAME).
  Kazdy push na main publikuje zmiany po 1-2 minutach.
