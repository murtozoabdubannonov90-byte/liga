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
    xp0 = S(pg, "S.xp"); answer(pg, True)
    check("to'g'ri javob: TO'G'RI muhri", pg.locator(".stamp.ok").count() == 1)
    check("to'g'ri javob: +10 XP", S(pg, "S.xp") == xp0 + 10, (xp0, S(pg, "S.xp")))
    check("haftalik liga bali ham oshdi", S(pg, "S.week.stages['3']") == 10, S(pg, "S.week.stages"))
    pg.click("#nx"); pg.wait_for_timeout(400)
    answer(pg, False)
    check("xato javob: XATO muhri va sababi", pg.locator(".stamp.bad").count() == 1 and "To'g'ri" in txt(pg))
    check("xato daftariga tushdi", S(pg, "Object.keys(S.errs).length") >= 1)
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
    pg.evaluate("(si)=>{const r=__liga.score.saRec(si); for(let k=1;k<20;k++) r.m[k]='ok'; __liga.st.persist()}", si)
    go(pg, "intro", {"si": si}); pg.click("#go"); pg.wait_for_timeout(500)
    CALLS.clear(); answer(pg, True); pg.click("#nx"); pg.wait_for_timeout(1500)
    sd = calls("bot:stage_done")
    check("bosqich tugaganda natija botga yuborildi", len(sd) == 1 and sd[0].get("si") == si and sd[0].get("right") == 20, sd)
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
    check("raqam band bo'lsa to'lovga o'tmaydi, sabab ko'rsatiladi", "5614" not in txt(pg) and "boshqa telefonda" in txt(pg), txt(pg)[-300:])
    del EXTRA["liga_join3"]

    print("5. Mashq rejimlari")
    pg, e = page(b); ALLERR += e
    r = pg.evaluate("()=>{const r=__liga.run.startBlitz(); return {n:r.queue.length, mode:r.mode}}")
    check("blits: 20 provodka", r == {"n": 20, "mode": "blitz"}, r)
    r = pg.evaluate("()=>{const r=__liga.run.startDaily(); return r.queue.length}")
    check("kunlik mashq: 10 savol", r == 10, r)
    r = pg.evaluate("()=>{const r=__liga.run.startTopic('qqs'); return typeof r==='string'?r:r.queue.length}")
    check("yo'nalish (QQS): 10 savol", r == 10, r)
    r = pg.evaluate("()=>{const a=__liga.run.startDuel('HMAH87'),b=__liga.run.startDuel('HMAH87');return [a.queue.map(x=>x.id).join(),b.queue.map(x=>x.id).join(),a.queue.length]}")
    check("duel: ikkala o'yinchiga bir xil 10 savol", r[0] == r[1] and r[2] == 10, r)
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
    pg.fill("#cn", "Nomzod Ikki"); pg.fill("#cp", "+998901234599"); pg.click("#go"); pg.wait_for_timeout(700)
    check("test boshlandi", pg.locator(".qtext").count() == 1)

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
