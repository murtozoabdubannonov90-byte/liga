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
def body_for(fn, args):
    if fn in EXTRA: return EXTRA[fn]
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
      "liga_cq_list": [], "liga_my_certs": [], "liga_pay_config2": [{"payme_merchant_id": "", "click_service_id": "", "click_merchant_id": "", "price": 30000, "card": "5614 6810 1287 6904", "card_name": "Abdubannonov M"}],
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
      "liga_cq_admin": [], "liga_test_admin": [{"code": "TST7ABC", "title": "Bosh buxgalter", "n": 30, "minutes": 30, "lang": "uz", "active": True, "created_at": "2026-10-01T10:00:00Z", "runs": [{"name": "Nomzod Bir", "phone": "+998901234500", "score": 24, "total": 30, "ms": 1200000, "late": False, "finished": "x"}]}],
      "liga_wq_admin": [], "liga_test_open": [{"code": "TST7ABC", "title": "Bosh buxgalter lavozimiga test", "n": 20, "minutes": 20, "lang": "uz", "active": True, "company": "Farg'ona buxgalterlari"}],
      "liga_test_start": [{"run_id": "run-1", "started_at": "2026-10-01T05:00:00Z"}],
      "liga_cert_verify": [{"id": "ABCD2345", "name": "Dilnoza Karimova", "kind": "week", "title": "week", "detail": "1|1310|2026-09-25T07:00", "issued_at": "2026-10-01T10:00:00Z", "team": "Buxgalterlar ligasi"}],
      "liga_cert_issue": [{"id": "ABCD2345", "title": "week", "detail": "1|1310|2026-09-25T07:00", "issued_at": "2026-10-01T10:00:00Z"}],
      "liga_receipt_submit": [{"id": 12, "paid_until": "2026-10-31"}], "liga_tg_pay_link": "pay_abc", "liga_admin_tg_link": "adm_abc",
    }
    return D.get(fn, None)
def handler(route):
    u = route.request.url
    if "/rpc/" in u:
        fn = u.split("/rpc/")[-1].split("?")[0]; args = json.loads(route.request.post_data or "{}")
        CALLS.append((fn, args)); b = body_for(fn, args)
        return route.fulfill(status=200, content_type="application/json", body=json.dumps(b))
    if "/functions/v1/" in u: return route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
    return route.fulfill(status=200, body="")
_srv = None
def serve():
    global _srv
    s = socket.socket()
    if s.connect_ex(("localhost", PORT)) != 0:
        _srv = subprocess.Popen(["python3", "-m", "http.server", str(PORT)], cwd=os.path.join(ROOT, "dist"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    s.close()
def page(b, when="2026-10-01T05:00:00Z", seed=SEED, w=390, h=844, dark=False, query=""):
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, timezone_id="Asia/Tashkent", color_scheme="dark" if dark else "light")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**supabase.co/**", handler); pg.route("**telegram.org/**", lambda r: r.fulfill(status=200, body=""))
    pg.clock.install(time=when)
    if seed is not None: pg.add_init_script("localStorage.setItem('hisobchi-liga-v1',JSON.stringify(%s))" % json.dumps(seed))
    pg.goto(BASE + query); pg.wait_for_timeout(900)
    return pg, errs
