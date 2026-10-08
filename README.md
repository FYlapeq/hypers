HYPERS - strona z porannymi newsami

Jak uruchomic:
  Kliknij dwukrotnie index.html - strona otworzy sie w przegladarce.
  (Potrzebny internet tylko do czcionek; bez niego strona dziala z czcionkami zastepczymi.)

Struktura:
  index.html          - strona (wyglad + logika)
  data/editions.js    - newsy; kazde wydanie to osobny wpis z data RRRR-MM-DD
  img/                - zdjecia do newsow

Dodanie nowego wydania:
  Dopisz w data/editions.js nowy klucz z data, np. "2026-10-09": { "drama": [...], "luz": [...], "drop": [...] }
  w tym samym formacie co istniejace wydanie, a zdjecia wrzuc do img/.

Wrzucenie do internetu za darmo:
  Netlify (app.netlify.com/drop) - przeciagnij caly folder na strone i gotowe.
  Albo GitHub Pages / Vercel.
