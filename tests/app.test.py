"""Hisobchi Liga — brauzer testlari (Playwright, server so'rovlari soxtalashtirilgan).
Ishga tushirish:  python3 -m http.server 8765 &  python3 tests/app.test.py
"""
import json, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765/index.html"
SEED = {"xp": 0, "user": {"first": "Test", "last": "User", "phone": "+998901112233"}, "name": "Test", "key": "x", "pid": "p1",
        "stars": {}, "week": {"id": "", "my": 0, "riv": {}}, "group": {"code": "ASOSIY", "start": "2026-09-28", "ok": True}}
fails = []
def check(name, cond, info=""):
    print(("✅ " if cond else "❌ ") + name + (f" — {info}" if info and not cond else ""))
    if not cond: fails.append(name)

def mock(pushes):
    def h(route):
        u, body = route.request.url, None
        if "liga_push" in u: pushes.append(json.loads(route.request.post_data or "{}"))
        if "liga_members" in u: body = [{"name": "Test U.", "is_me": True, "medal": 1}, {"name": "Ali V.", "is_me": False, "medal": None}]
        elif "liga_count" in u: body = 2
        elif "liga_group_info" in u: body = [{"code": "ASOSIY", "name": "Buxgalterlar ligasi", "paid_until": None, "ok": True, "members": 2, "start_date": "2026-09-28"}]
        elif "liga_champions" in u: body = [{"week_id": "2026-09-25T07:00", "pos": 1, "name": "Test U.", "week_xp": 900, "is_me": True}]
        elif "liga_results" in u: body = []
        elif "liga_group_public" in u: body = [{"code": "BX12AB", "name": "Sinov jamoasi", "ok": True, "start_date": "2026-10-05"}]
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
    return h

def page(b, when, seed=SEED, pushes=None):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="Asia/Tashkent")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**supabase.co/**", mock(pushes if pushes is not None else []))
    pg.route("**telegram.org/**", lambda r: r.fulfill(status=200, body=""))
    pg.route("**fonts.g**", lambda r: r.fulfill(status=200, body=""))
    pg.clock.install(time=when)
    pg.add_init_script("localStorage.setItem('hisobchi-liga-v1',JSON.stringify(%s))" % json.dumps(seed))
    pg.goto(BASE); pg.wait_for_timeout(700)
    return pg, errs

ANSWER = """(right)=>{ const t=run.queue[run.i];
  if(t.t==='mc'){ run.pick=right?run.ans:(run.ans+1)%run.opts.length; }
  else if(t.t==='pv'){ run.slots=right?{dt:t.dt,kt:t.kt}:{dt:t.kt,kt:t.dt}; }
  else { document.getElementById('num').value=String(right?t.a:t.a+1); }
  check(); }"""

with sync_playwright() as p:
    b = p.chromium.launch()

    # 1) Bosqich: har to'g'ri javob darhol jami va bosqich baliga; jami = bosqichlar yig'indisi
    pushes = []
    pg, errs = page(b, "2026-10-01T05:00:00Z", pushes=pushes)    # payshanba 10:00 → 4-bosqich
    st = pg.evaluate("()=>[0,1,2,3,4].map(stageState)")
    check("4-bosqich bugun ochiq, oldingilari yopiq", st == ["closed", "closed", "closed", "open", "future"], str(st))
    pg.evaluate("()=>{intro(3);document.getElementById('go').click();}")
    for k in range(5):
        pg.evaluate(ANSWER, True)
        if k < 4: pg.evaluate("()=>{run.i++;task();}")
    r = pg.evaluate("()=>({my:S.week.my, st:S.week.stages[3], sum:Object.values(S.week.stages).reduce((a,b)=>a+b,0)})")
    check("5 to'g'ri javobdan keyin XP darhol saqlandi", r["st"] > 0 and r["my"] == r["sum"], str(r))
    # ilovani yopish (o'rtada) → qayta ochish: XP yo'qolmaydi
    saved = pg.evaluate("()=>localStorage.getItem('hisobchi-liga-v1')")
    pg2, e2 = page(b, "2026-10-01T05:10:00Z", seed=json.loads(saved))
    r2 = pg2.evaluate("()=>({my:S.week.my, st:S.week.stages[3], left:saLeft(3).length})")
    check("Ilova yopilsa ham XP saqlanadi", r2["st"] == r["st"] and r2["my"] == r["my"], f"{r} → {r2}")
    check("Javob berilgan savollar qaytmaydi (15 ta qoldi)", r2["left"] == 15, str(r2))
    # davom ettirib oxirigacha
    pg2.evaluate("()=>{intro(3);document.getElementById('go').click();}")
    seen = set()
    for k in range(15):
        q = pg2.evaluate("()=>run.queue[run.i].k"); seen.add(q)
        pg2.evaluate(ANSWER, k % 3 != 0)
        pg2.evaluate("()=>{ if(run.i>=run.queue.length-1){ finish(true); } else { run.i++; task(); } }")
    check("Davomida takroriy savol yo'q", len(seen) == 15 and not (seen & set(range(5))), str(sorted(seen)))
    r3 = pg2.evaluate("()=>({my:S.week.my, st:S.week.stages[3], left:saLeft(3).length})")
    check("Bosqich yakunlandi, bal ≤ 450", r3["left"] == 0 and 0 < r3["st"] <= 450 and r3["my"] == r3["st"], str(r3))
    q1220 = pg2.evaluate("()=>STAGES.map(s=>s.tasks.slice(0,12).every(t=>t.t==='pv'))")
    check("Har bosqichda 1–12 savol provodka", all(q1220))
    allq = pg2.evaluate("()=>STAGES.flatMap(s=>s.tasks.map(t=>t.q))")
    check("240 ta savol, hammasi noyob", len(allq) == 240 and len(set(allq)) == 240, str(len(set(allq))))
    check("Xatolar yo'q (1)", not errs and not e2, str(errs + e2))

    # 2) Blits: vaqtsiz, 20 ta, faqat provodka, liga baliga qo'shilmaydi
    pg, errs = page(b, "2026-10-01T06:00:00Z")
    pg.evaluate("()=>startBlitz()")
    bl = pg.evaluate("()=>({n:run.queue.length, pv:run.queue.every(t=>t.t==='pv'), tmr:!!document.getElementById('tmr')||!!document.getElementById('qt')})")
    check("Blits: 20 ta savol", bl["n"] == 20, str(bl))
    check("Blits: faqat provodka", bl["pv"])
    check("Blits: taymer yo'q", not bl["tmr"])
    pg.clock.run_for(120000)
    check("Blits: 2 daqiqadan keyin ham tugamadi", pg.evaluate("()=>run&&run.mode==='blitz'&&!run.answered"))
    for k in range(20):
        pg.evaluate(ANSWER, True)
        pg.evaluate("()=>document.getElementById('nx').click()")
    res = pg.evaluate("()=>({h:document.querySelector('h2').innerText, rec:S.blitz, my:S.week.my})")
    check("Blits yakuni: 20/20 rekord, liga bali o'zgarmadi", res["rec"] == 20 and res["my"] == 0 and "Blits" in res["h"], str(res))
    check("Xatolar yo'q (2)", not errs, str(errs))

    # 3) Jamoa: ro'yxatdan o'tishda kod, havoladan avtomatik
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="Asia/Tashkent")
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    joins = []
    def h(route):
        u = route.request.url
        if "liga_join" in u: joins.append(json.loads(route.request.post_data)); return route.fulfill(status=200, content_type="application/json", body='"new-id"')
        if "liga_group_info" in u: return route.fulfill(status=200, content_type="application/json",
            body=json.dumps([{"code": "BX12AB", "name": "Sinov jamoasi", "paid_until": "2026-10-20", "ok": True, "members": 1, "start_date": "2026-10-05"}]))
        return mock([])(route)
    pg.route("**supabase.co/**", h); pg.route("**telegram.org/**", lambda r: r.fulfill(status=200, body=""))
    pg.clock.install(time="2026-10-01T06:00:00Z")
    pg.goto(BASE + "?g=bx12ab"); pg.wait_for_timeout(800)
    check("Havoladagi jamoa kodi formaga tushdi", pg.input_value("#g") == "BX12AB")
    pg.fill("#f", "Dilnoza"); pg.fill("#l", "Karimova"); pg.fill("#p", "901234567")
    pg.click("#go"); pg.wait_for_timeout(800)
    check("Ro'yxatdan o'tish jamoa kodi bilan yuborildi", joins and joins[0].get("p_group") == "BX12AB", str(joins))
    st0 = pg.evaluate("()=>({start:ligaStart().toDateString(), s1:stageState(0)})")
    check("Jamoa o'z sanasidan boshlanadi (05.10 → hozir 1-bosqich kelajakda)", st0["s1"] == "future", str(st0))
    check("Xatolar yo'q (3)", not errs, str(errs))

    # 4) Mavsum: 12 bosqichdan keyin qayta boshlanadi
    pg, errs = page(b, "2026-10-14T05:00:00Z")
    r = pg.evaluate("()=>({season:season(), s0:stageState(0), d0:stageDay(0)})")
    check("13-ish kuni — 2-mavsum, 1-bosqich ochiq", r["season"] == 1 and r["s0"] == "open", str(r))

    # 5) Profil: statistika, chempionlar, haftalik sertifikat; reyting
    pg, errs = page(b, "2026-10-01T06:00:00Z")
    pg.evaluate("()=>scrProfile()"); pg.wait_for_timeout(300)
    txt = pg.inner_text("body")
    check("Profilda jamoa ko'rinadi", "Buxgalterlar ligasi" in txt and "ASOSIY" in txt)
    check("Haftalik g'olib sertifikati tugmasi", "g'olib sertifikati" in txt)
    pg.evaluate("()=>scrRating()"); pg.wait_for_timeout(300)
    check("Chempionlar zali", "Chempionlar zali" in pg.inner_text("body"))
    pg.evaluate("()=>scrMain()"); pg.wait_for_timeout(300)
    check("Sheriklarda 👑 nishon", "👑" in pg.inner_text(".league"))
    check("Hech qayerda '/8' yo'q", "/ 8" not in pg.content() and "8/8" not in pg.content())
    check("Xatolar yo'q (5)", not errs, str(errs))
    b.close()

print("\nNATIJA:", "HAMMASI O'TDI" if not fails else f"{len(fails)} ta xato: {fails}")
sys.exit(1 if fails else 0)
