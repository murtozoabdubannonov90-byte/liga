"""Hisobchi Liga 2.0 — Playwright yordamchilari (server so'rovlari soxtalashtirilgan)"""
import json, os, subprocess, time, socket
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8790
BASE = f"http://localhost:{PORT}/index.html"
SEED = {"xp": 1240, "lang": "uz", "user": {"first": "Dilnoza", "last": "Karimova", "phone": "+998901234567", "region": "Farg'ona viloyati"}, "name": "Dilnoza",
        "pid": "p1", "token": "tok1", "stars": {"0": 3, "1": 2, "2": 3}, "streak": 4, "group": {"code": "ASOSIY", "start": "2026-09-28", "ok": True},
        "week": {"id": "2026-10-02T07:00", "my": 1180, "part": {"stage": 1180, "daily": 96, "blitz": 120, "bonus": 60}, "stages": {"0": 430, "1": 390, "2": 360}},
        "me": {"ok": True, "personal": True, "paid_until": "2026-10-30", "price": 30000, "ref_code": "S5HMGC", "refs": 2, "tier": 1}, "tier": 1, "blitz": 14,
        "payCfg": {"price": 30000, "card": "5614681012876904", "card_name": "Abdubannonov M"}}
CALLS, EXTRA = [], {}
# ---- server o'yinlari taqlidi: savollar javobsiz beriladi, javob shu yerda tekshiriladi ----
RUNS = {}
CODES = ["5010", "5110", "6010", "4010", "9420", "6410"]
def mk_items(n):
    items, ans = [], []
    for k in range(n):
        if k % 3 == 0: items.append({"k": k, "t": "pv", "q": f"Savol №{k+1}: kassaga bankdan pul olindi", "o": CODES}); ans.append({"dt": "5010", "kt": "5110"})
        elif k % 3 == 1: items.append({"k": k, "t": "mc", "q": f"Savol №{k+1}: qaysi biri to'g'ri?", "o": ["Alfa", "Beta", "Gamma", "Delta"]}); ans.append({"a": k % 4})
        else: items.append({"k": k, "t": "calc", "q": f"Savol №{k+1}: hisoblang"}); ans.append({"a": 1000 * (k + 1)})
    return items, ans
def run_state(rid):
    r = RUNS[rid]
    return {"run": rid, "kind": r["kind"], "ref": "x", "n": len(r["items"]), "combo": r["combo"], "right_n": r["right"], "done_n": r["done"], "gain": r["gain"],
            "bonus": r["bonus"], "stars": r["stars"], "finished": r["finished"], "ms": 123000 if r["finished"] else None, "started_at": "2026-10-01T05:00:00Z",
            "extra_sec": r.get("extra", 0), "qsec": 60 + r.get("extra", 0)}
def run_view(rid):
    r = RUNS[rid]; return dict(run_state(rid), items=[dict(it, st=r["st"][i]) for i, it in enumerate(r["items"])])
def new_run(kind, n, prefill=0):
    rid = f"{kind}-{len(RUNS)+1}"; items, ans = mk_items(n)
    RUNS[rid] = {"kind": kind, "items": items, "ans": ans, "st": [None] * n, "combo": 0, "right": 0, "done": 0, "gain": 0, "bonus": 0, "stars": None, "finished": False}
    RUNS[rid]["extra"] = EXTRA.get("_extra", 0) if kind == "stage" else 0
    for i in range(1, 1 + prefill): RUNS[rid]["st"][i] = "ok"; RUNS[rid]["right"] += 1; RUNS[rid]["done"] += 1; RUNS[rid]["gain"] += 10
    return rid
def run_answer(a):
    rid, k, p = a["p_run"], a["p_k"], a.get("p_ans") or {}; r = RUNS[rid]; x = r["ans"][k]; t = r["items"][k]["t"]
    if p.get("left"): ok, why = False, "left"
    elif t == "pv": ok, why = p.get("dt") == x["dt"] and p.get("kt") == x["kt"], ""
    elif t == "mc": ok, why = p.get("pick") == x["a"], ""
    else: ok, why = str(p.get("val", "")).isdigit() and int(p["val"]) == x["a"], ""
    g = 0
    if ok:
        r["combo"] += 1
        if r["kind"] == "stage": g = 10 + (5 if r["combo"] >= 3 else 0) + (5 if r["combo"] >= 7 else 0)
    else: r["combo"] = 0
    r["st"][k] = "ok" if ok else "bad"; r["right"] += int(ok); r["done"] += 1; r["gain"] += g
    if r["done"] >= len(r["items"]):
        r["finished"] = True
        if r["kind"] == "stage": miss = len(r["items"]) - r["right"]; r["stars"] = 3 if miss == 0 else 2 if miss <= 2 else 1; r["bonus"] = r["stars"] * 30
    return dict(run_state(rid), ok=ok, why=why, got=g, reveal=dict(x, e="Izoh: shunday hisoblanadi."))
# ---- jonli duel taqlidi ----
LIVE = {}
def live_reset(**kw):
    items, ans = mk_items(10)
    LIVE.clear(); LIVE.update({"code": "LQWERTY", "status": "wait", "me": "a", "a_name": "Dilnoza K.", "b_name": None, "a_pts": 0, "b_pts": 0, "a_ms": 0, "b_ms": 0,
        "n": 10, "cur": 0, "qsec": 30, "q_in": 0, "left": 25000, "locked": False, "opp_locked": False, "last": None, "winner": None, "items": items, "ans": ans})
    LIVE.update(kw)
def live_view():
    v = {k: x for k, x in LIVE.items() if k not in ("items", "ans") and x is not None}
    if LIVE["status"] == "play" and LIVE["q_in"] == 0: v["item"] = LIVE["items"][LIVE["cur"]]
    return v
def live_answer(a):
    k, p = a["p_k"], a.get("p_ans") or {}; x = LIVE["ans"][k]; t = LIVE["items"][k]["t"]
    ok = (p.get("dt") == x.get("dt") and p.get("kt") == x.get("kt")) if t == "pv" else (p.get("pick") == x.get("a")) if t == "mc" else (str(p.get("val")) == str(x.get("a")))
    if ok:
        LIVE["a_pts"] += 1; LIVE["last"] = dict(k=k, w="a", q=LIVE["items"][k]["q"], t=t, **{kk: vv for kk, vv in x.items()}); LIVE["cur"] += 1; LIVE["q_in"] = 2500; LIVE["locked"] = False
    else: LIVE["locked"] = True
    return dict(live_view(), ok=ok, why="" if ok else "wrong")
def body_for(fn, args):
    if fn in EXTRA: return EXTRA[fn]
    if fn == "liga_live_create": live_reset(); return "LQWERTY"
    if fn == "liga_live_state": return live_view()
    if fn == "liga_live_answer": return live_answer(args)
    if fn == "liga_stage_start": return run_view(new_run("stage", 20, EXTRA.get("_prefill", 0)))
    if fn == "liga_duel_start": return run_view(new_run("duel", 10))
    if fn == "liga_final_start": return run_view(new_run("final", 20))
    if fn == "liga_test_begin": return dict(run_view(new_run("test", 10)), secret="sek", minutes=20, test_started="2026-10-01T05:00:00Z", title="Bosh buxgalter")
    if fn == "liga_run_show": return 60 + RUNS.get(args.get("p_run"), {}).get("extra", 0)
    if fn == "liga_run_answer": return run_answer(args)
    if fn == "liga_run_finish":
        r = RUNS[args["p_run"]]
        if r["kind"] != "stage":
            for i, st in enumerate(r["st"]):
                if st is None: r["st"][i] = "bad"; r["done"] += 1
            r["finished"] = True
        return run_state(args["p_run"])
    D = {
      "liga_results": [{"week_id": "2026-09-25T07:00", "name": "Dilnoza K.", "week_xp": 1310, "is_me": True, "week_stages": {}}, {"week_id": "2026-09-25T07:00", "name": "Aziz R.", "week_xp": 1250, "is_me": False, "week_stages": {}}, {"week_id": "2026-09-25T07:00", "name": "Malika S.", "week_xp": 1190, "is_me": False, "week_stages": {}}],
      "liga_count": 24,
      "liga_members2": [{"name": "Dilnoza K.", "is_me": True, "medal": 1, "tier": 1}, {"name": "Aziz R.", "is_me": False, "medal": 2, "tier": 2}, {"name": "Malika S.", "is_me": False, "medal": 3, "tier": 0}, {"name": "Bekzod T.", "is_me": False, "medal": None, "tier": 3}],
      "liga_group_info": [{"code": "ASOSIY", "name": "Buxgalterlar ligasi", "paid_until": None, "ok": True, "members": 24, "start_date": "2026-09-28"}],
      "liga_champions": [{"week_id": "2026-09-25T07:00", "pos": 1, "name": "Dilnoza K.", "week_xp": 1310, "is_me": True}, {"week_id": "2026-09-25T07:00", "pos": 2, "name": "Aziz R.", "week_xp": 1250, "is_me": False}],
      "liga_wq_state": [{"can_submit": False, "my_status": None, "q_id": 5, "q": "Xaridordan olingan bo'nak qaysi hisobvaraqda aks etadi?", "o": ["6310", "4010", "5110"], "author": "Aziz R."}],
      "liga_final_info": [{"month": "2026-10", "final_date": "2026-10-31", "open_now": False, "ended": False, "qualified": True, "my_score": None, "my_ms": None, "qualifiers": [{"n": "Dilnoza K.", "tops": 3, "xp": 3420, "me": True}, {"n": "Aziz R.", "tops": 2, "xp": 3180, "me": False}], "standings": []}],
      "liga_region_league": [{"region": "Farg'ona viloyati", "code": "ASOSIY", "name": "Buxgalterlar ligasi", "team_xp": 1290, "top3": "Dilnoza K. 450 · Aziz R. 430 · Malika S. 410", "rnk": 1, "is_mine": True, "week_id": "x"}, {"region": "Farg'ona viloyati", "code": "B2", "name": "Qo'qon audit", "team_xp": 1215, "top3": "Sardor M. 440 · Nodira A. 400", "rnk": 2, "is_mine": False, "week_id": "x"}],
      "liga_player_status2": [{"paid_until": "2026-10-30", "ok": True, "personal": True, "price": 30000, "pending": False, "tier": 1, "ref_code": "S5HMGC", "refs": 2, "tg_linked": False, "lang": "uz"}],
      "liga_cq_list": [], "liga_my_certs": [], "liga_stage_status": [],
      "liga_match_info": {"cur": {"me": "ASOSIY", "opp": "B2", "opp_name": "Qo'qon audit", "opp_region": "Farg'ona viloyati", "my_played": 3, "opp_played": 2}, "prev": {"opp_name": "Marg'ilon hisob", "my_xp": 1290, "opp_xp": 1100}},
      "liga_news_list": [{"id": 7, "created_at": "2026-09-30T05:00:00Z", "title_uz": "QQS bo'yicha yangi tartib", "title_ru": None, "body_uz": "Yangi qarorga ko'ra elektron hisob-fakturalar 5 kun ichida qabul qilinishi kerak. Batafsil manbada.", "body_ru": None, "url": "https://lex.uz/", "qs": [{"q": "Faktura necha kunda qabul qilinishi kerak?", "o": ["5 kun", "10 kun", "30 kun"], "a": 0, "e": "Qarorda 5 kun deyilgan."}]}],
      "liga_tax_cal_list": [{"id": 1, "day": 3, "months": None, "title_uz": "Sinov muddati: aylanma hisoboti", "title_ru": None, "topic": "sol", "active": True},
                            {"id": 2, "day": 15, "months": None, "title_uz": "JShDS va ijtimoiy soliq: hisobot va to'lov", "title_ru": None, "topic": "ish", "active": True}],
      "liga_tax_cal_save": 3, "liga_news_admin": [], "liga_news_save": 8, "liga_login_begin": "login_abc", "liga_set_tax_remind": None, "liga_pay_config2": [{"payme_merchant_id": "", "click_service_id": "", "click_merchant_id": "", "price": 30000, "card": "5614 6810 1287 6904", "card_name": "Abdubannonov M"}],
      "liga_join3": [{"id": "new-id", "token": "tok-new", "ref_code": "NEWREF"}], "liga_claim": "tok-claimed", "liga_pin_check": "admin",
      "liga_group_public": [{"code": "BX12AB", "name": "Sinov jamoasi", "ok": True, "start_date": "2026-10-05", "exists_active": True}],
      "liga_my_duels": [{"code": "HMAH87", "a_name": "Dilnoza K.", "b_name": "Aziz R.", "a_score": 8, "a_ms": 312000, "b_score": 7, "b_ms": 290000, "is_a": True, "created_at": "2026-10-01T10:00:00Z"}],
      "liga_duel_get": [{"code": "HMAH87", "a_name": "Aziz R.", "b_name": None, "a_score": 7, "a_ms": 290000, "b_score": None, "b_ms": None, "is_a": False, "is_b": False, "lang": "uz", "created_at": "2026-10-01T10:00:00Z"}],
      "liga_duel_create": "QW3RT9", "liga_duel_submit": [{"side": "b", "a_tg": None, "b_tg": None}],
      "liga_final_board": [{"name": "Dilnoza K.", "right_n": 12, "done_n": 14, "finished": False, "is_me": True}, {"name": "Aziz R.", "right_n": 11, "done_n": 15, "finished": False, "is_me": False}],
      "liga_admin_group": [{"code": "ASOSIY", "name": "Buxgalterlar ligasi", "paid_until": None, "ok": True, "members": 24, "max_players": None, "start_date": "2026-09-28", "chats": 1, "region": None, "price": 30000}],
      "liga_admin_list2": [{"id": "p1", "first_name": "Dilnoza", "last_name": "Karimova", "phone": "+998901234567", "xp": 2100, "week_xp": 1180, "week_id": "2026-10-02T07:00", "stages": 3, "streak": 4, "region": "Farg'ona viloyati", "acc_ok": 80, "acc_total": 90, "has_device": True, "paid_until": "2026-10-30", "pay_ok": True},
                           {"id": "p2", "first_name": "Aziz", "last_name": "Rahimov", "phone": "+998931112233", "xp": 1900, "week_xp": 900, "week_id": "2026-10-02T07:00", "stages": 3, "streak": 2, "region": None, "acc_ok": 60, "acc_total": 90, "has_device": True, "paid_until": None, "pay_ok": False}],
      "liga_admin_receipts": [{"id": 11, "player_id": "p2", "name": "Aziz Rahimov", "phone": "+998931112233", "months": 1, "amount": 30000, "receipt": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "status": "check", "created_at": "2026-10-01T10:00:00Z", "paid_until": "2026-10-31"}],
      "liga_admin_month": [{"id": "a", "name": "Dilnoza Karimova", "phone": "+998901234567", "region": "Farg'ona viloyati", "weeks": {"2026-10-02T07:00": 1180, "2026-10-09T07:00": 1240}, "month_xp": 2420, "tops": 2, "acc_ok": 80, "acc_total": 90, "last_active": "2026-10-09T10:00:00Z", "final_score": 340}],
      "liga_cq_admin": [], "liga_test_admin": [{"code": "TST7ABC", "title": "Bosh buxgalter", "n": 30, "minutes": 30, "lang": "uz", "active": True, "created_at": "2026-10-01T10:00:00Z", "runs": [{"name": "Nomzod Bir", "phone": "+998901234500", "score": 24, "total": 30, "ms": 1200000, "late": False, "finished": "2026-10-01T10:30:00Z",
        "detail": [{"pool": "s%d" % (i % 12), "t": ["pv", "calc", "mc"][i % 3], "ok": i % 5 != 0} for i in range(30)]}]}],
      "liga_wq_admin": [], "liga_test_open": [{"code": "TST7ABC", "title": "Bosh buxgalter lavozimiga test", "n": 20, "minutes": 20, "lang": "uz", "active": True, "company": "Farg'ona buxgalterlari"}],
      "liga_test_start": [{"run_id": "run-1", "started_at": "2026-10-01T05:00:00Z"}],
      "liga_cert_verify": [{"id": "ABCD2345", "name": "Dilnoza Karimova", "kind": "week", "title": "week", "detail": "1|1310|2026-09-25T07:00", "issued_at": "2026-10-01T10:00:00Z", "team": "Buxgalterlar ligasi"}],
      "liga_cert_issue": [{"id": "ABCD2345", "title": "week", "detail": "1|1310|2026-09-25T07:00", "issued_at": "2026-10-01T10:00:00Z"}],
      "liga_day_info": {"prev_day": "2026-09-30", "prev_top": [{"pos": 1, "name": "Aziz R.", "me": False}, {"pos": 2, "name": "Dilnoza K.", "me": True}, {"pos": 3, "name": "Malika S.", "me": False}],
                        "extra_today": 7, "today_closed": False, "today_top": []},
      "liga_trial": False, "liga_live_list": [],
      "liga_admin_live": [{"name": "Aziz Rahimov", "today_si": 5, "today_pts": 240, "today_right": 15, "today_done": 20, "today_n": 20, "today_finished": True, "week_pts": 480, "week_stages": 2, "last_at": None},
                          {"name": "Malika Sobirova", "today_si": None, "today_pts": 0, "today_right": 0, "today_done": 0, "today_n": 0, "today_finished": False, "week_pts": 200, "week_stages": 1, "last_at": None}], "liga_super_set_trial": True,
      "liga_tg_link_code": "link_abc", "liga_me": [{"xp": 0, "stages": 0, "week_id": None, "week_stages": {}, "cur_week": "2026-10-02T07:00"}],
      "liga_receipt_submit": [{"id": 12, "paid_until": "2026-10-31"}], "liga_tg_pay_link": "pay_abc", "liga_admin_tg_link": "adm_abc",
    }
    return D.get(fn, None)
def handler(route):
    u = route.request.url
    if "/rpc/" in u:
        fn = u.split("/rpc/")[-1].split("?")[0]; args = json.loads(route.request.post_data or "{}")
        CALLS.append((fn, args)); b = body_for(fn, args)
        if isinstance(b, dict) and "__error" in b: return route.fulfill(status=400, content_type="application/json", body=json.dumps({"message": b["__error"]}))
        return route.fulfill(status=200, content_type="application/json", body=json.dumps(b))
    if "/functions/v1/" in u:
        try: body = json.loads(route.request.post_data or "{}")
        except Exception: body = {}
        act = str(body.get("action", "")); CALLS.append(("bot:" + act, body))
        out = EXTRA.get("bot:" + act, {"ok": True})
        return route.fulfill(status=200, content_type="application/json", body=json.dumps(out))
    return route.fulfill(status=200, body="")
_srv = None
def serve():
    global _srv
    s = socket.socket()
    if s.connect_ex(("localhost", PORT)) != 0:
        _srv = subprocess.Popen(["python3", "-m", "http.server", str(PORT)], cwd=os.path.join(ROOT, "dist"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    s.close()
TG_MOCK = """window.Telegram={WebApp:{initData:'query_id=x&user=%7B%22id%22%3A5%7D&hash=y',initDataUnsafe:{user:{id:5,first_name:'Ali'}},version:'7.0',colorScheme:'light',
  ready(){},expand(){},isVersionAtLeast(){return false},setHeaderColor(){},setBackgroundColor(){},onEvent(){},openTelegramLink(u){window.__tgOpened=u},openLink(){},
  BackButton:{onClick(){},offClick(){},show(){},hide(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};"""
def page(b, when="2026-10-01T05:00:00Z", seed=SEED, w=390, h=844, dark=False, query="", tg=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, timezone_id="Asia/Tashkent", color_scheme="dark" if dark else "light")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**supabase.co/**", handler); pg.route("**telegram.org/**", lambda r: r.fulfill(status=200, body=""))
    pg.clock.install(time=when)
    if tg: pg.add_init_script(TG_MOCK)
    if seed is not None: pg.add_init_script("localStorage.setItem('hisobchi-liga-v1',JSON.stringify(%s))" % json.dumps(seed))
    pg.goto(BASE + query); pg.wait_for_timeout(900)
    return pg, errs
