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
    pg.evaluate(HIDE); pg.clock.fast_forward(1500); pg.evaluate(SHOW); pg.wait_for_timeout(300)
    check("1.5 soniya chiqib qaytish kechiriladi (qo'ng'iroq)", "Ilovadan chiqildi" not in txt(pg) and pg.locator("#chk").count() == 1)
    pg.evaluate(HIDE); pg.clock.fast_forward(5000); pg.evaluate(SHOW); pg.wait_for_timeout(400)
    check("ilovadan uzoq chiqish = xato (halol o'yin)", "Ilovadan chiqildi" in txt(pg), txt(pg)[-300:])
    check("nusxa olish bloklangan", pg.evaluate("()=>{const e=new Event('copy',{cancelable:true});document.dispatchEvent(e);return e.defaultPrevented}"))
    check("ekranda ism suv belgisi", pg.locator(".wm").count() == 1 and "Dilnoza" in pg.inner_text(".wm"))
    pg.click("#nx"); pg.wait_for_timeout(300)
    pg.evaluate("()=>__liga.nav.tryBack()"); pg.wait_for_timeout(300)
    check("orqaga bosilganda tasdiq so'raladi", "Chiqasizmi?" in txt(pg))

    print("4. Vaqt qoidalari")
    pg, e = page(b); ALLERR += e
    check("ertangi bosqich yopiq", pg.evaluate("()=>__liga.time.stageState(4)") == "future")
    check("kechagi bosqich yopiq", pg.evaluate("()=>__liga.time.stageState(2)") in ("closed", "done"))
    go(pg, "intro", {"si": 4}); pg.click("#go"); pg.wait_for_timeout(300)
    check("kelajak bosqich bosilganda xabar", "09:00" in txt(pg))
    pg, e = page(b, when="2026-10-03T06:00:00Z"); ALLERR += e
    check("juma 12:00 dan keyin: hafta yakuni ekrani", "Haftalik liga yakunlandi" in txt(pg))
    pg.evaluate("()=>__liga.nav.tab('home')"); pg.wait_for_timeout(400)
    check("shanba: dam olish kuni", pg.evaluate("()=>__liga.time.isWeekend()") and "Dam olish" in txt(pg))
    pg, e = page(b, when="2026-10-01T12:30:00Z"); ALLERR += e
    check("17:00 dan keyin bosqich yopiq", pg.evaluate("()=>__liga.time.stageOpen(3)") is False)

    pg, e = page(b, when="2026-10-02T06:30:00Z"); ALLERR += e
    check("juma 11:30 — bosqich ochiq", pg.evaluate("()=>__liga.time.stageOpen(__liga.time.todayStage())") is True)
    check("juma: «12:00 gacha» yozuvi", "12:00 gacha" in txt(pg), txt(pg)[:300])
    pg, e = page(b, when="2026-10-02T06:59:00Z", seed={**SEED, "week": {**SEED["week"], "id": "2026-10-02T07:00"}}); ALLERR += e
    pg.clock.fast_forward(120000); pg.wait_for_timeout(300)
    pg.evaluate("()=>document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(500)
    check("juma 12:00 — bosqich yopildi", pg.evaluate("()=>__liga.time.stageOpen(__liga.time.todayStage())") is False)
    check("ilova ochiq turganda hafta yangilandi", S(pg, "S.week.id") == "2026-10-09T07:00" and S(pg, "S.week.my") == 0, S(pg, "S.week"))

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
    pg, e = page(b, seed=None, query="?t=TST7ABC"); ALLERR += e
    check("xodim testi sahifasi", "Bosh buxgalter lavozimiga test" in txt(pg))
    pg.click("#go"); pg.wait_for_timeout(300)
    check("ismsiz boshlanmaydi", pg.locator(".qtext").count() == 0)
    pg.fill("#cn", "Nomzod Ikki"); pg.fill("#cp", "+998901234599"); CALLS.clear(); pg.click("#go"); pg.wait_for_timeout(700)
    check("test boshlandi (savollar serverdan)", pg.locator(".qtext").count() == 1 and len(calls("liga_test_begin")) == 1)
    answer(pg, True)
    a = calls("liga_run_answer")
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
    check("bosh sahifa: «Imtiyozlaringiz» kartasi", pg.locator("#perks").count() == 1 and "+7 soniya" in pg.inner_text("#perks") and "1-o'rin" in pg.inner_text("#perks"), pg.inner_text("body")[:300])
    go(pg, "intro", {"si": 3}); pg.wait_for_timeout(300)
    rw = pg.inner_text("#rw-start") if pg.locator("#rw-start").count() else ""
    check("bosqich boshida: kuchli uchlik mukofoti +10/+7/+4", all(x in rw for x in ["+10", "+7", "+4"]), rw[:200])
    check("bosqich boshida: mening bonusim va 67 soniya", "+7 soniya bor" in rw and "67 soniya" in txt(pg))
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
    check("bosqich yakunida: kuchli uchlik mukofoti", pg.locator("#rw-end").count() == 1 and "+10" in pg.inner_text("#rw-end"))
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
    tl = pg.inner_text("#team-live") if pg.locator("#team-live").count() else ""
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
    LIVE.update({"status": "done", "winner": "a", "a_pts": 6, "b_pts": 4}); pg.wait_for_timeout(1500)
    check("jonli duel yakuni: g'olib", pg.locator("#live-done").count() == 1 and "Siz yutdingiz" in txt(pg))

    print("10f. Kunlik juftlik dueli")
    pg, e = page(b, seed={**SEED, "adminPin": "14"}); ALLERR += e
    dd = pg.inner_text("#day-duel") if pg.locator("#day-duel").count() else ""
    check("asosiy ekranda bugungi duel: raqib va soat", "Aziz R." in dd and "11:30" in dd and "provodka" in dd, dd[:200])
    check("hamma uchun bugungi duellar jadvali (kim, kim bilan, soat)", pg.locator("#dd-list .r").count() == 2 and "10:30" in dd and "6:4" in dd and pg.locator("#dd-list .r.me").count() == 1)
    check("admin: bugungi juftliklar ro'yxati", pg.locator("#pairs .r").count() == 2 and "6:4" in pg.inner_text("#pairs"))
    live_reset(kind="day", b_name="Aziz R.", opens_in=3600000, win_from="2026-10-01T06:30:00Z", win_to="2026-10-01T07:30:00Z")
    pg.click("#dd-go"); pg.wait_for_timeout(1500)
    lob = pg.inner_text("#day-lobby") if pg.locator("#day-lobby").count() else ""
    check("juftlik dueli: soatni kutish (11:30, 12:30 gacha)", "11:30 da ochiladi" in lob and "12:30" in lob and "Aziz R." in lob, lob[:300])
    check("juftlik duelida havola/ulashish yo'q", pg.locator("#live-share").count() == 0)
    LIVE.update({"opens_in": 0, "status": "done", "note": "forfeit", "winner": "a", "a_pts": 1, "b_pts": 0}); pg.wait_for_timeout(1500)
    check("raqib kelmasa — g'alaba sizga", "g'alaba sizga" in (pg.inner_text("#live-note") if pg.locator("#live-note").count() else ""))
    LIVE.pop("kind", None)

    EXTRA["liga_day_duel_me"] = None; EXTRA["liga_day_duels_list"] = []
    pg, e = page(b, when="2026-10-01T03:00:00Z"); ALLERR += e
    check("juft hali tuzilmagan: karta 09:00 da tuzilishini aytadi", pg.locator("#dd-wait").count() == 1 and "09:00" in pg.inner_text("#dd-wait"))
    EXTRA.pop("liga_day_duel_me", None); EXTRA.pop("liga_day_duels_list", None)

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
