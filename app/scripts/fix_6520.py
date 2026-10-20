"""2026-10-20 · Ijtimoiy soliq 6520 da yuritiladi (buxgalter.uz «Проводки по зарплате»: Дт затрат — Кт 6520; уплата — Дт 6520 — Кт 5110).
Bankda va ilova savollarida Kt/Dt 6410 deb berilgan edi. Bu modul bitta pv savolni (uz yoki ru matn bilan) tuzatadi.
JShDS, QQS, foyda solig'i — 6410 da qoladi."""
import re

SOC = re.compile(r"ijtimoiy soliq|социальн|соцналог", re.I)
NDFL = re.compile(r"JShDS|НДФЛ", re.I)

def kind(q: str, dt: str, kt: str):
    if not SOC.search(q): return None
    if NDFL.search(q) and dt == "6410" and kt == "5110": return "combo_pay"      # JShDS va ijtimoiy soliq birga to'landi
    if kt == "6410" and re.search(r"qaytarildi|возвращ", q, re.I): return "refund"
    if kt == "6410": return "accrue"
    if dt == "6410" and kt in ("5110", "5010"): return "pay"
    return None

def fix_opts(o, dt, kt):
    o = [str(x) for x in o]
    if "6520" in o: return o
    keep = {dt, kt, "6410"}
    for i in range(len(o) - 1, -1, -1):
        if o[i] not in keep: o[i] = "6520"; return o
    return o + ["6520"]

def fix_text(e: str, k: str, ru: bool) -> str:
    if k in ("accrue",):
        e = e.replace("Kt 6410", "Kt 6520").replace("Кт 6410", "Кт 6520")
        e = re.sub(r"budjetga qarz( paydo bo'ldi| oshadi)?", "ijtimoiy soliq bo'yicha qarz", e)
        e = re.sub(r"(долг|задолженность) перед бюджетом|долг бюджету", "задолженность по соцналогу", e)
    elif k == "pay":
        e = e.replace("Dt 6410", "Dt 6520").replace("Дт 6410", "Дт 6520")
        e = re.sub(r"Budjetga qarz", "Ijtimoiy soliq bo'yicha qarz", e)
        e = re.sub(r"(Долг|Задолженность) перед бюджетом", "Задолженность по соцналогу", e)
    elif k == "refund":
        e = e.replace("Kt 6410", "Kt 6520").replace("Кт 6410", "Кт 6520").replace("6410 dagi", "6520 dagi").replace("на 6410", "на 6520")
    note = (" Ijtimoiy soliq 6520 da, JShDS va QQS — 6410 da." if not ru else " Соцналог — на 6520, НДФЛ и НДС — на 6410.")
    if "6520 da" not in e and "на 6520" not in e: e = e.rstrip() + note
    return e

COMBO = {
  "uz": (lambda q: re.sub(r"JShDS va ijtimoiy soliq", "JShDS", q).replace("jami ", "")),
  "ru": (lambda q: re.sub(r"НДФЛ и социальный налог", "НДФЛ", q).replace("всего ", "").replace("перечислены", "перечислен").replace("уплачены", "уплачен")),
}
COMBO_E = {"uz": "JShDS qarzi yopildi (Dt 6410), bank kamaydi (Kt 5110). Ijtimoiy soliq alohida to'lanadi: Dt 6520 — Kt 5110.",
           "ru": "Задолженность по НДФЛ погашена (Дт 6410), расчётный счёт уменьшился (Кт 5110). Соцналог уплачивается отдельно: Дт 6520 — Кт 5110."}

def fix_task(t: dict, ru: bool = False):
    """t: {'q','e','o','dt','kt'} — joyida o'zgartiradi. Qaytaradi: tur yoki None."""
    if t.get("t", "pv") != "pv": return None
    k = kind(t.get("q", ""), str(t.get("dt")), str(t.get("kt")))
    if not k: return None
    if k == "combo_pay":
        t["q"] = COMBO["ru" if ru else "uz"](t["q"]); t["e"] = COMBO_E["ru" if ru else "uz"]
        return k
    if k in ("accrue", "refund"): t["kt"] = "6520"
    if k == "pay": t["dt"] = "6520"
    t["o"] = fix_opts(t.get("o") or [], str(t["dt"]), str(t["kt"]))
    t["e"] = fix_text(t.get("e", ""), k, ru)
    return k
