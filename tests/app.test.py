"""Hisobchi Liga — brauzer testlari (Playwright, server so'rovlari soxtalashtirilgan).
Ishga tushirish:  python3 -m http.server 8765 &  python3 tests/app.test.py
"""
import json, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765/v1/index.html"  # eski (1.0) ilova — v1/ papkada
SEED = {"xp": 0, "user": {"first": "Test", "last": "User", "phone": "+998901112233", "region": "Andijon viloyati"}, "name": "Test", "key": "x", "pid": "p1", "token": "tok1",
        "stars": {}, "week": {"id": "", "my": 0, "riv": {}}, "group": {"code": "ASOSIY", "start": "2026-09-28", "ok": True}}
fails = []
def check(name, cond, info=""):
    print(("✅ " if cond else "❌ ") + name + (f" — {info}" if info and not cond else ""))
    if not cond: fails.append(name)

CALLS = []
EXTRA = {}
def mock(pushes):
    def h(route):
        u, body = route.request.url, None
        fn = u.split("/rpc/")[-1].split("?")[0]
        CALLS.append((fn, json.loads(route.request.post_data or "{}")))
        if fn == "liga_save": pushes.append(json.loads(route.request.post_data or "{}"))
        if fn in EXTRA: body = EXTRA[fn]
        elif fn == "liga_join2": body = [{"id": "new-id", "token": "tok-new"}]
        elif fn == "liga_claim": body = "tok-claimed"
        elif fn == "liga_pin_check": body = "admin"
        elif fn == "liga_admin_group": body = [{"code": "BX12AB", "name": "Sinov jamoasi", "paid_until": "2026-10-31", "ok": True, "members": 3, "max_players": None, "start_date": "2026-10-05", "chats": 1, "region": "Andijon viloyati", "price": 30000}]
        elif fn in ("liga_admin_list", "liga_admin_list2"): body = [{"id": "p1", "first_name": "Test", "last_name": "User", "phone": "+998901112233", "xp": 100, "week_xp": 50, "week_id": "x", "stages": 1, "streak": 1, "last_active": None, "created_at": None, "week_stage": 0, "week_daily": 0, "week_blitz": 0, "week_stages": {}, "week_bonus": 0, "region": "Andijon viloyati", "acc_ok": 8, "acc_total": 10, "has_device": True, "paid_until": "2026-10-30", "pay_ok": True},
                                             {"id": "p2", "first_name": "Ali", "last_name": "V", "phone": "+998901110000", "xp": 10, "week_xp": 0, "week_id": "x", "stages": 0, "streak": 0, "last_active": None, "created_at": None, "week_stage": 0, "week_daily": 0, "week_blitz": 0, "week_stages": {}, "week_bonus": 0, "region": None, "acc_ok": 0, "acc_total": 0, "has_device": True, "paid_until": None, "pay_ok": False}]
        elif fn == "liga_admin_month": body = [{"id": "p1", "name": "Test User", "phone": "+998901112233", "region": "Andijon viloyati", "weeks": {"2026-10-02T07:00": 420, "2026-10-09T07:00": 380}, "month_xp": 800, "tops": 2, "acc_ok": 80, "acc_total": 100, "last_active": "2026-10-09T10:00:00Z", "final_score": 340}]
        elif fn == "liga_admin_invoice": body = [{"id": 7, "amount": 90000, "members": 3, "months": 1}]
        elif fn in ("liga_admin_invoices", "liga_wq_admin", "liga_region_league"): body = []
        elif fn == "liga_player_status": body = [{"paid_until": "2026-10-30", "ok": True, "personal": True, "price": 30000, "pending": False}]
        elif fn == "liga_tg_pay_link": body = "pay_abc123"
        elif fn == "liga_admin_tg_link": body = "adm_abc123"
        elif fn == "liga_receipt_submit": body = [{"id": 11, "paid_until": "2026-10-31"}]
        elif fn == "liga_admin_receipts": body = [{"id": 11, "player_id": "p2", "name": "Ali V", "phone": "+998901110000", "months": 1, "amount": 30000, "receipt": "data:image/jpeg;base64,/9j/", "status": "check", "created_at": "2026-10-01T10:00:00Z", "paid_until": "2026-10-31"}]
        elif fn in ("liga_pay_config", "liga_pay_config2"): body = [{"payme_merchant_id": "", "click_service_id": "", "click_merchant_id": "", "price": 30000, "card": "8600123412341234", "card_name": "Murtozo A."}]
        elif fn == "liga_wq_state": body = [{"can_submit": False, "my_status": None, "q_id": None, "q": None, "o": None, "author": None}]
        elif fn == "liga_final_info": body = [{"month": "2026-10", "final_date": "2026-10-31", "open_now": False, "ended": False, "qualified": False, "my_score": None, "my_ms": None, "qualifiers": [], "standings": []}]
        elif "liga_members" in u: body = [{"name": "Test U.", "is_me": True, "medal": 1}, {"name": "Ali V.", "is_me": False, "medal": None}]
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
        if "liga_join2" in u: joins.append(json.loads(route.request.post_data)); return route.fulfill(status=200, content_type="application/json", body='[{"id":"new-id","token":"tok-new"}]')
        if "liga_group_info" in u: return route.fulfill(status=200, content_type="application/json",
            body=json.dumps([{"code": "BX12AB", "name": "Sinov jamoasi", "paid_until": "2026-10-20", "ok": True, "members": 1, "start_date": "2026-10-05"}]))
        return mock([])(route)
    pg.route("**supabase.co/**", h); pg.route("**telegram.org/**", lambda r: r.fulfill(status=200, body=""))
    pg.clock.install(time="2026-10-01T06:00:00Z")
    pg.goto(BASE + "?g=bx12ab"); pg.wait_for_timeout(800)
    check("Havoladagi jamoa kodi formaga tushdi", pg.input_value("#g") == "BX12AB")
    pg.fill("#f", "Dilnoza"); pg.fill("#l", "Karimova"); pg.fill("#p", "901234567")
    pg.click("#go"); pg.wait_for_timeout(300)
    check("Viloyatsiz ro'yxatdan o'tmaydi", "Viloyatni tanlang" in pg.inner_text("#err"))
    pg.select_option("#rg", "Farg'ona viloyati"); pg.click("#go"); pg.wait_for_timeout(800)
    check("Viloyat va kalit saqlandi", pg.evaluate("()=>S.user.region===\"Farg'ona viloyati\"&&S.token==='tok-new'"))
    check("Viloyat serverga yuborildi", joins and joins[0].get("p_region") == "Farg'ona viloyati", str(joins))
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

    # 6) Himoya: natija faqat kalit bilan; eski o'yinchi kalitni bir marta oladi
    CALLS.clear(); pushes = []
    seed = json.loads(json.dumps(SEED)); seed.pop("token")
    pg, errs = page(b, "2026-10-01T06:00:00Z", seed=seed, pushes=pushes); pg.wait_for_timeout(500)
    check("Eski o'yinchi uchun liga_claim chaqirildi", any(c[0] == "liga_claim" for c in CALLS))
    check("Saqlash kalit bilan (liga_save)", pushes and pushes[-1].get("p_token") == "tok-claimed" and pushes[-1].get("p_region") == "Andijon viloyati", str(pushes[-1:]))
    check("Eski ochiq push funksiyalari chaqirilmaydi", not any(c[0].startswith("liga_push") or c[0] == "liga_join" for c in CALLS))
    # viloyatsiz eski o'yinchi — bir marta so'raladi
    seed = json.loads(json.dumps(SEED)); seed["user"].pop("region")
    pg, errs = page(b, "2026-10-01T06:00:00Z", seed=seed)
    check("Viloyat so'raladi", "Viloyatingiz" in pg.inner_text("body"))
    pg.select_option("#rg", "Toshkent shahri"); pg.click("#go"); pg.wait_for_timeout(300)
    check("Viloyat saqlanib, asosiy oyna ochildi", pg.evaluate("()=>S.user.region==='Toshkent shahri'&&TAB==='main'"))
    check("Xatolar yo'q (6)", not errs, str(errs))

    # 7) Halol o'yin: savol ochiqligida ilovadan chiqilsa — xato
    pg, errs = page(b, "2026-10-01T05:00:00Z")
    pg.evaluate("()=>{intro(3);document.getElementById('go').click();}")
    check("Bosqichda suv belgisi (ism) bor", "Test User" in pg.inner_text(".wm"))
    pg.evaluate("()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));}")
    r = pg.evaluate("()=>({ans:run.answered, m:Object.values(saRec(3).m), txt:document.getElementById('fb').innerText})")
    check("Ilovadan chiqilganda savol xato", r["ans"] and r["m"] == ["bad"] and "Ilovadan chiqildi" in r["txt"], str(r))
    pg.evaluate("()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});}")
    pg.evaluate("()=>startBlitz()")
    pg.evaluate("()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));}")
    check("Blitsda chiqish jazolanmaydi", pg.evaluate("()=>!run.answered"))
    check("Xatolar yo'q (7)", not errs, str(errs))

    # 8) Savollar bazasi 500+ va yo'nalishlar
    pg, errs = page(b, "2026-10-01T06:00:00Z")
    r = pg.evaluate("()=>({n:QBASE(), u:new Set(TOPIC_ALL().map(t=>t.q)).size, t:TOPIC_ALL().length, ids:new Set(TOPIC_ALL().map(t=>t.id)).size, bad:TOPIC_ALL().filter(t=>t.t==='calc'&&!(Number.isInteger(t.a)&&t.a>0)).length, topics:TOPICS.map(t=>t.title)})")
    check("Bazada 500+ savol", r["n"] >= 500, str(r))
    check("Yo'nalish savollari noyob va to'g'ri", r["u"] == r["t"] == r["ids"] and r["bad"] == 0, str(r))
    check("QQS, Ish haqi, MHXS yo'nalishlari bor", all(x in r["topics"] for x in ["QQS", "Ish haqi", "MHXS"]), str(r["topics"]))
    pg.evaluate("()=>scrStages()"); check("Bosqich bo'limida yo'nalishlar", "Yo'nalishlar" in pg.inner_text("body"))
    pg.evaluate("()=>startTopic('qqs')")
    for k in range(10):
        pg.evaluate(ANSWER, True); pg.evaluate("()=>document.getElementById('nx').click()")
    r = pg.evaluate("()=>({my:S.week.my, d:S.week.part.daily, h:document.querySelector('h2').innerText, acc:S.tacc.qqs})")
    check("Yo'nalish bali kunlik mashqqa, ligaga emas", r["my"] == 0 and r["d"] > 0 and "Yo'nalish" in r["h"] and r["acc"]["n"] == 10, str(r))
    check("Xatolar yo'q (8)", not errs, str(errs))

    # 9) Haftaning savoli
    EXTRA["liga_wq_state"] = [{"can_submit": False, "my_status": None, "q_id": 5, "q": "Bo'nak qaysi hisobvaraqda?", "o": ["4310", "6010", "5110"], "author": "Ali V."}]
    EXTRA["liga_wq_answer"] = [{"ok": True, "a": 0, "e": "Berilgan bo'nak — 4310"}]
    pg, errs = page(b, "2026-10-01T06:00:00Z"); pg.wait_for_timeout(300)
    txt = pg.inner_text("body")
    check("Haftaning savoli muallif ismi bilan", "Haftaning savoli" in txt and "Ali V." in txt)
    xp0 = pg.evaluate("()=>S.xp")
    pg.click("[data-wqa]"); pg.click(".opt[data-k='0']"); pg.click("#go"); pg.wait_for_timeout(300)
    check("To'g'ri javob +50 XP (ligaga emas)", pg.evaluate("()=>S.xp") == xp0 + 50 and pg.evaluate("()=>S.week.my") == 0)
    EXTRA.pop("liga_wq_state"); EXTRA.pop("liga_wq_answer")
    EXTRA["liga_wq_state"] = [{"can_submit": True, "my_status": None, "q_id": None, "q": None, "o": None, "author": None}]
    pg, errs2 = page(b, "2026-10-01T06:00:00Z"); pg.wait_for_timeout(300)
    check("G'olibga savol taklif qilish tugmasi", "Savol taklif qilish" in pg.inner_text("body"))
    pg.click("[data-wqs]"); CALLS.clear()
    pg.fill("#wq", "Ish haqidan JShDS qaysi hisobvaraqqa?"); pg.fill("#wo0", "6410"); pg.fill("#wo1", "6710"); pg.fill("#wo3", "5110")
    pg.select_option("#wa", "3"); pg.click("#go"); pg.wait_for_timeout(300)
    sub = [c[1] for c in CALLS if c[0] == "liga_wq_submit"]
    check("Taklif yuborildi (bo'sh variant tashlandi)", sub and sub[0]["p_o"] == ["6410", "6710", "5110"] and sub[0]["p_a"] == 2 and sub[0]["p_token"] == "tok1", str(sub))
    EXTRA.pop("liga_wq_state")
    check("Xatolar yo'q (9)", not errs and not errs2, str(errs + errs2))

    # 10) Oylik final
    EXTRA["liga_final_info"] = [{"month": "2026-10", "final_date": "2026-10-31", "open_now": True, "ended": False, "qualified": True, "my_score": None, "my_ms": None,
        "qualifiers": [{"n": "Test U.", "tops": 2, "xp": 900, "me": True}, {"n": "Ali V.", "tops": 2, "xp": 800, "me": False}], "standings": []}]
    pg, errs = page(b, "2026-10-31T06:00:00Z"); pg.wait_for_timeout(300)
    check("Finalchi uchun final tugmasi", "Finalni boshlash" in pg.inner_text("body"))
    s1 = pg.evaluate("()=>finalSet().map(t=>t.id).join()")
    s2 = pg.evaluate("()=>finalSet().map(t=>t.id).join()")
    check("Final savollari 20 ta va hamma uchun bir xil", s1 == s2 and len(s1.split(",")) == 20)
    CALLS.clear(); pg.click("[data-fin]")
    for k in range(20):
        pg.evaluate(ANSWER, k % 4 != 0); pg.evaluate("()=>document.getElementById('nx').click()"); pg.wait_for_timeout(20)
    pg.wait_for_timeout(300)
    fs = [c[1] for c in CALLS if c[0] == "liga_final_submit"]
    check("Final natijasi yuborildi (15/20 = 300 ball)", fs and fs[0]["p_score"] == 300, str(fs))
    check("Finalni qayta o'ynab bo'lmaydi", not pg.evaluate("()=>finalCanPlay()"))
    pg.evaluate("()=>scrRating()"); txt = pg.inner_text("body")
    check("Reytingda oylik chempionat va viloyat ligasi", "chempionati" in txt and "Viloyat ligasi" in txt)
    EXTRA.pop("liga_final_info")
    check("Xatolar yo'q (10)", not errs, str(errs))

    # 11) Admin: PIN tekshiruvi, qurilma, hisobot, to'lov
    pg, errs = page(b, "2026-10-01T06:00:00Z")
    pg.evaluate("()=>adminLogin()"); pg.fill("#pin", "11112222"); pg.click("#go"); pg.wait_for_timeout(600)
    txt = pg.inner_text("body")
    check("Admin panel ochildi (liga_pin_check)", "Sinov jamoasi" in txt and "Qurilmani almashtirish" in txt and "aniqlik: 80%" in txt, txt[:300])
    CALLS.clear(); pg.on("dialog", lambda d: d.accept())
    pg.click("[data-dev='p2']"); pg.wait_for_timeout(300)
    check("Qurilmani almashtirish yuborildi", any(c[0] == "liga_admin_reset_device" and c[1]["p_id"] == "p2" for c in CALLS))
    pg.wait_for_timeout(400); pg.click("#pinv"); pg.wait_for_timeout(500)
    check("To'lov hisobi: 90 000 so'm, onlayn ulanmagan bo'lsa @murtozo_44", "90 000" in pg.inner_text("#plk") and "@murtozo_44" in pg.inner_text("#plk"))
    pg.evaluate("()=>{ payLinks({payme_merchant_id:'m1',click_service_id:'1',click_merchant_id:'2'},{id:7,amount:90000}).forEach(l=>window._l=(window._l||[]).concat(l[1])) }")
    links = pg.evaluate("()=>window._l")
    import base64
    check("Payme havolasi to'g'ri (tiyinda)", "ac.invoice_id=7;a=9000000" in base64.b64decode(links[0].split("/")[-1]).decode(), links[0])
    check("Click havolasi to'g'ri", "transaction_param=7" in links[1] and "amount=90000" in links[1])
    pg.click("#rep"); pg.wait_for_timeout(500)
    txt = pg.inner_text("body")
    check("Oylik hisobot: xodim, haftalar, aniqlik, final", "Test User" in txt and "420" in txt and "80%" in txt and "340" in txt and "Oktabr 2026" in txt, txt[:400])
    EXTRA["liga_pin_check"] = "bad"
    pg.evaluate("()=>{S.adminPin='';adminLogin()}"); pg.fill("#pin", "1"); pg.click("#go"); pg.wait_for_timeout(300)
    check("Noto'g'ri PIN rad etiladi", "noto'g'ri" in pg.inner_text("#st"))
    EXTRA.pop("liga_pin_check")
    check("Xatolar yo'q (11)", not errs, str(errs))

    # 12) Shaxsiy obuna: ro'yxatdan o'tgach to'lov, chek → ligaga qo'shiladi
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="Asia/Tashkent")
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    EXTRA["liga_player_status"] = [{"paid_until": None, "ok": False, "personal": True, "price": 30000, "pending": False}]
    pg.route("**supabase.co/**", mock([])); pg.clock.install(time="2026-10-01T05:00:00Z"); pg.goto(BASE); pg.wait_for_timeout(600)
    check("Ro'yxatdan o'tishda narx ko'rinadi", "oyiga 30 000 so'm" in pg.inner_text("#pinfo"))
    pg.fill("#f", "Sardor"); pg.fill("#l", "Aliyev"); pg.fill("#p", "901112244"); pg.select_option("#rg", "Toshkent shahri")
    pg.click("#go"); pg.wait_for_timeout(800)
    txt = pg.inner_text("body")
    check("Ro'yxatdan keyin to'lov oynasi: narx va karta", "Ligaga qo'shilish" in txt and "8600 1234 1234 1234" in txt and "30 000" in txt, txt[:300])
    pg.evaluate("()=>home()"); pg.wait_for_timeout(200)
    check("To'lanmagan — banner chiqadi", "obuna kerak" in pg.inner_text("body"))
    pg.evaluate("()=>intro(3)"); pg.wait_for_timeout(200)
    check("To'lanmagan — bosqich o'rniga to'lov oynasi", "Ligaga qo'shilish" in pg.inner_text("body"))
    pg.select_option("#pm", "3"); check("3 oy — 90 000 so'm", pg.inner_text("#amt") == "90 000")
    pg.evaluate("()=>{window._opened=[]; window.open=u=>{_opened.push(u)}; HTMLAnchorElement.prototype.click=function(){_opened.push(this.href)}}")
    pg.click("#tgpay"); pg.wait_for_timeout(400)
    check("Chekni botga yuborish havolasi", pg.evaluate("()=>(window._opened||[]).some(u=>u.indexOf('t.me/Buxgalterlar_Ligasi_bot?start=pay_abc123')>=0)"), str(pg.evaluate("()=>window._opened")))
    import base64 as _b
    png = _b.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
    pg.set_input_files("#rf", files=[{"name": "chek.png", "mimeType": "image/png", "buffer": png}]); pg.wait_for_timeout(500)
    CALLS.clear(); pg.click("#go"); pg.wait_for_timeout(600)
    sub = [c[1] for c in CALLS if c[0] == "liga_receipt_submit"]
    check("Chek yuborildi (JPEG, 3 oy, kalit bilan)", sub and sub[0]["p_months"] == 3 and sub[0]["p_image"].startswith("data:image/jpeg") and sub[0]["p_token"] == "tok-new", str([{k: (v[:30] if isinstance(v, str) else v) for k, v in x.items()} for x in sub]))
    check("Chekdan keyin ligaga qo'shildi", "Ligaga qo'shildingiz" in pg.inner_text("body") and not pg.evaluate("()=>playerBlocked()"))
    EXTRA.pop("liga_player_status")
    check("Xatolar yo'q (12)", not errs, str(errs))

    # 13) Admin (ASOSIY): cheklar, +1 oy
    EXTRA["liga_admin_group"] = [{"code": "ASOSIY", "name": "Buxgalterlar ligasi", "paid_until": None, "ok": True, "members": 8, "max_players": None, "start_date": "2026-09-28", "chats": 1, "region": None, "price": 30000}]
    pg, errs = page(b, "2026-10-01T06:00:00Z")
    pg.evaluate("()=>{S.adminPin='14';scrAdmin()}"); pg.wait_for_timeout(700)
    txt = pg.inner_text("body")
    check("Adminda cheklar va obuna holati", "To'lov cheklari" in txt and "1 yangi" in txt and "obuna to'lanmagan" in txt and "+1 oy" in txt, txt[:500])
    pg.on("dialog", lambda d: d.accept()); CALLS.clear()
    pg.click("[data-rok='11']"); pg.wait_for_timeout(300)
    check("Chek tasdiqlandi", any(c[0] == "liga_admin_receipt_decide" and c[1]["p_ok"] is True for c in CALLS))
    pg.click("[data-pay='p2']"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{window._opened=[]; HTMLAnchorElement.prototype.click=function(){_opened.push(this.href)}}")
    pg.click("#tgadm"); pg.wait_for_timeout(300)
    check("Admin: cheklarni Telegramda olish havolasi", pg.evaluate("()=>(window._opened||[]).some(u=>u.indexOf('start=adm_abc123')>=0)"))
    check("Naqd +1 oy yuborildi", any(c[0] == "liga_admin_player_pay" and c[1]["p_id"] == "p2" for c in CALLS))
    EXTRA.pop("liga_admin_group")
    check("Xatolar yo'q (13)", not errs, str(errs))
    b.close()

print("\nNATIJA:", "HAMMASI O'TDI" if not fails else f"{len(fails)} ta xato: {fails}")
sys.exit(1 if fails else 0)
