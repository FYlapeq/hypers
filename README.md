HYPERS - strona z porannymi newsami

Jak uruchomic:
  Kliknij dwukrotnie index.html - strona otworzy sie w przegladarce.
  (Potrzebny internet tylko do czcionek; bez niego strona dziala z czcionkami zastepczymi.)

Struktura:
  index.html          - strona (wyglad + logika)
  data/editions.js    - newsy; kazde wydanie to osobny wpis z data RRRR-MM-DD

Dodanie nowego wydania:
  Dopisz w data/editions.js nowy klucz z data, np. "2026-10-09": { "drama": [...], "luz": [...], "drop": [...] }
  w tym samym formacie co istniejace wydanie. Do newsa mozna dodac pole "embed" z linkiem do posta tworcy (Instagram, TikTok, X, YouTube) - zostanie osadzony w artykule.

Wrzucenie do internetu za darmo:
  Netlify (app.netlify.com/drop) - przeciagnij caly folder na strone i gotowe.
  Albo GitHub Pages / Vercel.
