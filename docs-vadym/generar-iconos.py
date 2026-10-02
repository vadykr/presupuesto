# Genera los PNG/ICO de la PWA a partir del diseño de public/icono.svg (requiere Pillow).
# Uso: python3 docs-vadym/generar-iconos.py

from PIL import Image, ImageDraw, ImageFont
import os
OUT = '/home/user/presupuesto/packages/desktop-client/public'
VERDE = (0x1f, 0x6f, 0x4a, 255)
BLANCO = (255, 255, 255, 255)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def render(size, carpeta=True, margen=0.0):
    S = 2048
    img = Image.new('RGBA', (S, S), VERDE)
    d = ImageDraw.Draw(img)
    k = S / 512
    # escala del contenido (para maskable se encoge hacia el centro)
    def P(x, y):
        c = 256
        return ((c + (x - c) * (1 - margen)) * k, (c + (y - c) * (1 - margen)) * k)
    w = int(30 * k * (1 - margen))
    if carpeta:
        pts = [P(72,128), P(192,128), P(228,164), P(440,164), P(440,412), P(72,412), P(72,128), P(192,128)]
        d.line(pts, fill=BLANCO, width=w, joint='curve')
        for p in (pts[0], pts[5], pts[4]):
            d.ellipse([p[0]-w/2, p[1]-w/2, p[0]+w/2, p[1]+w/2], fill=BLANCO)
        fs = int(236 * k * (1 - margen)); cx, cy = P(256, 290)
    else:
        fs = int(400 * k * (1 - margen)); cx, cy = P(256, 262)
    f = ImageFont.truetype(FONT, fs)
    d.text((cx, cy), '€', font=f, fill=BLANCO, anchor='mm')
    return img.resize((size, size), Image.LANCZOS)

for name, size in [('android-chrome-192x192.png', 192), ('android-chrome-512x512.png', 512),
                   ('apple-touch-icon.png', 180), ('mstile-150x150.png', 150)]:
    render(size).save(os.path.join(OUT, name), optimize=True)
for name, size in [('maskable-192x192.png', 192), ('maskable-512x512.png', 512)]:
    render(size, margen=0.18).save(os.path.join(OUT, name), optimize=True)
render(32, carpeta=False).save(os.path.join(OUT, 'favicon-32x32.png'), optimize=True)
render(16, carpeta=False).save(os.path.join(OUT, 'favicon-16x16.png'), optimize=True)
ico = render(48, carpeta=False)
ico.save(os.path.join(OUT, 'favicon.ico'), format='ICO', sizes=[(16,16),(32,32),(48,48)])
print('ok')
