# Filtr obrazu dla klipów na IG: co sekundę klatka z filmu, NudeNet szuka nagości i bielizny.
# Użycie: python3 instagram/nagosc.py klip.mp4  -> kod 0 = OK, kod 1 = odrzucić (powód na stdout).
# Progi sprawdzone 18.11.2026 na klipach GTA 6 (klub ze striptizem odrzucony, zwykły gameplay przepuszczony).
import os, subprocess, sys, tempfile, glob
from nudenet import NudeDetector

# Odsłonięte: jedna klatka z pewnością >= 0.5 albo dwie klatki >= 0.35. Zakryte (bielizna, bikini): dwie klatki >= 0.55.
ODSLONIETE = {'FEMALE_BREAST_EXPOSED', 'FEMALE_GENITALIA_EXPOSED', 'MALE_GENITALIA_EXPOSED', 'BUTTOCKS_EXPOSED', 'ANUS_EXPOSED'}
ZAKRYTE = {'FEMALE_BREAST_COVERED', 'BUTTOCKS_COVERED', 'FEMALE_GENITALIA_COVERED'}

def ocen(trafienia):
    """trafienia = [(sekunda, klasa, pewnosc)] -> powód odrzucenia albo None."""
    ods = [t for t in trafienia if t[1] in ODSLONIETE]
    if any(t[2] >= 0.5 for t in ods):
        return 'jedna klatka >= 0.5: ' + str(max(ods, key=lambda t: t[2]))
    if len({t[0] for t in ods if t[2] >= 0.35}) >= 2:
        return 'dwie klatki >= 0.35: ' + str([t for t in ods if t[2] >= 0.35][:3])
    if len({t[0] for t in trafienia if t[1] in ZAKRYTE and t[2] >= 0.55}) >= 2:
        return 'bielizna w dwóch klatkach: ' + str([t for t in trafienia if t[1] in ZAKRYTE and t[2] >= 0.55][:3])
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
