"""Hisobchi Liga 2.0 — avtomatik testlar (Playwright, server so'rovlari soxtalashtirilgan).
Ishga tushirish:  cd app && npm run build && python3 tests/app.test.py
"""
import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from harness import *

OK, BAD = [], []
def check(name, cond, extra=""):
    (OK if cond else BAD).append(name); print(("  ✓ " if cond else "  ✗ ") + name + (f"  [{extra}]" if (extra and not cond) else ""))
def go(pg, name, p=None): pg.evaluate("([n,p])=>__liga.nav.go(n,p)", [name, p]); pg.wait_for_timeout(450)
def S(pg, expr): return pg.evaluate("()=>{const S=__liga.st.S; return " + expr + "}")
def txt(pg): return pg.inner_text("body")
def calls(fn): return [a for f, a in CALLS if f == fn]
def cur_q(pg):
    """ekrandagi savol (run navbatidan) — to'g'ri javobni bilish uchun"""
    return pg.evaluate("""()=>{const r=__liga.nav.current().p.run, q=document.querySelector('.qtext').innerText.trim();
      const t=r.queue.find(x=>x.q.trim()===q); return t?{t:t.t,dt:t.dt,kt:t.kt,a:t.a,o:t.o,good:t.t==="mc"?String(t.o[t.a]).replace(/^(\\d{4}) .*/,"$1"):null}:null}""")
def answer(pg, right=True):
    """server o'yini: savol raqami bo'yicha taqlid serverdagi javobni olamiz (ilovada javob yo'q)"""
    import re
    m = re.search(r"Savol №(\d+)", pg.inner_text(".qtext")); k = int(m.group(1)) - 1
    rid = pg.evaluate("()=>window.__run.remote.id"); x = RUNS[rid]["ans"][k]; t = RUNS[rid]["items"][k]["t"]
    if t == "pv":
        dt, kt = (x["dt"], x["kt"]) if right else (x["kt"], x["dt"])
        for c in (dt, kt): pg.locator(".keys .key", has_text=c).first.click()
    elif t == "mc":
        good = ["Alfa", "Beta", "Gamma", "Delta"][x["a"]]; bad = ["Alfa", "Beta", "Gamma", "Delta"][(x["a"] + 1) % 4]
        pg.locator(".opts .opt", has_text=good if right else bad).first.click()
    else: pg.fill("#num", str(x["a"] if right else x["a"] + 7))
    pg.click("#chk"); pg.wait_for_timeout(450)
def answer_local(pg, right=True):
    q = cur_q(pg)
    if q["t"] == "pv":
        if right: dt, kt = q["dt"], q["kt"]
        else: dt, kt = q["kt"], q["dt"]
        for k in (dt, kt):
            loc = pg.locator(".keys .key", has_text=k).first
            if loc.count() == 0: loc = pg.locator(".keys .key").first
            loc.click()
    elif q["t"] == "mc":
        opts = pg.locator(".opts .opt"); n = opts.count()
        texts = [opts.nth(i).inner_text().strip() for i in range(n)]
        good = (q.get("good") or "").strip()
        idx = next((i for i, x in enumerate(texts) if x == good), 0)
        opts.nth(idx if right else (idx + 1) % n).click()
    else:
        pg.fill("#num", str(int(q["a"]) if right else int(q["a"]) + 7))
    pg.click("#chk"); pg.wait_for_timeout(350)

serve()
with sync_playwright() as p:
    b = p.chromium.launch()
    ALLERR = []

    print("1. Til tanlash va ro'yxatdan o'tish (taklif havolasi bilan)")
    pg, e = page(b, seed={}, query="?r=ABC123"); ALLERR += e
    t0 = txt(pg)
    check("3 til ko'rsatiladi", all(x in t0 for x in ["O'zbekcha", "Ўзбекча", "Русский"]))
    pg.click("text=Русский"); pg.wait_for_timeout(400)
    check("ro'yxat sahifasi ruscha", "Имя" in txt(pg) and "Фамилия" in txt(pg), txt(pg)[:200])
    pg.fill("#f", "Олим"); pg.fill("#l", "Каримов"); pg.fill("#p", "+998901112233"); pg.select_option("#rg", "Toshkent shahri")
    CALLS.clear(); pg.click("#go"); pg.wait_for_timeout(900)
    j = calls("liga_join3")
    check("liga_join3 chaqirildi", len(j) == 1)
    check("taklif kodi va til serverga ketdi", j and j[0].get("p_ref") == "ABC123" and j[0].get("p_lang") == "ru", j)
    check("shaxsiy ishtirokchi → to'lov sahifasi", "5614" in txt(pg) and "30 000" in txt(pg), txt(pg)[:300])
    check("token saqlandi", S(pg, "S.token") == "tok-new")

    print("2. Kirill va rus tillari")
    pg, e = page(b, seed={**SEED, "lang": "uzc"}); ALLERR += e
    check("o'zbek kirill: bosh sahifa", "Бошлаш" in txt(pg) or "босқич" in txt(pg).lower(), txt(pg)[:200])
    pg, e = page(b, seed={**SEED, "lang": "ru"}); ALLERR += e
    check("rus: bosh sahifa", "этап" in txt(pg).lower() and "Главная" in txt(pg))
    r = subprocess.run(["node", "scripts/i18n-keys.mjs"], cwd=ROOT, capture_output=True, text=True)
    check("rus lug'atida tarjimasi yo'q matn qolmagan", "RU da yo'q: 0" in r.stdout, r.stdout)

    print("3. Bosqich: to'g'ri / xato / halol o'yin")
    pg, e = page(b); ALLERR += e
    si = pg.evaluate("()=>__liga.time.todayStage()")
    check("bugungi bosqich = 4-bosqich (payshanba)", si == 3, si)
    go(pg, "intro", {"si": si}); pg.click("#go"); pg.wait_for_timeout(500)
    check("savol ochildi", pg.locator(".qtext").count() == 1)
    leak = pg.evaluate("()=>{const q=__liga.nav.current().p.run.queue; return q.some(x=>x.dt||x.kt||x.a!=null)}")
    check("ilovada bosqich savollarining javobi yo'q (faqat serverda)", leak is False)
    check("savol ko'rsatilgani serverga aytildi (vaqt serverda)", len(calls("liga_run_show")) >= 1)
    xp0 = S(pg, "S.xp"); answer(pg, True)
    check("to'g'ri javob: TO'G'RI muhri", pg.locator(".stamp.ok").count() == 1)
    check("to'g'ri javob: +10 XP", S(pg, "S.xp") == xp0 + 10, (xp0, S(pg, "S.xp")))
    check("haftalik liga bali ham oshdi", S(pg, "S.week.stages['3']") == 10, S(pg, "S.week.stages"))
    pg.click("#nx"); pg.wait_for_timeout(400)
    answer(pg, False)
    check("xato javob: XATO muhri va to'g'ri javob serverdan", pg.locator(".stamp.bad").count() == 1 and "To'g'ri" in txt(pg) and "Izoh: shunday" in txt(pg))
    check("javob serverga yuborildi", len(calls("liga_run_answer")) >= 2)
    pg.click("#nx"); pg.wait_for_timeout(400)
    HIDE = "()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))}"
    SHOW = "()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))}"
    pg.evaluate(HIDE); pg.clock.fast_forward(2500); pg.evaluate(SHOW); pg.wait_for_timeout(300)
    check("3 soniyagacha chiqib qaytish kechiriladi (bildirishnoma, qo'ng'iroq)", "Ilovadan chiqildi" not in txt(pg) and pg.locator("#chk").count() == 1)
    pg.evaluate(HIDE); pg.clock.fast_forward(5000); pg.evaluate(SHOW); pg.wait_for_timeout(400)
    check("bosqichdagi birinchi uzoq chiqish — faqat ogohlantirish, savol xato emas", "Ilovadan chiqildi" not in txt(pg) and pg.locator("#chk").count() == 1 and "Ogohlantirish" in txt(pg), txt(pg)[-300:])
    pg.evaluate(HIDE); pg.clock.fast_forward(5000); pg.evaluate(SHOW); pg.wait_for_timeout(400)
    check("ikkinchi uzoq chiqish = xato (halol o'yin)", "Ilovadan chiqildi" in txt(pg), txt(pg)[-300:])
    check("nusxa olish bloklangan", pg.evaluate("()=>{const e=new Event('copy',{cancelable:true});document.dispatchEvent(e);return e.defaultPrevented}"))
    check("ekranda ism suv belgisi", pg.locator(".wm").count() == 1 and "Dilnoza" in pg.inner_text(".wm"))
    pg.click("#nx"); pg.wait_for_timeout(400); pg.wait_for_selector("#chk")
    pg.evaluate("()=>window.dispatchEvent(new Event('blur'))"); pg.clock.fast_forward(5000); pg.evaluate("()=>window.dispatchEvent(new Event('focus'))"); pg.wait_for_timeout(900)
    check("kompyuterda boshqa oynaga (AI chat) o'tish ham = xato", "Ilovadan chiqildi" in txt(pg), txt(pg)[-200:])
    aw = calls("liga_run_away")
    check("har bir chiqish serverga yoziladi (savol raqami va soniya bilan)", len(aw) >= 2 and all(a.get("p_ms", 0) >= 400 and "p_k" in a for a in aw), aw)
    pg.click("#nx"); pg.wait_for_timeout(300)
    pg.evaluate("()=>__liga.nav.tryBack()"); pg.wait_for_timeout(300)
    check("orqaga bosilganda tasdiq so'raladi", "Chiqasizmi?" in txt(pg))

    print("3b. Jon cheklovi yo'q: 6 ta xatodan keyin ham bosqich davom etadi")
    pg, e = page(b); ALLERR += e
    go(pg, "intro", {"si": 3}); pg.click("#go"); pg.wait_for_timeout(500)
    check("bosqichda yurakchalar (jon) ko'rsatilmaydi", pg.locator(".hearts").count() == 0)
    for _ in range(6):
        answer(pg, False); pg.click("#nx"); pg.wait_for_timeout(350)
    check("6 ta xatodan keyin ham keyingi savol ochiq (bosqich to'xtamadi)", pg.locator(".qtext").count() == 1 and pg.locator("#chk").count() == 1, txt(pg)[:200])
    pg, e = page(b); ALLERR += e
    rr = pg.evaluate("()=>{const r=__liga.run.startDaily();return [r.maxLives,r.lives]}")
    check("kunlik mashqda ham jon cheklovi yo'q", rr[0] == 0 and rr[1] >= 99, rr)

    print("3c. Ijtimoiy soliq — 6520")
    bad = pg.evaluate("""()=>{const c=__liga.run.C(); const all=c.STAGES.flatMap(s=>s.tasks);
      return all.filter(t=>t.t==='pv'&&/ijtimoiy soliq/i.test(t.q)&&!/JShDS/.test(t.q)&&(t.dt==='6410'||t.kt==='6410')).map(t=>t.q)}""")
    check("mashq savollarida ijtimoiy soliq 6410 da emas", bad == [], bad)
    soc = pg.evaluate("""()=>__liga.run.C().STAGES.flatMap(s=>s.tasks).filter(t=>t.t==='pv'&&/ijtimoiy soliq hisoblandi/i.test(t.q))""")
    check("ijtimoiy soliq hisoblanishi: Kt 6520 va 6520 variantlarda", len(soc) >= 2 and all(t["kt"] == "6520" and "6520" in t["o"] for t in soc), soc[:2])
    check("hisobvaraqlar ro'yxatida 6520 bor", pg.evaluate("()=>!!__liga.run.C().A['6520']"))

    print("3d. Ochilish: yuklanish ekrani, xato bo'lsa qayta yuklash")
    raw = open(os.path.join(ROOT, "dist", "index.html"), encoding="utf-8").read()
    check("Telegram skripti sahifani to'xtatib turmaydi (sinxron <script src=telegram> yo'q)", 'src="https://telegram.org' not in raw)
    check("yuklanish ekrani va 15 s nazorat bor", 'id="boot"' in raw and "__ligaFail" in raw and "Qayta yuklash" in raw)
    check("eski telefonlar uchun legacy to'plam (nomodule)", "nomodule" in raw and "polyfills-legacy" in raw)
    import glob
    leg = glob.glob(os.path.join(ROOT, "dist", "assets", "start-legacy-*.js"))
    es5 = subprocess.run(["npx", "-y", "esbuild@0.24", leg[0], "--target=es5", "--log-level=error", "--outfile=/dev/null"], capture_output=True, text=True) if leg else None
    check("legacy to'plam ES5 (const/=>/class yo'q)", bool(leg) and es5.returncode == 0, (es5.stderr[:300] if es5 else "yo'q"))
    check("ilova yuklangach yuklanish ekrani yo'qoladi", pg.locator("#boot").count() == 0 and pg.evaluate("()=>window.__ligaMounted===true"))
    sw = open(os.path.join(ROOT, "dist", "sw.js"), encoding="utf-8").read()
    check("service worker: sahifa 5 s da kelmasa — keshdagisi", "netFirst(r, 5000)" in sw and "hisobchi-liga-v3" in sw)
    crash = b.new_context().new_page(); cerr = []
    crash.on("pageerror", lambda x: cerr.append(str(x)))
    crash.route("**supabase.co/**", handler); crash.route("**telegram.org/**", lambda r: r.fulfill(status=200, body=""))
    crash.route("**/assets/start-*.js", lambda r: r.fulfill(status=404, body=""))
    crash.clock.install(); crash.goto(BASE); crash.wait_for_timeout(800)
    crash.clock.fast_forward(16000); crash.wait_for_timeout(300)
    check("ilova fayli yuklanmasa — oq ekran emas, «Qayta yuklash» tugmasi", crash.locator("#boot-reload").count() == 1 and "ochilmadi" in crash.inner_text("body"), crash.inner_text("body")[:200])
    check("ochilmaslik serverga yoziladi (liga_client_err)", any(f == "liga_client_err" for f, _ in CALLS))
    crash.close()

    print("3e. Ekranda xato bo'lsa — Boundary")
    pg, e = page(b); ALLERR += e
    pg.evaluate("()=>{__liga.nav.go('lesson',{id:'__yoq__'})}"); pg.wait_for_timeout(500)
    check("buzuq ekran oq qolmaydi (xabar yoki bosh sahifa)", len(txt(pg).strip()) > 20)

    print("4. Vaqt qoidalari")
    pg, e = page(b); ALLERR += e
    check("ertangi bosqich yopiq", pg.evaluate("()=>__liga.time.stageState(4)") == "future")
    check("kechagi bosqich yopiq", pg.evaluate("()=>__liga.time.stageState(2)") in ("closed", "done"))
    go(pg, "intro", {"si": 4}); pg.click("#go"); pg.wait_for_timeout(300)
    check("kelajak bosqich bosilganda xabar", "09:00" in txt(pg))
    pg, e = page(b, when="2026-10-03T06:00:00Z"); ALLERR += e
    check("juma 17:00 dan keyin (shanba): hafta yakuni ekrani", "Haftalik liga yakunlandi" in txt(pg))
    pg.evaluate("()=>__liga.nav.tab('home')"); pg.wait_for_timeout(400)
    check("shanba: dam olish kuni", pg.evaluate("()=>__liga.time.isWeekend()") and "Dam olish" in txt(pg))
    pg, e = page(b, when="2026-10-01T12:30:00Z"); ALLERR += e
    check("17:00 dan keyin bosqich yopiq", pg.evaluate("()=>__liga.time.stageOpen(3)") is False)

    pg, e = page(b, when="2026-10-02T06:30:00Z"); ALLERR += e
    check("juma 11:30 — bosqich ochiq", pg.evaluate("()=>__liga.time.stageOpen(__liga.time.todayStage())") is True)
    check("juma: «17:00 gacha» yozuvi (juma ham boshqa kunlar kabi)", "17:00 gacha" in txt(pg), txt(pg)[:300])
    pg, e = page(b, when="2026-10-02T07:30:00Z", seed={**SEED, "week": {**SEED["week"], "id": "2026-10-02T07:00"}}); ALLERR += e
    check("juma 12:30 — bosqich hali ochiq, hafta almashmagan", pg.evaluate("()=>__liga.time.stageOpen(__liga.time.todayStage())") is True and S(pg, "S.week.id") == "2026-10-02T07:00")
    pg, e = page(b, when="2026-10-02T11:59:00Z", seed={**SEED, "week": {**SEED["week"], "id": "2026-10-02T07:00"}}); ALLERR += e
    pg.clock.fast_forward(120000); pg.wait_for_timeout(300)
    pg.evaluate("()=>document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(500)
    check("juma 17:00 — bosqich yopildi", pg.evaluate("()=>__liga.time.stageOpen(__liga.time.todayStage())") is False)
    check("ilova ochiq turganda hafta 17:00 da yangilandi (id yozuvi o'zgarmagan: T07:00)", S(pg, "S.week.id") == "2026-10-09T07:00" and S(pg, "S.week.my") == 0, S(pg, "S.week"))

    print("4b. Telegram va shaxsiy natija")
    pg, e = page(b); ALLERR += e
    check("Telegram ulash kartasi ko'rinadi", pg.locator(".tglink").count() == 1)
    CALLS.clear(); pg.evaluate("()=>{window.open=()=>null}"); pg.click(".tglink"); pg.wait_for_timeout(500)
    check("ulash kodi so'raldi", len(calls("liga_tg_link_code")) == 1)
    si = pg.evaluate("()=>__liga.time.todayStage()")
    EXTRA["_prefill"] = 19
    go(pg, "intro", {"si": si}); pg.click("#go"); pg.wait_for_timeout(600)
    del EXTRA["_prefill"]
    CALLS.clear(); answer(pg, True); pg.click("#nx"); pg.wait_for_timeout(1500)
    for _ in range(10):
        if calls("bot:stage_done"): break
        pg.wait_for_timeout(400)
    sd = calls("bot:stage_done")
    check("bosqich tugaganda natija botga yuborildi", len(sd) == 1 and sd[0].get("si") == si and sd[0].get("right") == 20, sd)
    check("3 yulduz va bonus serverdan", "Bosqich yakunlandi" in txt(pg) and S(pg, "S.stars[%d]" % si) == 3, txt(pg)[:200])
    check("bosqich bali = server hisobi (200 + 90 bonus)", S(pg, "S.week.stages['%d']" % si) == 290, S(pg, "S.week.stages"))
    EXTRA["liga_me"] = [{"xp": 9999, "stages": 5, "week_id": "2026-10-02T07:00", "week_stages": {"0": 440, "1": 390, "2": 360}, "cur_week": "2026-10-02T07:00"}]
    pg, e = page(b); ALLERR += e
    pg.wait_for_timeout(800)
    check("serverdagi ball telefonga qaytdi (yangi telefon)", S(pg, "S.xp") >= 9999 and S(pg, "S.week.stages['0']") == 440, (S(pg, "S.xp"), S(pg, "S.week.stages")))
    del EXTRA["liga_me"]
    EXTRA["liga_join3"] = {"__error": "phone_taken"}
    pg, e = page(b, seed={}); ALLERR += e
    pg.click("text=O'zbekcha"); pg.wait_for_timeout(400)
    pg.fill("#f", "Olim"); pg.fill("#l", "Karimov"); pg.fill("#p", "+998901112233"); pg.select_option("#rg", "Toshkent shahri")
    pg.click("#go"); pg.wait_for_timeout(900)
    check("raqam band bo'lsa to'lovga o'tmaydi, Telegram orqali kirish taklif qilinadi", "5614" not in txt(pg) and "Telegram bilan kiring" in txt(pg), txt(pg)[-300:])
    del EXTRA["liga_join3"]
    EXTRA["liga_free_days"] = 30
    pg, e = page(b, seed={}); ALLERR += e
    pg.click("text=O'zbekcha"); pg.wait_for_timeout(500)
    check("yangi a'zo: «birinchi 30 kun bepul» yozuvi", pg.locator("#free-note").count() == 1 and "30 kun bepul" in pg.inner_text("#free-note"), txt(pg)[-300:])
    pg.fill("#f", "Yangi"); pg.fill("#l", "Odam"); pg.fill("#p", "+998901119988"); pg.select_option("#rg", "Toshkent shahri")
    pg.click("#go"); pg.wait_for_timeout(900)
    check("bepul davr: ro'yxatdan keyin to'lov sahifasi ochilmaydi", "5614" not in txt(pg) and pg.locator("#pay-sent, #pay-pending").count() == 0 and S(pg, "S.me.ok") is True, txt(pg)[:200])
    del EXTRA["liga_free_days"]

    print("5. Mashq rejimlari")
    pg, e = page(b); ALLERR += e
    r = pg.evaluate("()=>{const r=__liga.run.startBlitz(); return {n:r.queue.length, mode:r.mode}}")
    check("blits: 20 provodka", r == {"n": 20, "mode": "blitz"}, r)
    r = pg.evaluate("()=>{const r=__liga.run.startDaily(); return r.queue.length}")
    check("kunlik mashq: 10 savol", r == 10, r)
    r = pg.evaluate("()=>{const r=__liga.run.startTopic('qqs'); return typeof r==='string'?r:r.queue.length}")
    check("yo'nalish (QQS): 10 savol", r == 10, r)
    r = pg.evaluate("()=>{const r=__liga.run.startTopic('amaliyot'); return typeof r==='string'?r:r.queue.length}")
    check("yangi yo'nalish: Didox, my.soliq, 1C", r == 10, r)
    xp0 = S(pg, "S.xp"); go(pg, "lesson", {"id": "L05"}); pg.click("#go"); pg.wait_for_timeout(300)
    go(pg, "lesson", {"id": "L05"}); pg.click("#go"); pg.wait_for_timeout(300)
    check("mini-dars: +15 XP faqat bir marta", S(pg, "S.xp") == xp0 + 15, (xp0, S(pg, "S.xp")))
    go(pg, "balance")
    check("balans o'yini ochildi", "Aktiv" in txt(pg) and "Kapital" in txt(pg))

    print("6. Duel, ulashish, taklif")
    pg, e = page(b); ALLERR += e
    go(pg, "duel"); CALLS.clear(); pg.click("#create"); pg.wait_for_timeout(600)
    check("duel yaratildi (server)", len(calls("liga_duel_create")) == 1)
    go(pg, "duel", {"code": "HMAH87"}); pg.wait_for_timeout(400)
    check("taklif qilingan duel: qabul tugmasi", pg.locator("#play").count() == 1)
    CALLS.clear(); pg.click("#play"); pg.wait_for_timeout(600)
    check("duel savollari serverdan", len(calls("liga_duel_start")) == 1 and pg.locator(".qtext").count() == 1)
    for i in range(10):
        answer(pg, i < 7)
        pg.click("#nx"); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1300)
    check("duel natijasi serverda hisoblandi (7/10)", "7/10" in txt(pg).replace(" ", ""), txt(pg)[:200])
    check("duel tugagach bot xabardor qilindi", len(calls("bot:duel_done")) == 1)
    go(pg, "share", {"kind": "week"}); pg.wait_for_timeout(700)
    check("ulashish: kartochka rasmi chizildi", pg.locator("img[src^='data:image']").count() >= 1)
    check("taklif havolasi shaxsiy kod bilan", "S5HMGC" in pg.content())

    print("7. Reyting, darajalar, final")
    pg.evaluate("()=>__liga.nav.tab('rate')"); pg.wait_for_timeout(400)
    pg.click("text=Daraja"); pg.wait_for_timeout(300)
    check("4 ta liga darajasi", all(x in txt(pg) for x in ["Bronza", "Kumush", "Oltin", "Olmos"]))
    pg.click("text=Hafta"); pg.wait_for_timeout(300)
    check("hafta davomida boshqalar bali yashirin", pg.locator(".board .r svg.lucide-lock").count() >= 2)
    go(pg, "finalLive"); pg.wait_for_timeout(400)
    check("jonli final jadvali", "Aziz R." in txt(pg))

    print("8. To'lov")
    go(pg, "pay")
    check("karta raqami va narx", "5614 6810 1287 6904" in txt(pg) and "30 000" in txt(pg))
    CALLS.clear(); pg.click("text=3 oy"); pg.wait_for_timeout(200)
    check("3 oy = 90 000 so'm", "90 000" in txt(pg))
    check("to'lov: bosqich faqat tasdiqdan keyin ochilishi yozilgan", "tasdiqlagandan keyin ochiladi" in txt(pg))
    PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    import base64 as _b64
    pg.set_input_files("#rf", files=[{"name": "chek.png", "mimeType": "image/png", "buffer": _b64.b64decode(PNG)}]); pg.wait_for_timeout(500)
    pg.evaluate("()=>{__liga.st.S.me={...(__liga.st.S.me||{}), ok:false, personal:true, pending:false}; __liga.st.persist()}")
    CALLS.clear(); pg.click("#go"); pg.wait_for_timeout(700)
    check("chek serverga yuborildi", len(calls("liga_receipt_submit")) == 1, CALLS)
    check("chekdan keyin: «tekshiruvga yuborildi», bosqich ochilmadi", pg.locator("#pay-sent").count() == 1 and S(pg, "S.me.ok") is False and S(pg, "S.me.pending") is True, txt(pg)[:200])
    EXTRA["liga_player_status2"] = [{"paid_until": "2026-10-04", "ok": False, "personal": True, "price": 30000, "pending": True, "tier": 1, "ref_code": "S5HMGC", "refs": 2, "tg_linked": True, "lang": "uz"}]
    pg.evaluate("()=>__liga.nav.tab('home')"); pg.wait_for_timeout(500)
    check("bosh sahifa: «Chekingiz tekshirilmoqda» (to'lov tugmasi yo'q)", pg.locator("#pay-wait").count() == 1 and "To'lov qilish" not in pg.inner_text(".ticket"), txt(pg)[:200])
    go(pg, "pay"); pg.wait_for_timeout(300)
    check("to'lov sahifasi: tekshiruvdagi chek — yangisini yuborish shart emas", pg.locator("#pay-pending").count() == 1)
    EXTRA["liga_player_status2"] = [{"paid_until": "2026-10-04", "ok": False, "personal": True, "price": 30000, "pending": False, "tier": 1, "ref_code": "S5HMGC", "refs": 2, "tg_linked": True, "lang": "uz"}]
    pg.evaluate("()=>{__liga.st.S.me={...__liga.st.S.me, pending:false}; __liga.st.persist()}"); go(pg, "pay"); pg.wait_for_timeout(300)
    for key, word in [("receipt_dup", "avval yuborilgan"), ("receipt_blocked", "to'xtatildi")]:
        EXTRA["liga_receipt_submit"] = {"__error": key}
        pg.set_input_files("#rf", files=[{"name": "chek.png", "mimeType": "image/png", "buffer": _b64.b64decode(PNG)}]); pg.wait_for_timeout(400)
        pg.click("#go"); pg.wait_for_timeout(500)
        check(f"soxta/takror chek rad: {key}", word in pg.inner_text(".err") and pg.locator("#pay-sent").count() == 0, pg.inner_text(".err"))
    EXTRA.pop("liga_receipt_submit", None); EXTRA.pop("liga_player_status2", None)
    pg.evaluate("()=>{__liga.st.S.me={...__liga.st.S.me, ok:true, pending:false, paid_until:'2026-10-30'}; __liga.st.persist()}")

    print("9. Admin")
    pg.evaluate("()=>{__liga.st.S.adminPin='14'; __liga.st.persist()}"); go(pg, "admin"); pg.wait_for_timeout(600)
    pg.click("text=A'zolar"); pg.wait_for_timeout(300)
    check("a'zolar ro'yxati", "Aziz" in txt(pg) and "Dilnoza" in txt(pg))
    pg.click("text=Cheklar"); pg.wait_for_timeout(400)
    pg.once("dialog", lambda d: d.accept()); CALLS.clear()
    pg.click("[data-rok='11']"); pg.wait_for_timeout(500)
    check("chekni tasdiqlash serverga ketdi", len(calls("liga_admin_receipt_decide")) == 1, CALLS)
    go(pg, "report"); pg.wait_for_timeout(500)
    check("oylik hisobot", "2 420" in txt(pg) or "2420" in txt(pg))

    print("10. Sertifikat va xodim testi (ro'yxatsiz)")
    pg, e = page(b, seed=None, query="?v=ABCD2345"); pg.wait_for_timeout(500); ALLERR += e
    check("sertifikat tekshiruvi", "Dilnoza Karimova" in txt(pg) and "haqiqiy" in txt(pg).lower())
    check("tekshiruv: seriya, raqamli imzo va jonli soat", "HL-2026-39-1-ABCD2345" in txt(pg) and "10D1-F75C-DF20-30A3" in txt(pg) and pg.locator(".v-live").count() == 1)
    check("tekshiruv: shu haftaning kuchli uchligi (3 medal)", pg.locator(".v-peers li").count() == 3 and pg.locator(".v-peers svg.medal").count() == 3)
    check("sertifikatda «ball» (XP yo'q) va kengash imzosi", "1 310 ball" in pg.inner_text(".cert") and "XP" not in pg.inner_text(".cert") and "Hakamlar hay'ati" in pg.inner_text(".cert"))
    check("1-o'rin sertifikati — oltin dizayn", pg.locator(".cert.cert-gold").count() == 1 and "Oltin daraja" in pg.inner_text(".cert") and pg.locator(".cert-qr img").count() == 1)
    pg, e = page(b, seed=None, query="?v=EFGH6789"); pg.wait_for_timeout(500); ALLERR += e
    check("2-o'rin sertifikati — kumush, boshqa dizayn", pg.locator(".cert.cert-silver").count() == 1 and "Kumush daraja" in pg.inner_text(".cert") and "2-o'rin" in pg.inner_text(".cert"))
    pg, e = page(b, seed=None, query="?v=ZZZZ0000"); pg.wait_for_timeout(500); ALLERR += e
    check("soxta raqam — «topilmadi»", pg.locator("#v-bad").count() == 1 and pg.locator(".cert").count() == 0)
    pg, e = page(b, seed=None, query="?t=TST7ABC"); ALLERR += e
    check("xodim testi sahifasi", "Bosh buxgalter lavozimiga test" in txt(pg))
    pg.click("#go"); pg.wait_for_timeout(300)
    check("ismsiz boshlanmaydi", pg.locator(".qtext").count() == 0)
    pg.fill("#cn", "Nomzod Ikki"); pg.fill("#cp", "+998901234599"); CALLS.clear(); pg.click("#go"); pg.wait_for_timeout(700)
    check("test boshlandi (savollar serverdan)", pg.locator(".qtext").count() == 1 and len(calls("liga_test_begin")) == 1)
    answer(pg, True)
    a = [x for x in calls("liga_run_answer") if not str(x.get("p_run", "")).startswith("stage")]   # oldingi sahifalarning kech javoblari hisobga olinmaydi
    check("nomzod javobi maxfiy kalit bilan tekshirildi", a and a[-1].get("p_secret") == "sek" and pg.locator(".stamp.ok").count() == 1, a[-1:] if a else a)

    print("10b. Telegram orqali kirish")
    EXTRA["bot:tg_login"] = {"found": True, "id": "p9", "token": "tok-tg", "first": "Ali", "last": "Valiyev", "phone": "+998901110000", "region": "Toshkent shahri", "group": "ASOSIY", "lang": "uz", "xp": 500, "ref_code": "ALI123"}
    pg, e = page(b, seed={}, tg=True); pg.wait_for_timeout(900); ALLERR += e
    check("Telegram ichida: ro'yxatsiz avtomatik kirildi", S(pg, "S.pid") == "p9" and S(pg, "S.token") == "tok-tg" and "Ali" in txt(pg), txt(pg)[:200])
    del EXTRA["bot:tg_login"]
    pg, e = page(b, seed={}); ALLERR += e
    pg.click("text=O'zbekcha"); pg.wait_for_timeout(400)
    check("brauzerda: «Telegram orqali kirish» kartasi", pg.locator("#tglogin").count() == 1)
    EXTRA["liga_login_poll"] = {"id": "p8", "token": "tok-web", "first": "Vali", "last": "Aliyev", "phone": "+998901110001", "region": "Toshkent shahri", "group": "ASOSIY", "lang": "uz", "xp": 0}
    with pg.expect_popup() as pop: pg.click("#tglogin")
    pg.clock.fast_forward(3000); pg.wait_for_timeout(1200)
    check("bot orqali tasdiqlangach ilovaga kirildi", S(pg, "S.pid") == "p8" and S(pg, "S.token") == "tok-web", (S(pg, "S.pid"), CALLS[-3:]))
    del EXTRA["liga_login_poll"]

    print("10c. Soliq taqvimi, yangiliklar, kalkulyator, bellashuv")
    pg, e = page(b); ALLERR += e
    check("bosh sahifada yaqin muddat kartasi (2 kun qoldi)", pg.locator(".deadline").count() == 1 and "2 kun qoldi" in txt(pg), txt(pg)[:400])
    check("bosh sahifada qonun yangiligi", pg.locator(".news-card").count() == 1)
    go(pg, "calendar")
    check("taqvim ro'yxati", pg.locator(".cal-row").count() >= 3)
    CALLS.clear(); pg.click("text=O'chirilgan"); pg.wait_for_timeout(300)
    check("eslatmani o'chirish serverga yozildi", calls("liga_set_tax_remind") and calls("liga_set_tax_remind")[0].get("p_on") is False)
    go(pg, "newsView", {"id": 7})
    check("yangilik matni va manba", "5 kun ichida" in txt(pg) and "Manbani ochish" in txt(pg))
    pg.click("#go"); pg.wait_for_timeout(400)
    check("yangilik bo'yicha test", pg.locator(".qtext").count() == 1 and "necha kunda" in txt(pg))
    go(pg, "calc")
    check("ish haqi: 8 000 000 → qo'lga 7 040 000", "7 040 000" in txt(pg), txt(pg)[:500])
    pg.click("text=QQS >> nth=0"); pg.wait_for_timeout(200)
    check("QQS: 10 000 000 + 12% = 1 200 000", "1 200 000" in txt(pg) and "11 200 000" in txt(pg))
    pg.click("text=Amortizatsiya"); pg.wait_for_timeout(200)
    check("amortizatsiya: 60 mln / 5 yil = 12 000 000 yiliga", "12 000 000" in txt(pg) and "1 000 000" in txt(pg))
    pg.evaluate("()=>__liga.nav.tab('rate')"); pg.wait_for_timeout(400)
    check("jamoalar bellashuvi kartasi", "Qo'qon audit" in txt(pg) and "VS" in txt(pg))
    pg.evaluate("()=>{__liga.st.S.superPin='24'; __liga.st.persist()}"); go(pg, "super"); pg.wait_for_timeout(400)
    pg.click("text=Taqvim"); pg.wait_for_timeout(300)
    check("superadmin: taqvim muharriri", "Yangi muddat" in txt(pg))
    pg.click("text=Yangilik"); pg.wait_for_timeout(300)
    check("superadmin: yangilik muharriri", "Yangi qonun yangiligi" in txt(pg))
    pg.evaluate("()=>{__liga.st.S.superPin=''; __liga.st.S.adminPin='14'; __liga.st.persist()}"); go(pg, "admin"); pg.wait_for_timeout(500)
    pg.click("text=Testlar"); pg.wait_for_timeout(400); pg.click("text=Natijalar"); pg.wait_for_timeout(300)
    EXTRA_DET = None
    pg.locator(".board .r").first.click(); pg.wait_for_timeout(400)
    check("nomzod hisoboti (PDF) ochildi", "Nomzod hisoboti" in txt(pg) and "Nomzod Bir" in txt(pg), txt(pg)[:300])

    print("10d. G'olib vaqti, javob effekti, xatolar ustida ishlash, imtiyozlar, sinov rejimi")
    EXTRA["_extra"] = 7
    pg, e = page(b); ALLERR += e
    check("bosh sahifa: bonus soniya ko'rsatilmaydi (hamma uchun teng)", "+7 soniya" not in pg.inner_text("body"), pg.inner_text("body")[:300])
    go(pg, "intro", {"si": 3}); pg.wait_for_timeout(300)
    rw = pg.inner_text("#rw-start") if pg.locator("#rw-start").count() else ""
    check("bosqich boshida: kuchli uchlik — hamma uchun teng 2 daqiqa", "2 daqiqa" in rw and "+10" not in rw, rw[:200])
    check("bosqich boshida: vaqt plitkasi «2 daqiqa · hamma uchun teng»", "hamma uchun teng" in txt(pg) and "67 soniya" not in txt(pg))
    pg.click("#go"); pg.wait_for_timeout(700)
    check("savolda g'olib bonusi belgisi (+7 s)", pg.locator("#xsec").count() == 1 and "+7" in pg.inner_text("#xsec"))
    lft = int(pg.inner_text(".timer b"))
    check("savol vaqti 60+7 soniya", 61 <= lft <= 67, lft)
    pg.evaluate("()=>{window.__vib=[]; navigator.vibrate=(p)=>{window.__vib.push(p); return true}}")
    answer(pg, right=False)
    check("xato: katta qizil X va silkinish", pg.locator(".cheer.bad .bigx").count() == 1 and pg.locator(".qcard.shake").count() == 1)
    check("xato: telefon vibratsiyasi", pg.evaluate("()=>JSON.stringify(window.__vib.slice(-1))") == "[[90,50,160]]", pg.evaluate("()=>JSON.stringify(window.__vib)"))
    pg.click("#exbtn"); pg.wait_for_timeout(300)
    ex = pg.inner_text(".sheet-fb .explain")
    check("misol bilan tushuntirish: ikki T-hisob, summa va qoida", pg.locator(".sheet-fb .tbox").count() == 2 and "1 000 000" in ex and "Aktiv hisobvaraq" in ex, ex[:300])
    check("tushuntirish: tomonlar almashgani aytiladi", "almashib" in ex)
    check("xato daftariga savol to'liq yozildi", S(pg, "Object.values(S.errInfo||{}).some(x=>x.task&&x.task.dt==='5010')"))
    pg.click("#nx"); pg.wait_for_timeout(400)
    answer(pg, right=True)
    check("to'g'ri: yon tomonlardan yashil sharlar va belgilar", pg.locator(".cheer.ok .bln").count() >= 10 and pg.locator(".cheer.ok .chk").count() >= 1)
    pg.wait_for_timeout(2500)
    check("effekt o'zi yo'qoladi", pg.locator(".cheer").count() == 0)
    EXTRA.pop("_extra", None)

    go(pg, "review"); pg.wait_for_timeout(300)
    check("xatolar ustida ishlash ekrani: misol bilan", "Xatolar ustida ishlash" in txt(pg) and pg.locator(".err-card .explain").count() == 1)
    pg.click("#rv-go"); pg.wait_for_timeout(500)
    kinds = pg.evaluate("()=>window.__run.queue.map(q=>q.rv&&q.rv.kind)")
    check("mashq: asl savol + chalg'ituvchi + teskari savol", "orig" in kinds and "dist" in kinds and kinds[-1] == "rev", kinds)
    rq = pg.evaluate("()=>window.__run.queue[window.__run.queue.length-1].q")
    check("teskari savol: provodkadan muomalani topish", "Dt 5010" in rq and "qaysi muomalani" in rq, rq)
    for _ in range(8):
        if pg.locator(".qtext").count() == 0: break
        answer_local(pg, True); pg.click("#nx"); pg.wait_for_timeout(350)
    check("natija: xato o'zlashtirildi va daftardan o'chdi", "o'zlashtirildi" in txt(pg) and S(pg, "!Object.keys(S.errs).some(k=>k.startsWith('S:'))"), txt(pg)[:300])

    EXTRA["_prefill"] = 18
    go(pg, "intro", {"si": 3}); pg.click("#go"); pg.wait_for_timeout(700)
    answer(pg, right=False); pg.click("#nx"); pg.wait_for_timeout(300); answer(pg, right=True); pg.click("#nx"); pg.wait_for_timeout(1200)
    EXTRA.pop("_prefill", None)
    check("bosqich yakunida: kuchli uchlik (bonus soniyasiz)", pg.locator("#rw-end").count() == 1 and "+10" not in pg.inner_text("#rw-end") and "2 daqiqa" in pg.inner_text("#rw-end"))
    check("yakunda: «Xatolarni tahlil qilish» tugmasi", pg.locator("#toreview").count() == 1)
    pg.evaluate("()=>__liga.nav.tab('rate')"); pg.wait_for_timeout(400)
    check("reyting: kunlik kuchli uchlik", pg.locator("#daytop-card").count() == 1 and "Aziz R." in pg.inner_text("#daytop-card"))

    EXTRA["liga_trial"] = True
    EXTRA["liga_player_status2"] = [{"paid_until": None, "ok": False, "personal": True, "price": 30000, "pending": False, "tier": 1, "ref_code": "S5HMGC", "refs": 2, "tg_linked": True, "lang": "uz"}]
    pg, e = page(b, seed={**SEED, "me": {**SEED["me"], "ok": False, "paid_until": None}}); ALLERR += e
    pg.wait_for_timeout(600)
    check("sinov rejimi: to'lovsiz ham bosqich ochiq", "obuna kerak" not in txt(pg) and S(pg, "S.trial===true"))
    pg.evaluate("()=>__liga.nav.tab('profile')"); pg.wait_for_timeout(400)
    check("profil: «Sinov davri — bepul»", pg.locator("#trial-note").count() == 1)
    pg.evaluate("()=>{__liga.st.S.superPin='24'; __liga.st.persist()}"); go(pg, "super"); pg.click("text=Karta"); pg.wait_for_timeout(300)
    pg.click("#trial-flip"); pg.wait_for_timeout(400)
    check("superadmin: sinov rejimi tugmasi", any(a.get("p_on") is False for a in calls("liga_super_set_trial")))
    EXTRA.pop("liga_trial", None); EXTRA.pop("liga_player_status2", None)

    print("10e. Admin uchun jamoa natijalari va jonli duel")
    pg, e = page(b); ALLERR += e
    check("oddiy ishtirokchiga jamoa natijalari ko'rinmaydi", pg.locator("#team-live").count() == 0)
    pg, e = page(b, seed={**SEED, "adminPin": "14"}); ALLERR += e
    pg.wait_for_selector("#team-live", timeout=5000)
    check("admin: jamoa ro'yxatlari yig'ilgan", pg.locator("#team-live .board").count() == 0 and "Bugun o'ynaganlar" in pg.inner_text("#team-live"))
    pg.click("#tl-team"); pg.wait_for_timeout(200)
    tl = pg.inner_text("#team-live")
    check("admin: asosiy ekranda jamoa natijalari (faqat bosqich bali)", "Aziz Rahimov" in tl and "480" in tl and "15/20" in tl and "hali o'ynamagan" in tl, tl[:200])
    go(pg, "duel"); pg.click("#create-live"); pg.wait_for_timeout(1300)
    check("jonli duel: kutish zali", "Raqibni kutyapmiz" in txt(pg) and "LQWERTY" in txt(pg))
    LIVE.update({"status": "play", "b_name": "Aziz R.", "q_in": 0}); pg.wait_for_timeout(1500)
    check("jonli duel: savol va hisob tablosi", pg.locator(".qcard .qtext").count() == 1 and pg.locator("#live-score").count() == 1)
    def live_pick(right):
        import re
        k = LIVE["cur"]; x = LIVE["ans"][k]; t = LIVE["items"][k]["t"]
        if t == "pv":
            for c in ((x["dt"], x["kt"]) if right else (x["kt"], x["dt"])): pg.locator(".keys .key", has_text=c).first.click()
        elif t == "mc": pg.locator(".opts .opt", has_text=["Alfa", "Beta", "Gamma", "Delta"][x["a"] if right else (x["a"] + 1) % 4]).first.click()
        else: pg.fill("#num", str(x["a"] if right else x["a"] + 7))
        pg.click("#live-send"); pg.wait_for_timeout(500)
    check("jonli duel: o'yinchi ekranida ism suv belgisi", pg.locator(".qcard .wm").count() == 1 and "Dilnoza" in pg.inner_text(".qcard .wm"))
    live_pick(True)
    check("birinchi to'g'ri javob: ochko va keyingi savolga o'tish", LIVE["cur"] == 1 and pg.locator(".cheer.ok").count() == 1 and "Siz birinchi topdingiz" in txt(pg))
    LIVE["q_in"] = 0; pg.wait_for_timeout(1500)
    live_pick(False)
    check("xato javob: qulflanadi, raqibni kutadi", pg.locator("#live-locked").count() == 1)
    LIVE.update({"cur": 2, "b_pts": 1, "locked": False, "q_in": 2500, "last": {"k": 1, "w": "b", "q": "Savol №2", "t": "mc", "o": ["Alfa", "Beta", "Gamma", "Delta"], "a": 1}}); pg.wait_for_timeout(1500)
    check("raqib birinchi topdi — hamma keyingi savolga", "Aziz R. birinchi topdi" in txt(pg))
    LIVE.update({"cur": 4, "q_in": 0, "last": None, "_stale": True}); pg.wait_for_timeout(3000)
    seen = set()
    for _ in range(10):
        pg.wait_for_timeout(400); seen.add(pg.inner_text(".qtext") if pg.locator(".qtext").count() else "-")
    check("sekin internetda ekran o'chib-yonmaydi (eski javob e'tiborsiz)", len(seen) == 1 and "Savol №5" in list(seen)[0], seen)
    LIVE.pop("_stale", None)
    CALLS.clear()
    pg.evaluate("()=>window.dispatchEvent(new Event('blur'))"); pg.wait_for_timeout(1000); pg.evaluate("()=>window.dispatchEvent(new Event('focus'))"); pg.wait_for_timeout(500)
    check("jonli duel: 1 soniya boshqa oynaga o'tish kechiriladi", not any((a.get("p_ans") or {}).get("left") for a in calls("liga_live_answer")))
    pg.evaluate("()=>window.dispatchEvent(new Event('blur'))"); pg.wait_for_timeout(3400); pg.evaluate("()=>window.dispatchEvent(new Event('focus'))"); pg.wait_for_timeout(800)
    la = [a for a in calls("liga_live_answer") if (a.get("p_ans") or {}).get("left")]
    check("jonli duel: 3 soniyadan ko'p boshqa oynada (AI) — shu savolda qulflanadi", len(la) == 1 and la[0]["p_k"] == 4 and pg.locator("#live-locked").count() == 1, (la, txt(pg)[-200:]))
    check("jonli duel: nusxalash taqiqlangan", pg.evaluate("()=>{const e=new Event('copy',{cancelable:true});document.dispatchEvent(e);return e.defaultPrevented}"))
    LIVE.update({"me": None, "locked": False, "cur": 5, "q_in": 0, "a_name": "Dilnoza K.", "b_name": "Aziz R.", "a_pts": 3, "b_pts": 1, "b_locked": True}); pg.wait_for_timeout(1500)
    check("tomoshabin: javob tugmasi yo'q, «tomoshabinsiz» yozuvi bor", pg.locator("#live-spectator").count() == 1 and pg.locator("#live-send").count() == 0)
    sc = pg.inner_text("#live-score")
    check("tomoshabin: joriy savol ko'rinadi (bosib bo'lmaydi)", pg.locator("#live-watch-q .qtext").count() == 1 and "Savol №6" in pg.inner_text("#live-watch-q") and pg.locator("#live-watch-q button:not([disabled])").count() == 0)
    check("tomoshabin: tabloda ikkala o'yinchi ismi, kim xato qilgani", "Dilnoza K." in sc and "Aziz R." in sc and "Siz" not in sc and "xato" in sc, sc)
    check("tomoshabin ekranida suv belgisi yo'q", pg.locator(".qcard .wm").count() == 0)
    LIVE.update({"q_in": 2500, "cur": 6, "last": {"k": 5, "w": "b", "q": "Savol №6", "t": "mc", "o": ["Alfa", "Beta", "Gamma", "Delta"], "a": 1}}); pg.wait_for_timeout(1500)
    check("tomoshabin: kim birinchi topgani ismi bilan", "Aziz R. birinchi topdi" in txt(pg), txt(pg)[-300:])
    LIVE.pop("b_locked", None)
    LIVE["me"] = "a"
    LIVE.update({"status": "done", "winner": "a", "a_pts": 6, "b_pts": 4}); pg.wait_for_timeout(1500)
    check("jonli duel yakuni: g'olib", pg.locator("#live-done").count() == 1 and "Siz yutdingiz" in txt(pg))

    print("10f. Kunlik juftlik dueli")
    pg, e = page(b, seed={**SEED, "adminPin": "14"}); ALLERR += e
    dd = pg.inner_text("#day-duel") if pg.locator("#day-duel").count() else ""
    pg.wait_for_selector(".dd-rh", timeout=5000)
    check("kubok ro'yxati va jadval yig'ilgan (asosiy ekran qisqa)", pg.locator(".dd-list .r").count() == 0 and pg.locator("#dd-plan li").count() == 0 and pg.locator(".dd-rh").count() >= 1)
    pg.click(".dd-rh >> nth=0"); pg.click("#dd-plan-h"); pg.wait_for_timeout(300)
    dd = pg.inner_text("#day-duel")
    check("asosiy ekranda bugungi duel: raqib va soat", "Aziz R." in dd and "11:30" in dd and "provodka" in dd, dd[:200])
    check("kubok jadvali: chorak final, g'olib, keyingi bosqich soatlari", pg.locator(".dd-list .r").count() == 4 and "Chorak final" in dd and "10:30" in dd and "6:4" in dd and "✅ Aziz R." in dd and "17:00" in dd and pg.locator(".dd-list .r.me").count() == 1, dd[:300])
    pg.click("#tl-pairs"); pg.wait_for_timeout(200)
    check("admin: juftliklar ochilganda jamoa ro'yxati yig'iladi", pg.locator("#team-live .board").count() == 1)
    check("admin: bugungi juftliklar ro'yxati", pg.locator("#pairs .r").count() == 2 and "6:4" in pg.inner_text("#pairs"))
    # raqib ustiga bosilsa — telefon va Telegram nik (faqat duel ishtirokchisiga, token bilan)
    EXTRA["liga_duel_opp_contact"] = {"name": "Aziz Rahimov", "phone": "+998931112233", "tg": "aziz_buh", "tg_id": 555, "region": "Farg'ona viloyati"}
    check("kubok: raqib ismi bosiladigan (telefon belgisi bilan)", pg.locator("#dd-opp").count() == 1 and "Raqib ismiga bosing" in dd)
    pg.click("#dd-opp"); pg.wait_for_timeout(500)
    sh = pg.inner_text("#opp-sheet") if pg.locator("#opp-sheet").count() else ""
    ca = calls("liga_duel_opp_contact")
    check("raqib oynasi: ism, telefon, Telegram nik", "Aziz Rahimov" in sh and "+998 93 111 22 33" in sh and "@aziz_buh" in sh, sh[:200])
    check("raqib aloqasi token va duel kodi bilan so'raladi", bool(ca) and ca[-1].get("p_code") == "LDAY123" and ca[-1].get("p_token") == "tok1", ca[-1:] )
    check("qo'ng'iroq havolasi tel: va yozish tugmasi", pg.get_attribute("#opp-call", "href") == "tel:+998931112233" and pg.locator("#opp-write").count() == 1)
    pg.click(".opp-wrap", position={"x": 10, "y": 10}); pg.wait_for_timeout(300)
    check("raqib oynasi tashqariga bosilsa yopiladi", pg.locator("#opp-sheet").count() == 0)
    EXTRA["liga_duel_opp_contact"] = {"name": "Sardor M", "phone": "+998901110000", "tg_id": 777}
    pg.click("#dd-opp"); pg.wait_for_timeout(500)
    sh = pg.inner_text("#opp-sheet") if pg.locator("#opp-sheet").count() else ""
    check("nik yo'q bo'lsa — «nik qo'yilmagan», baribir yozish mumkin", "nik qo'yilmagan" in sh and pg.locator("#opp-write").count() == 1, sh[:200])
    pg.click(".opp-x"); pg.wait_for_timeout(200)
    EXTRA.pop("liga_duel_opp_contact", None)
    live_reset(kind="day", b_name="Aziz R.", opens_in=3600000, win_from="2026-10-01T06:30:00Z", win_to="2026-10-01T07:30:00Z")
    pg.click("#dd-go"); pg.wait_for_timeout(1500)
    lob = pg.inner_text("#day-lobby") if pg.locator("#day-lobby").count() else ""
    check("juftlik dueli: soatni kutish (11:30, 12:30 gacha)", "11:30 da ochiladi" in lob and "12:30" in lob and "Aziz R." in lob, lob[:300])
    check("juftlik duelida havola/ulashish yo'q", pg.locator("#live-share").count() == 0)
    check("juftlik duel lobbisida ham raqib ismi bosiladi", pg.locator("#lobby-opp").count() == 1)
    check("juftlik duel lobbisida faolsizlik qoidasi yozilgan", "7 daqiqa" in (pg.inner_text("#idle-rule") if pg.locator("#idle-rule").count() else ""))
    LIVE.update({"opens_in": 0, "status": "done", "note": "forfeit", "winner": "a", "a_pts": 1, "b_pts": 0}); pg.wait_for_timeout(1500)
    check("raqib kelmasa — g'alaba sizga", "g'alaba sizga" in (pg.inner_text("#live-note") if pg.locator("#live-note").count() else ""))
    LIVE.update({"note": "idle", "winner": "a", "a_pts": 3, "b_pts": 2})
    pg.evaluate("()=>__liga.nav.tab('home')"); pg.wait_for_timeout(300); pg.click("#dd-go"); pg.wait_for_timeout(1500)
    check("raqib 7 daqiqa javob bermasa — duel to'xtatildi, g'alaba sizga", "7 daqiqa javob bermadi" in (pg.inner_text("#live-note") if pg.locator("#live-note").count() else ""))
    LIVE.pop("kind", None)

    pg, e = page(b); ALLERR += e
    if pg.locator("#dd-plan li").count() == 0: pg.click("#dd-plan-h"); pg.wait_for_timeout(200)
    check("kubok: kun jadvali (raundlar, vaqt, final 17:00), joriy raund belgilangan", pg.locator("#dd-plan li").count() == 3 and "Yarim final" in pg.inner_text("#dd-plan") and "17:00" in pg.inner_text("#dd-plan") and pg.locator("#dd-plan li.now").count() == 1)

    # 60 kishi: saralash raundi (28 duel bir vaqtda) — ro'yxat yig'iladi, faqat o'z dueli ko'rinadi
    big = [{"round": 1, "stage": "qual", "slot": "10:00", "a_name": f"O'yinchi {2*i+1}", "b_name": f"O'yinchi {2*i+2}", "a_pts": 0, "b_pts": 0, "status": "play", "note": None,
            "mine": i == 17, "winner_name": None, "champion": None} for i in range(28)]
    tbl = [{"round": 1, "stage": "qual", "duels": 28, "at": "10:00"}, {"round": 2, "stage": "r32", "duels": 16, "at": "10:40"}, {"round": 3, "stage": "r16", "duels": 8, "at": "11:20"},
           {"round": 4, "stage": "quarter", "duels": 4, "at": "14:00"}, {"round": 5, "stage": "semi", "duels": 2, "at": "14:40"}, {"round": 6, "stage": "final", "duels": 1, "at": "17:00"}]
    EXTRA["liga_cup_list"] = big; EXTRA["liga_cup_me2"] = {"players": 60, "bye": False, "table": tbl}
    EXTRA["liga_day_duel_me"] = {"code": "LDAY123", "slot": "10:00", "stage": "qual", "opp": "O'yinchi 36", "status": "play", "open": True, "closed": False, "my_pts": 0, "opp_pts": 0}
    pg, e = page(b); ALLERR += e
    dd = pg.inner_text("#day-duel")
    check("60 kishi: raund yig'ilgan — sarlavhada 28 duel va «siz shu yerda»", pg.locator(".dd-list .r").count() == 0 and "1-raund" in dd and "28 duel" in dd and "siz shu yerda" in dd, dd[:300])
    pg.click("#dd-plan-h"); pg.wait_for_timeout(200)
    check("60 kishi: jadval saralash 10:00 → 1/16 10:40 → 1/8 11:20 → (12–14 tanaffus) chorak 14:00 → yarim 14:40 → final 17:00",
          pg.locator("#dd-plan li").count() == 6 and all(x in pg.inner_text("#dd-plan") for x in ["60 ishtirokchi", "1/16 final", "1/8 final", "10:00", "10:40", "11:20", "14:00", "14:40", "17:00", "12:00–14:00"]))
    pg.click(".dd-rh >> nth=0"); pg.wait_for_timeout(300)
    check("raund sarlavhasi bosilsa — 28 duel ochiladi", pg.locator(".dd-list .r").count() == 28 and pg.locator(".dd-list .r.me").count() == 1)
    pg.click(".dd-rh >> nth=0"); pg.wait_for_timeout(300)
    check("qayta bosilsa — yig'iladi", pg.locator(".dd-list .r").count() == 0)
    EXTRA["liga_day_duel_me"] = None; EXTRA["liga_cup_me2"] = {"players": 60, "bye": True, "table": tbl}
    pg, e = page(b); ALLERR += e
    by = pg.inner_text("#dd-bye") if pg.locator("#dd-bye").count() else ""
    check("saralashsiz o'tgan: sababi (7 kunlik bal) va keyingi duel 10:40 (1/16 final)", "saralashsiz" in by and "7 kundagi" in by and "10:40" in by and "1/16 final" in by, by)
    pg, e = page(b, seed={**SEED, "lang": "ru"}); ALLERR += e
    by = pg.inner_text("#dd-bye") if pg.locator("#dd-bye").count() else ""
    check("RU: saralashsiz o'tish va jadval ruscha", "без отбора" in by and "1/16 финала" in by and "1-й раунд" in pg.inner_text("#dd-plan"), by)
    EXTRA["liga_cup_me2"] = {"players": 60, "bye": False, "bench": True, "table": tbl}
    pg, e = page(b); ALLERR += e
    check("toq sonda oxirgi qo'shilgan: «ertadan kubokda qatnashasiz»", "Ertadan kubokda" in (pg.inner_text("#dd-bench") if pg.locator("#dd-bench").count() else ""))
    EXTRA["liga_cup_me2"] = {"players": 60, "bye": False, "table": tbl}
    pg, e = page(b); ALLERR += e
    check("ro'yxatda yo'q: keyingi kubok vaqti aytiladi", "ro'yxatga kirmadingiz" in (pg.inner_text("#dd-wait") if pg.locator("#dd-wait").count() else ""))
    EXTRA.pop("liga_cup_me2", None)

    EXTRA["liga_day_duel_me"] = None; EXTRA["liga_cup_list"] = []
    pg, e = page(b, when="2026-10-01T03:00:00Z"); ALLERR += e
    check("juft hali tuzilmagan: juftlar 09:00 da, duellar 10:00 dan", pg.locator("#dd-wait").count() == 1 and "09:00" in pg.inner_text("#dd-wait") and "10:00" in pg.inner_text("#dd-wait"))
    EXTRA["liga_cup_list"] = [{"round": 3, "stage": "final", "slot": "16:00", "a_name": "Aziz R.", "b_name": "Sardor M.", "a_pts": 6, "b_pts": 2, "status": "done", "note": None, "mine": False, "winner_name": "Aziz R.", "champion": "Aziz Rahimov"}]
    pg, e = page(b); ALLERR += e
    check("kubok g'olibi asosiy ekranda", pg.locator("#dd-champ").count() == 1 and "Aziz Rahimov" in pg.inner_text("#dd-champ"))
    EXTRA.pop("liga_day_duel_me", None); EXTRA.pop("liga_cup_list", None)

    print("10g2a. Kubok: hamma o'ynaydi, g'oliblar ochko bo'yicha 2 ning darajasigacha")
    tcut = [{"round": 1, "stage": "qual", "duels": 145, "at": "10:00"}, {"round": 2, "stage": "r128", "duels": 64, "at": "10:40"}, {"round": 3, "stage": "r64", "duels": 32, "at": "11:20"}]
    EXTRA["liga_cup_me2"] = {"players": 290, "bye": False, "table": tcut}
    EXTRA["liga_day_duel_me"] = {"code": "LDAY9", "slot": "10:00", "stage": "qual", "opp": "Ali V.", "status": "done", "open": False, "closed": True, "my_pts": 6, "opp_pts": 3, "won": True, "cut": True, "cut_keep": 128, "cut_winners": 145}
    pg, e = page(b); ALLERR += e
    dd = pg.inner_text("#day-duel") if pg.locator("#day-duel").count() else ""
    check("yutgan, lekin ochko bo'yicha kirmagan: tushunarli xabar (145 dan 128)", "ochko bo'yicha" in dd and "145" in dd and "128" in dd and "Siz keyingi bosqichga chiqdingiz" not in dd, dd[:300])
    if pg.locator("#dd-plan-h").count(): pg.click("#dd-plan-h"); pg.wait_for_timeout(200)
    check("jadvalda qoida: hamma o'ynaydi, ochkosi eng ko'p 128 kishi o'tadi", "128" in (pg.inner_text("#dd-cut-rule") if pg.locator("#dd-cut-rule").count() else ""))
    EXTRA.pop("liga_cup_me2", None); EXTRA.pop("liga_day_duel_me", None)

    print("10g2. Buxgalter ma'lumotnomasi (yig'iladigan)")
    pg, e = page(b); ALLERR += e
    check("ma'lumotnoma: 9 mavzu, hammasi yig'ilgan", pg.locator("#info .info-it").count() == 9 and pg.locator("#info .info-b").count() == 0)
    pg.click("#info-ok .info-h"); pg.wait_for_timeout(200)
    ib = pg.inner_text("#info-ok")
    check("oilaviy korxona ochiladi: qarindoshlar, imtiyozlar (aholi tarifi, uyda faoliyat)", "qarindosh" in ib and "aholi tarifida" in ib and "Turar joyda" in ib and pg.locator("#info .info-b").count() == 1, ib[:300])
    pg.click("#info-mchj .info-h"); pg.wait_for_timeout(200)
    check("boshqasi bosilsa — oldingisi yig'iladi (bir vaqtda bittasi)", pg.locator("#info .info-b").count() == 1 and "50 gacha" in pg.inner_text("#info-mchj"))
    pg.click("#info-soliq .info-h"); pg.wait_for_timeout(200)
    check("2026 stavkalari: 12 000 BHM chegarasi, QQS 12%, 6% soddalashtirilgan", all(x in pg.inner_text("#info-soliq") for x in ["12 000 BHM", "5,28 mlrd", "12%", "6%"]))
    for sid, words in [("ijtimoiy", ["1%", "30 yoshgacha", "PQ-78"]), ("itpark", ["7,5%", "2040", "QQSdan tashqari"]), ("jshds", ["3 mln", "26 yoshgacha", "deklaratsiya"]), ("mulk", ["kamida 3", "2 MHTEKM"])]:
        pg.click(f"#info-{sid} .info-h"); pg.wait_for_timeout(150)
        check(f"ma'lumotnoma: «{sid}» bo'limi", all(w in pg.inner_text(f"#info-{sid}") for w in words), pg.inner_text(f"#info-{sid}")[:200])
    pg, e = page(b, seed={**SEED, "lang": "ru"}); ALLERR += e
    pg.click("#info-xk .info-h"); pg.wait_for_timeout(200)
    check("RU: ma'lumotnoma ruscha", "Справочник бухгалтера" in pg.inner_text("#info") and "Частное предприятие" in pg.inner_text("#info-xk"))
    pg, e = page(b, seed={**SEED, "lang": "uzc"}); ALLERR += e
    check("kirill: ma'lumotnoma kirillda", "Оилавий корхона" in pg.inner_text("#info"))

    print("10g3. Sana va Markaziy bank kurslari")
    EXTRA["liga_rates"] = [{"ccy": "USD", "rate": 12011.65, "diff": 48.49, "date": "2026-10-01"}, {"ccy": "EUR", "rate": 13462.66, "diff": -12.3, "date": "2026-10-01"},
                           {"ccy": "RUB", "rate": 143.17, "diff": 0.84, "date": "2026-10-01"}, {"ccy": "CNY", "rate": 1795.17, "diff": 7.7, "date": "2026-10-01"}, {"ccy": "KZT", "rate": 26.51, "diff": 0.04, "date": "2026-10-01"}]
    pg, e = page(b); ALLERR += e
    rt = pg.inner_text("#rates") if pg.locator("#rates").count() else ""
    check("asosiy ekranda sana (1-oktabr, payshanba)", "1-oktabr, payshanba" in rt, rt)
    check("kurslar: $ 12 011,65 ▲48,49, € pastga, MB kursi sanasi", "12 011,65" in rt and "▲ 48,49" in rt and "▼ 12,30" in rt and "MB kursi · 01.10.2026" in rt and pg.locator("#rates .rt").count() == 4, rt)
    pg, e = page(b, seed={**SEED, "lang": "ru"}); ALLERR += e
    check("RU: sana ruscha", "1 октября, четверг" in pg.inner_text("#rates"))
    pg, e = page(b, w=320); ALLERR += e
    check("320px: kurslar sig'adi", pg.evaluate("()=>document.documentElement.scrollWidth<=320"))
    EXTRA["liga_rates"] = [{"ccy": "USD", "rate": 12011.65, "diff": 48.49, "date": "2026-10-01", "upd": "2026-09-30T12:00"}]
    pg, e = page(b); ALLERR += e
    ru = pg.inner_text("#rates-upd") if pg.locator("#rates-upd").count() else ""
    check("kurs: yangilangan vaqti va «har kuni 12:00 da»", "Yangilandi: kecha 12:00" in ru and "har kuni 12:00 da" in ru, ru)
    EXTRA["liga_rates"] = [{"ccy": "USD", "rate": 12011.65, "diff": 48.49, "date": "2026-10-01", "upd": "2026-10-01T12:00"}]
    pg, e = page(b, seed={**SEED, "lang": "ru"}); ALLERR += e
    check("RU: kurs «Обновлено: сегодня 12:00»", "Обновлено: сегодня 12:00" in (pg.inner_text("#rates-upd") if pg.locator("#rates-upd").count() else ""))
    EXTRA.pop("liga_rates", None)

    print("10g4. Ma'lumotnoma bazadan, «Yangilandi» sanasi")
    pg, e = page(b); ALLERR += e
    check("bazadan kelmasa — ilovadagi zaxira (9 mavzu) va uning sanasi", pg.locator("#info .info-it").count() == 9 and "Yangilandi: 19.10.2026" in pg.inner_text("#info-updated"), pg.inner_text("#info")[:200])
    check("ma'lumotnoma bazadan so'raladi (liga_info)", bool(calls("liga_info")))
    pg.click("#info-mulk .info-h"); pg.wait_for_timeout(150)
    check("yangi imtiyoz: logistika markazlari 2040 gacha (PQ-368)", all(w in pg.inner_text("#info-mulk") for w in ["PQ-368", "2040", "logistika"]))
    pg.click("#info-ijtimoiy .info-h"); pg.wait_for_timeout(150)
    check("ijtimoiy soliq: 2030 dan bekor qilish taklifi eslatmasi", "2030" in pg.inner_text("#info-ijtimoiy") and "taklif" in pg.inner_text("#info-ijtimoiy"))
    it = lambda i, n: {"id": i, "short": {"uz": n, "ru": n}, "title": {"uz": n + " sarlavha", "ru": n + " заголовок"}, "sub": {"uz": "izoh", "ru": "пояснение"}, "rows": [[{"uz": "Stavka", "ru": "Ставка"}, {"uz": "7%", "ru": "7%"}]]}
    EXTRA["liga_info"] = {"updated": "26.10.2026", "checked": "02.11.2026", "items": [it("a1", "Yangi1"), it("a2", "Yangi2"), it("a3", "Yangi3")]}
    pg, e = page(b); ALLERR += e
    check("bazadagi ma'lumot ko'rsatiladi (3 mavzu) va sanasi", pg.locator("#info .info-it").count() == 3 and "Yangi2 sarlavha" in pg.inner_text("#info") and "Yangilandi: 26.10.2026" in pg.inner_text("#info-updated"))
    check("tekshirildi, o'zgarish yo'q — oxirgi tekshiruv sanasi", "Oxirgi tekshiruv: 02.11.2026" in pg.inner_text("#info-checked"))
    check("bazadagi ma'lumot telefonda saqlanadi (internet bo'lmasa)", S(pg, "S.info && S.info.updated") == "26.10.2026")
    pg, e = page(b, seed={**SEED, "lang": "ru"}); ALLERR += e
    check("RU: «Обновлено: 26.10.2026»", "Обновлено: 26.10.2026" in pg.inner_text("#info-updated"))
    EXTRA["liga_info"] = {"updated": "26.10.2026", "items": [{"id": "x"}]}
    pg, e = page(b); ALLERR += e
    check("buzuq ma'lumot kelsa — zaxira ishlatiladi", pg.locator("#info .info-it").count() == 9)
    EXTRA.pop("liga_info", None)

    print("10g5. Hali o'ynamagan yangi a'zo — «Birinchi bosqichingiz»")
    NEW = {**SEED, "week": {"id": "2026-10-02T07:00", "my": 0, "part": {"stage": 0, "daily": 0, "blitz": 0, "bonus": 0}, "stages": {}}, "stars": {}}
    EXTRA["liga_my_kind"] = "never"
    pg, e = page(b, seed=NEW); ALLERR += e
    fs = pg.inner_text("#first-step") if pg.locator("#first-step").count() else ""
    check("yangi a'zoga kartada 3 qadam va «Birinchi bosqichni boshlash»", "Birinchi bosqichingiz" in fs and "15 daqiqa" in fs and pg.locator("#first-go").count() == 1, fs)
    pg.click("#first-go"); pg.wait_for_timeout(400)
    check("tugma bugungi bosqichga olib boradi", pg.evaluate("()=>__liga.nav.current().name") == "intro")
    pg, e = page(b, seed=NEW, when="2026-10-01T13:00:00Z"); ALLERR += e
    check("bosqich yopiq bo'lsa — mashq tugmasi", pg.locator("#first-practice").count() == 1 and pg.locator("#first-go").count() == 0)
    EXTRA["liga_my_kind"] = "ok"
    pg, e = page(b, seed=NEW); ALLERR += e
    check("o'ynagan a'zoga karta chiqmaydi", pg.locator("#first-step").count() == 0)
    EXTRA.pop("liga_my_kind", None)

    print("10h. Ishtirokchilar muhokama guruhi")
    pg, e = page(b); ALLERR += e
    check("guruh hali belgilanmagan — karta yo'q", pg.locator("#discuss").count() == 0)
    EXTRA["liga_discuss_link"] = "https://t.me/+AbCdEf123"
    pg, e = page(b); ALLERR += e
    dc = pg.inner_text("#discuss") if pg.locator("#discuss").count() else ""
    ca = calls("liga_discuss_link")
    check("bosh sahifada «Ishtirokchilar guruhi» kartasi", "Ishtirokchilar guruhi" in dc and "Qo'shilish" in dc, dc)
    check("guruh havolasi token bilan so'raladi", bool(ca) and ca[-1].get("p_token") == "tok1")
    EXTRA.pop("liga_discuss_link", None)

    print("10g. Oktyabr kunlik rejasi, Katta final, medallar")
    EXTRA["liga_day_plans"] = [{"day": "2026-10-01", "level": 5, "icon": "🧾", "title": {"uz": "Kassa va bank", "ru": "Касса и банк"},
        "story": {"uz": "Kassir pul olib keldi.", "ru": "Кассир принёс деньги."}, "theory": {"uz": "<p>Kassa — <b>5010</b></p>", "ru": "<p>Касса — <b>5010</b></p>"}, "n_pv": 15, "n_other": 5}]
    pg, e = page(b); ALLERR += e
    go(pg, "intro", {"si": 3}); pg.wait_for_timeout(400)
    check("kun rejasi: mavzu, nazariya va qiyinlik darajasi", "Kassa va bank" in txt(pg) and "5010" in txt(pg) and pg.locator("#plan-chip").count() == 1 and "Qiyinlik darajasi: 5" in txt(pg), txt(pg)[:300])
    check("kun rejasi: «15 provodka + 5 qonun savoli»", "15 provodka + 5 qonun savoli" in txt(pg))
    pg.evaluate("()=>__liga.nav.tab('home')"); pg.wait_for_timeout(400)
    check("bosh sahifa: bugungi bosqich nomi rejadan", "Kassa va bank" in txt(pg))
    EXTRA.pop("liga_day_plans", None)
    EXTRA["liga_grand_info"] = {"month": "2026-12", "date": "2026-12-05", "active": True, "qualified": False, "qualifiers": [],
        "months": [{"m": "2026-10", "closed": False, "live": True, "top": [{"pos": 1, "n": "Aziz R.", "xp": 2500, "me": False}, {"pos": 2, "n": "Malika S.", "xp": 2300, "me": False}, {"pos": 3, "n": "Bekzod T.", "xp": 2100, "me": False}], "my_pos": 5, "my_xp": 1900, "third_xp": 2100},
                   {"m": "2026-11", "closed": False, "live": False, "top": [], "my_pos": None, "my_xp": 0, "third_xp": 0}]}
    pg, e = page(b); ALLERR += e; pg.wait_for_timeout(600)
    check("kirishda Katta final eslatmasi chiqadi", pg.locator("#grand-pop").count() == 1 and "Katta final" in pg.inner_text("#grand-pop") and "5-o'rindasiz" in pg.inner_text("#grand-pop") and "201 ball" in pg.inner_text("#grand-pop"), pg.inner_text("body")[:300])
    pg.click("#grand-ok"); pg.wait_for_timeout(300)
    check("eslatma yopiladi", pg.locator("#grand-pop").count() == 0)
    pg.evaluate("()=>__liga.nav.tab('learn')"); pg.wait_for_timeout(200); pg.evaluate("()=>__liga.nav.tab('home')"); pg.wait_for_timeout(400)
    check("eslatma kuniga bir marta (qayta ochilganda chiqmaydi)", pg.locator("#grand-pop").count() == 0 and S(pg, "S.grandSeen") == "2026-10-01")
    check("bosh sahifa: Katta final kartasi (oktyabr top-3)", pg.locator("#grand").count() == 1 and "Aziz R." in pg.inner_text("#grand") and pg.locator("#grand svg.medal").count() >= 3)
    pg.evaluate("()=>__liga.nav.tab('rate')"); pg.wait_for_timeout(300); pg.click("text=Final"); pg.wait_for_timeout(300)
    check("reyting → Final: Katta final poygasi", pg.locator("#grand").count() == 1)
    pg.click("text=Zal"); pg.wait_for_timeout(300)
    check("chempionlar zali: o'rin medallari", pg.locator(".flat svg.medal").count() >= 2)
    pg.evaluate("()=>__liga.nav.tab('profile')"); pg.wait_for_timeout(400)
    check("profil: «Medallarim» javoni", pg.locator("#medal-shelf svg.medal-gold").count() == 1, txt(pg)[:300])
    EXTRA.pop("liga_grand_info", None)

    print("10i. Mashq zali (ligadan alohida)")
    pg, e = page(b); ALLERR += e
    pc = pg.inner_text("#px-card") if pg.locator("#px-card").count() else ""
    check("bosh sahifada «Mashq zali» kartasi: jamg'arma va o'rin", "Mashq zali" in pc and "85 000" in pc and "2-o'rinda" in pc, pc)
    xp0 = S(pg, "S.xp"); wk0 = S(pg, "JSON.stringify(S.week)")
    pg.click("#px-card"); pg.wait_for_timeout(1400)
    check("mashq zali ochildi: jamg'arma va sovrinlar", "85 000" in pg.inner_text("#px-fund") and "42 500" in pg.inner_text("#px-fund") and "25 500" in pg.inner_text("#px-fund"), txt(pg)[:300])
    check("statistika: oy bali, o'rin, bugun, seriya", all(x in pg.inner_text("#px-stats") for x in ["780", "2/14", "160", "3"]))
    check("ogohlantirish: liga baliga qo'shilmaydi", "liga baliga, kunlik bosqich va duellarga qo'shilmaydi" in txt(pg))
    check("obunasi faol — «Obuna bo'lish» tugmasi yo'q", pg.locator("#px-pay").count() == 0)
    check("3 ta o'yin va rekordlar", all(pg.locator("#px-" + k).count() == 1 for k in ["pv", "acc", "side"]) and "rekord 210" in pg.inner_text("#px-pv"))
    pg.click("text=Vazifalar"); pg.wait_for_timeout(300)
    check("vazifalar: 4 ta, bajarilganlari belgilangan", pg.locator("#px-quests li").count() == 4 and pg.locator("#px-quests li.done").count() == 2 and "3 ta o'yin o'ynang" in pg.inner_text("#px-quests"))
    pg.click("text=Yutuqlar"); pg.wait_for_timeout(300)
    check("yutuqlar: 12 ta, 4 tasi olingan", pg.locator("#px-ach .ach-it").count() == 12 and pg.locator("#px-ach .ach-it.on").count() == 4 and "Snayper" in pg.inner_text("#px-ach"))
    pg.click(".seg >> text=Reyting"); pg.wait_for_timeout(400)
    bd = pg.inner_text("#px-board") if pg.locator("#px-board").count() else ""
    check("reyting: medallar, o'zi belgilangan, obunasizlar, sovrin summasi", "🥇" in bd and "siz" in bd and "obunasiz" in bd and "42 500" in bd and pg.locator("#px-board li.me").count() == 1, bd)
    check("reytingda obunasiz 3-o'ringa sovrin yozilmaydi", "17 000" not in bd)
    check("o'tgan oy g'oliblari", "Sentyabr 2026" in pg.inner_text("#px-wins"))
    pg.click("text=Hafta"); pg.wait_for_timeout(300)
    check("hafta reytingi so'raldi", calls("liga_px_board")[-1].get("p_scope") == "week")
    # Debet ↔ Kredit
    CALLS.clear(); go(pg, "pxGame", {"kind": "pv"}); pg.wait_for_timeout(500)
    check("o'yin boshlandi: savol, taymer 60", "Mashq №1" in pg.inner_text("#px-q") and pg.inner_text("#px-timer").strip() in ("60", "59"), pg.inner_text("body")[:200])
    check("tugmalarda hisobvaraq nomi ham bor", "Kassa" in pg.inner_text(".px-keys"))
    pg.locator(".px-keys .key", has_text="5010").first.click(); pg.locator(".px-keys .key", has_text="5110").first.click(); pg.wait_for_timeout(300)
    a = calls("liga_px_answer")
    check("ikkala hisobvaraq tanlanganda javob avtomatik ketadi", bool(a) and a[-1]["p_ans"] == {"dt": "5010", "kt": "5110"} and a[-1]["p_k"] == 0, a)
    pg.wait_for_timeout(700)
    check("to'g'ri: ball 10, keyingi savol", pg.inner_text("#px-score").strip() == "10" and "Mashq №2" in pg.inner_text("#px-q"))
    pg.locator(".px-keys .key", has_text="5110").first.click(); pg.locator(".px-keys .key", has_text="5010").first.click(); pg.wait_for_timeout(400)
    check("xato: to'g'ri provodka va izoh ko'rinadi", pg.locator("#px-fb").count() == 1 and "Dt 5010 — Kt 5110" in pg.inner_text("#px-fb") and "Kassa ko'paydi" in pg.inner_text("#px-fb"))
    pg.wait_for_timeout(1500)
    check("xatodan keyin seriya 0, ball o'zgarmadi", pg.inner_text("#px-score").strip() == "10")
    pg.clock.fast_forward(61000); pg.wait_for_timeout(800)
    check("vaqt tugadi — natija: ball, yangi rekord, vazifa", pg.locator("#px-result").count() == 1 and "Yangi rekord" in txt(pg) and "3 ta o'yin o'ynang" in txt(pg) and "2-o'rindasiz" in txt(pg), txt(pg)[:300])
    check("liga_px_finish chaqirildi", len(calls("liga_px_finish")) == 1)
    check("liga bali va hafta bosqichlari o'zgarmadi", S(pg, "S.xp") == xp0 and S(pg, "JSON.stringify(S.week)") == wk0)
    W = ("liga_run_answer", "liga_run_finish", "liga_stage_start", "liga_live_create", "liga_live_answer", "liga_duel_start", "liga_duel_submit", "liga_final_start")
    check("bosqich/duel yozuvchi funksiyalari chaqirilmadi", not [f for f, _ in CALLS if f in W], [f for f, _ in CALLS if f in W])
    check("liga_save liga balini o'zgartirmadi", all(a.get("p_xp") == xp0 for a in calls("liga_save")), calls("liga_save")[-1:])
    # Schyotlar rejasi va Balans bo'limi (yangi sahifa: soat sakrashidan keyin animatsiya kutilmasin)
    pg, e = page(b); ALLERR += e
    go(pg, "pxGame", {"kind": "acc"}); pg.wait_for_timeout(500)
    check("schyotlar: raqam so'raladi, variantlar — nomlar", "5010" in pg.inner_text("#px-q") and "Kassa (so'm)" in pg.inner_text(".opts"))
    pg.locator(".opts .opt").first.click(); pg.wait_for_timeout(300)
    check("variant bosilishi bilan javob ketadi", calls("liga_px_answer")[-1]["p_ans"] == {"pick": 0})
    go(pg, "pxGame", {"kind": "side"}); pg.wait_for_timeout(500)
    try: pg.wait_for_selector(".px-sides .opt", timeout=5000)
    except Exception: pass
    check("balans bo'limi: 5 ta bo'lim", pg.locator(".px-sides .opt").count() == 5 and all(x in pg.inner_text(".px-sides") for x in ["Aktiv", "Majburiyat", "Kapital", "Daromad", "Xarajat"]))
    pg.locator(".px-sides .opt", has_text="Kapital").click(); pg.wait_for_timeout(400)
    check("xato bo'lim: to'g'ri javob ko'rsatiladi", "To'g'ri javob: 5010" in pg.inner_text("#px-fb") and "Aktiv" in pg.inner_text("#px-fb"))
    # halol o'yin: boshqa oynaga 3 soniyadan ko'p — o'yin yakunlanadi
    go(pg, "pxGame", {"kind": "pv"}); pg.wait_for_timeout(500)
    try: pg.wait_for_selector("#px-q", timeout=5000)
    except Exception: pass
    pg.wait_for_timeout(300); n0 = len(calls("liga_px_finish"))
    pg.evaluate("()=>window.dispatchEvent(new Event('blur'))"); pg.clock.fast_forward(4000); pg.evaluate("()=>window.dispatchEvent(new Event('focus'))"); pg.wait_for_timeout(700)
    check("boshqa oynaga chiqilsa o'yin yakunlanadi", len(calls("liga_px_finish")) == n0 + 1 and pg.locator("#px-result").count() == 1)
    # obunasi yo'q
    EXTRA["liga_px_me"] = {**PX_ME, "eligible": False}
    pg, e = page(b); ALLERR += e; go(pg, "px"); pg.wait_for_timeout(400)
    check("obunasizga: «Sovrin faqat obunasi faol…» va «Obuna bo'lish»", pg.locator("#px-pay").count() == 1 and "obunasi faol" in pg.inner_text("#px-fund"))
    pg.click("#px-pay"); pg.wait_for_timeout(300)
    check("«Obuna bo'lish» — to'lov sahifasi", pg.evaluate("()=>__liga.nav.current().name") == "pay")
    EXTRA["liga_px_me"] = {**PX_ME, "on": False}
    pg, e = page(b); ALLERR += e
    check("mashq zali o'chirilgan bo'lsa — karta yo'q", pg.locator("#px-card").count() == 0)
    EXTRA.pop("liga_px_me", None)
    pg, e = page(b, seed={**SEED, "lang": "ru"}); ALLERR += e
    check("RU: «Тренировочный зал»", "Тренировочный зал" in pg.inner_text("#px-card") and "Призовой фонд" in pg.inner_text("#px-card"))
    pg, e = page(b, w=320, h=640); ALLERR += e; go(pg, "px"); pg.wait_for_timeout(400)
    check("320px: mashq zali sig'adi", pg.evaluate("()=>document.documentElement.scrollWidth<=320"))
    go(pg, "pxGame", {"kind": "pv"}); pg.wait_for_timeout(500)
    check("320px: o'yin sig'adi", pg.evaluate("()=>document.documentElement.scrollWidth<=320"))
    # superadmin
    pg, e = page(b, seed={**SEED, "superPin": "9999"}); ALLERR += e; go(pg, "super"); pg.wait_for_timeout(300)
    pg.click(".seg >> text=Mashq"); pg.wait_for_timeout(400)
    sp = pg.inner_text("#px-super")
    check("superadmin: jamg'arma, g'olib telefoni, berilmagan", "85 000" in sp and "+998931112233" in sp and "berilmagan" in sp, sp[:300])
    pg.fill("#px_fund_per_pay", "7000"); pg.locator(".field", has=pg.locator("#px_fund_per_pay")).locator("button").click(); pg.wait_for_timeout(300)
    st = calls("liga_px_admin_set")
    check("superadmin: jamg'arma ulushi saqlanadi", bool(st) and st[-1] == {"p_pin": "9999", "p_key": "px_fund_per_pay", "p_val": "7000"}, st)

    print("11. Ko'rinish")
    pg, e = page(b, seed={**SEED, "theme": "dark"}); ALLERR += e
    check("tungi mavzu", pg.evaluate("()=>document.documentElement.dataset.theme") == "dark")
    pg, e = page(b, w=320, h=640); ALLERR += e
    over = pg.evaluate("()=>document.documentElement.scrollWidth - innerWidth")
    check("320px ekranda gorizontal siljish yo'q", over <= 0, over)

    check("sahifada JS xatolar yo'q", not ALLERR, ALLERR[:3])
    b.close()
print(f"\nNatija: {len(OK)} ✓, {len(BAD)} ✗")
if BAD: print("Xato:", BAD); sys.exit(1)
