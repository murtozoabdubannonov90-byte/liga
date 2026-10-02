# Ilova belgisi: ko'k "muhr" fon, oq T-hisob (Debet | Kredit), oltin va oq nuqta. Barcha o'lchamlar shu yerda chiziladi.
import os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); PUB = os.path.join(HERE, "../public"); RES = os.path.join(HERE, "../resources")
def svg(bg=True, s=1.0):
    # s — belgining masshtabi (maskable/android uchun xavfsiz zona 0.62)
    t = f'translate({512-512*s} {512-512*s}) scale({s})'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2D52EA"/><stop offset="1" stop-color="#1B37B8"/></linearGradient></defs>
{'<rect width="1024" height="1024" fill="url(#g)"/>' if bg else ''}
<g transform="{t}">
 <path d="M232 352H792M512 352V800" stroke="#fff" stroke-width="80" stroke-linecap="round"/>
 <circle cx="344" cy="560" r="52" fill="#F2B32A"/><circle cx="680" cy="560" r="52" fill="#fff"/>
</g></svg>'''
def render(pg, markup, out, size):
    pg.set_viewport_size({"width": 1024, "height": 1024})
    pg.set_content(f'<html><body style="margin:0;background:transparent">{markup}</body></html>')
    pg.screenshot(path=out, omit_background=True, clip={"x": 0, "y": 0, "width": 1024, "height": 1024})
    if size != 1024:
        from PIL import Image
        Image.open(out).resize((size, size), Image.LANCZOS).save(out)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    render(pg, svg(True, 0.86), os.path.join(PUB, "icon-512.png"), 512)
    render(pg, svg(True, 0.86), os.path.join(PUB, "icon-192.png"), 192)
    render(pg, svg(True, 0.66), os.path.join(PUB, "icon-maskable.png"), 512)
    render(pg, svg(True, 0.86), os.path.join(RES, "icon-only.png"), 1024)
    render(pg, svg(False, 0.62), os.path.join(RES, "icon-foreground.png"), 1024)
    render(pg, '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#2446D8"/></svg>', os.path.join(RES, "icon-background.png"), 1024)
    # splash: qog'oz fon, markazda belgi
    pg.set_viewport_size({"width": 1366, "height": 1366})
    pg.set_content('<html><body style="margin:0;width:1366px;height:1366px;display:grid;place-items:center;background:#EEF3F0"><div style="width:360px;height:360px;border-radius:96px;overflow:hidden">' + svg(True, 0.86).replace('width="1024" height="1024" viewBox', 'width="360" height="360" viewBox') + '</div></body></html>')
    pg.screenshot(path=os.path.join(RES, "splash.png")); 
    pg.set_content('<html><body style="margin:0;width:1366px;height:1366px;display:grid;place-items:center;background:#0F2A24"><div style="width:360px;height:360px;border-radius:96px;overflow:hidden">' + svg(True, 0.86).replace('width="1024" height="1024" viewBox', 'width="360" height="360" viewBox') + '</div></body></html>')
    pg.screenshot(path=os.path.join(RES, "splash-dark.png"))
    b.close()
print("ok")
