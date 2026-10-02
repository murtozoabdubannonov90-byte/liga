import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from harness import *
OUT = sys.argv[1]; only = sys.argv[2:] 
serve()
def nav(pg, label): pg.click(f".nav >> text={label}")
with sync_playwright() as p:
    b = p.chromium.launch()
    pg, errs = page(b)
    def shot(name, full=True):
        if only and name not in only: return
        pg.wait_for_timeout(450); pg.screenshot(path=f"{OUT}/{name}.png", full_page=full)
    shot("home")
    nav(pg, "Reyting"); shot("rate")
    nav(pg, "O'qish"); shot("learn")
    nav(pg, "Profil"); shot("profile")
    nav(pg, "Asosiy"); pg.click("#go-stage"); shot("intro")
    pg.click("#go"); pg.wait_for_timeout(400); shot("quiz", False)
    pg.click(".keys .key >> nth=0"); pg.click(".keys .key >> nth=1"); pg.wait_for_timeout(200); shot("quiz2", False)
    pg.click("#chk"); pg.wait_for_timeout(600); shot("quizfb", False)
    print("errs", errs)
    b.close()
