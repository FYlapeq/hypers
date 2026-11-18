# Filtr obrazu dla klipów na IG: co sekundę klatka z filmu, NudeNet szuka nagości i bielizny.
# Użycie: python3 instagram/nagosc.py klip.mp4  -> kod 0 = OK, kod 1 = odrzucić (powód na stdout).
# Progi sprawdzone 18.11.2026 na klipach GTA 6 (klub ze striptizem odrzucony, zwykły gameplay przepuszczony).
import os, subprocess, sys, tempfile, glob
from nudenet import NudeDetector

# Odsłonięte: jedna klatka z pewnością >= 0.6 albo trzy klatki >= 0.45. Zakryte (bikini, bielizna) nie blokują.
ODSLONIETE = {'FEMALE_BREAST_EXPOSED', 'FEMALE_GENITALIA_EXPOSED', 'MALE_GENITALIA_EXPOSED', 'BUTTOCKS_EXPOSED', 'ANUS_EXPOSED'}
ZAKRYTE = {'FEMALE_BREAST_COVERED', 'BUTTOCKS_COVERED', 'FEMALE_GENITALIA_COVERED'}

def ocen(trafienia):
    """trafienia = [(sekunda, klasa, pewnosc)] -> powód odrzucenia albo None.
    Łagodnie (prośba Filipa 18.11.2026: ma przepuszczać większość): bikini, bielizna i pojedyncze wątpliwe klatki przechodzą,
    odpada tylko wyraźna nagość (za nią Instagram usuwa posty i blokuje konta)."""
    ods = [t for t in trafienia if t[1] in ODSLONIETE]
    if any(t[2] >= 0.6 for t in ods):
        return 'wyraźna nagość: ' + str(max(ods, key=lambda t: t[2]))
    if len({t[0] for t in ods if t[2] >= 0.45}) >= 3:
        return 'nagość w kilku klatkach: ' + str([t for t in ods if t[2] >= 0.45][:3])
    return None

def main(film):
    ffmpeg = os.environ.get('FFMPEG', 'ffmpeg')
    det = NudeDetector()
    trafienia = []
    with tempfile.TemporaryDirectory() as d:
        subprocess.run([ffmpeg, '-loglevel', 'error', '-i', film, '-vf', 'fps=1,scale=640:-2', os.path.join(d, 'k%03d.jpg')], check=True)
        for kl in sorted(glob.glob(os.path.join(d, '*.jpg'))):
            sek = int(os.path.basename(kl)[1:4]) - 1
            trafienia += [(sek, w['class'], round(w['score'], 2)) for w in det.detect(kl) if w['class'] in ODSLONIETE | ZAKRYTE]
    powod = ocen(trafienia)
    print(powod or 'OK')
    return 1 if powod else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
