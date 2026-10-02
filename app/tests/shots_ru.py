import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from harness import *
OUT = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else "ru"
serve()
def go(pg, name, p=None): pg.evaluate("([n,p])=>__liga.nav.go(n,p)", [name, p]); pg.wait_for_timeout(450)
with sync_playwright() as p:
    b = p.chromium.launch()
    seed = dict(SEED); seed["lang"] = LANG
    pg, errs = page(b, seed=seed)
    pg.screenshot(path=f"{OUT}/{LANG}_home.png", full_page=True)
    for name, par in [("rate", None), ("learn", None), ("profile", None), ("intro", {"si": 0}), ("pay", None), ("duel", None), ("balance", None), ("settings", None), ("ach", None), ("share", {"kind": "week"})]:
        go(pg, name, par); pg.screenshot(path=f"{OUT}/{LANG}_{name}.png", full_page=True)
    print("errs", errs)
    b.close()
