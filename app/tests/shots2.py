import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from harness import *
OUT = sys.argv[1]
serve()
def go(pg, name, p=None): pg.evaluate("([n,p])=>__liga.nav.go(n,p)", [name, p]); pg.wait_for_timeout(500)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg, errs = page(b)
    for name, par in [("share", {"kind": "week"}), ("pay", None), ("duel", None), ("balance", None), ("finalLive", None), ("lesson", {"id": "L05"}), ("topics", None), ("cert", None), ("settings", None), ("ach", None), ("wqAnswer", None)]:
        go(pg, name, par); pg.wait_for_timeout(600 if name == "share" else 200); pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    pg.evaluate("()=>{const S=__liga.st.S; S.adminPin='14'; __liga.st.persist();}"); go(pg, "admin"); pg.wait_for_timeout(600); pg.screenshot(path=f"{OUT}/admin.png", full_page=True)
    pg.click("text=A'zolar"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/admin_mem.png", full_page=True)
    pg.click("text=Testlar"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/admin_test.png", full_page=True)
    go(pg, "report"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/report.png", full_page=True)
    print("errs", errs)
    # dark + ru
    seed = dict(SEED); seed["lang"] = "ru"; seed["theme"] = "dark"
    pg2, e2 = page(b, seed=seed); pg2.screenshot(path=f"{OUT}/home_ru_dark.png", full_page=True)
    seed = dict(SEED); seed["lang"] = "uzc"
    pg3, e3 = page(b, seed=seed); pg3.screenshot(path=f"{OUT}/home_uzc.png", full_page=True)
    pg4, e4 = page(b, seed={}); pg4.screenshot(path=f"{OUT}/lang.png", full_page=True)
    pg4.click("text=O'zbekcha"); pg4.wait_for_timeout(400); pg4.screenshot(path=f"{OUT}/register.png", full_page=True)
    pg5, e5 = page(b, seed=None, query="?v=ABCD2345"); pg5.wait_for_timeout(600); pg5.screenshot(path=f"{OUT}/verify.png", full_page=True)
    pg6, e6 = page(b, seed=None, query="?t=TST7ABC"); pg6.screenshot(path=f"{OUT}/testtaker.png", full_page=True)
    print("errs2", e2, e3, e4, e5, e6)
    b.close()
