#!/usr/bin/env python3
"""Faktura detektivi — hujjat savollari generatori (2026-11-02).

Har bir savol — bitta hujjat (hisob-faktura, kassa kirim orderi, ish haqi hisob-kitobi, ishonchnoma).
Hujjatda 0–3 ta xato qator bor; o'yinchi xato qatorlarni belgilaydi. Javob kaliti serverda (liga_bank.dt),
ilovaga faqat hujjatning o'zi boradi.

Faqat aniq tekshiriladigan xatolar ishlatiladi (arifmetika, rekvizit uzunligi, sana tartibi, imzo, stavka),
qonunchilik talqiniga bog'liq bahsli holatlar ishlatilmaydi.

Ishlatish:  python3 scripts/doc_bank.py > db/2026-11-02b_detektiv_bank.sql
Tekshiruv:  python3 scripts/doc_bank.py --check   (har bir hujjatni qayta hisoblab, kalit to'g'riligini tekshiradi)
"""
import json, random, sys
from datetime import date, timedelta

R = random.Random(20261102)
VAT = 12           # QQS stavkasi, %
PIT = 12           # JShDS, %
SOC = 12           # ijtimoiy soliq (ish beruvchi hisobidan), %

def fmt(n: int) -> str:
    return f"{n:,}".replace(",", " ")

def d(x: date) -> str:
    return x.strftime("%d.%m.%Y")

# ---------------- sonni so'z bilan yozish ----------------
UZ1 = ["", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"]
UZ10 = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"]
def uz3(n: int) -> list:
    w = []
    if n >= 100: w += [UZ1[n // 100], "yuz"]; n %= 100
    if n >= 10: w.append(UZ10[n // 10]); n %= 10
    if n: w.append(UZ1[n])
    return w
def uz_words(n: int) -> str:
    if n == 0: return "nol so'm"
    parts = []
    for val, name in ((10**9, "milliard"), (10**6, "million"), (1000, "ming")):
        if n >= val: parts += uz3(n // val) + [name]; n %= val
    parts += uz3(n)
    s = " ".join(parts) + " so'm"
    return s[0].upper() + s[1:]

RU1 = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"]
RU1F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"]
RU10_19 = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"]
RU10 = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"]
RU100 = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"]
def ru3(n: int, fem=False) -> list:
    w = []
    if n >= 100: w.append(RU100[n // 100]); n %= 100
    if 10 <= n <= 19: w.append(RU10_19[n - 10]); return w
    if n >= 20: w.append(RU10[n // 10]); n %= 10
    if n: w.append((RU1F if fem else RU1)[n])
    return w
def ru_form(n: int, f1, f2, f5):
    n %= 100
    if 11 <= n <= 19: return f5
    n %= 10
    return f1 if n == 1 else f2 if 2 <= n <= 4 else f5
def ru_words(n: int) -> str:
    if n == 0: return "Ноль сум"
    parts = []
    for val, forms, fem in ((10**9, ("миллиард", "миллиарда", "миллиардов"), False), (10**6, ("миллион", "миллиона", "миллионов"), False), (1000, ("тысяча", "тысячи", "тысяч"), True)):
        if n >= val:
            k = n // val; parts += ru3(k, fem) + [ru_form(k, *forms)]; n %= val
    parts += ru3(n)
    s = " ".join(parts) + " сум"
    return s[0].upper() + s[1:]

# ---------------- ma'lumotlar ----------------
FIRMS = ["«Ipak Yo'li Savdo» MChJ", "«Farg'ona Metall» MChJ", "«Sharq Qurilish» MChJ", "«Navro'z Tekstil» MChJ", "«Oltin Vodiy» MChJ",
         "«Buvayda Agro» MChJ", "«Quvasoy Sement» MChJ", "«Toshkent Elektro» MChJ", "«Samarqand Non» MChJ", "«Andijon Avto Servis» MChJ",
         "«Zarafshon Kimyo» MChJ", "«Mezon Ofis» MChJ", "«Yashil Bog'» XK", "«Baraka Plyus» MChJ", "«Nur Mebel» MChJ"]
FIRMS_RU = {f: f.replace("MChJ", "ООО").replace("XK", "ЧП") for f in FIRMS}
GOODS = [("Sement M400", "Цемент М400", "qop", "мешок", (55_000, 75_000)), ("Armatura 12 mm", "Арматура 12 мм", "tonna", "тонна", (9_800_000, 11_500_000)),
         ("A4 qog'oz", "Бумага A4", "pachka", "пачка", (42_000, 58_000)), ("Paxta mato", "Хлопковая ткань", "metr", "метр", (18_000, 32_000)),
         ("Kabel VVG 3x2,5", "Кабель ВВГ 3x2,5", "metr", "метр", (9_000, 15_000)), ("O'g'it ammofos", "Удобрение аммофос", "tonna", "тонна", (6_200_000, 7_900_000)),
         ("Monitor 24\"", "Монитор 24\"", "dona", "шт", (1_450_000, 2_300_000)), ("Bo'yoq (suvli emulsiya)", "Краска водоэмульсионная", "kg", "кг", (21_000, 34_000)),
         ("Un 1-nav", "Мука 1 сорта", "qop", "мешок", (215_000, 260_000)), ("Ofis stuli", "Офисный стул", "dona", "шт", (640_000, 980_000))]
NAMES = ["Karimov Jasur", "Tursunova Dilnoza", "Rahimov Bekzod", "Yo'ldosheva Madina", "Abdullayev Sardor", "Qodirova Nigora", "Ergashev Otabek", "Mirzayeva Gulnora"]

def tin() -> str: return str(R.randint(200_000_000, 309_999_999))
def ikpu() -> str: return "".join(str(R.randint(0, 9)) for _ in range(17))
def bad_digits(s: str) -> str:
    return s[:-1] if R.random() < 0.5 else s + str(R.randint(0, 9))
def day_in_2026() -> date:
    return date(2026, R.randint(1, 10), R.randint(1, 28))

L = lambda uz, ru: {"uz": uz, "ru": ru}

def row(k, uz, ru, v_uz, v_ru=None):
    return {"k": k, "l": L(uz, ru), "v": L(v_uz, v_ru if v_ru is not None else v_uz)}

# ---------------- hujjat turlari ----------------
def faktura(errs: set):
    seller, buyer = R.sample(FIRMS, 2)
    g = R.choice(GOODS); qty = R.choice([5, 8, 10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200])
    if g[2] == "tonna": qty = R.choice([2, 3, 4, 5, 6, 8, 10, 12])
    price = R.randrange(g[4][0], g[4][1], 1000) // 1000 * 1000
    true_sum = qty * price
    s_tin, b_tin, ik = tin(), tin(), ikpu()
    cdate = day_in_2026(); fdate = cdate + timedelta(days=R.randint(2, 40))
    fix = {}
    sum_v = true_sum
    if "sum" in errs:
        sum_v = true_sum + R.choice([-1, 1]) * price * R.choice([1, 2, 10])
        fix["sum"] = L(f"Qiymat = miqdor × narx = {qty} × {fmt(price)} = {fmt(true_sum)}. Hujjatda {fmt(sum_v)} yozilgan.",
                       f"Стоимость = количество × цена = {qty} × {fmt(price)} = {fmt(true_sum)}. В документе {fmt(sum_v)}.")
    vat_v = sum_v * VAT // 100
    if "vat" in errs:
        wrong = R.choice([15, 10, 20])
        vat_v = sum_v * wrong // 100
        fix["vat"] = L(f"QQS = {fmt(sum_v)} × 12% = {fmt(sum_v * VAT // 100)}. Hujjatda {fmt(vat_v)} — {wrong}% bo'yicha hisoblangan.",
                       f"НДС = {fmt(sum_v)} × 12% = {fmt(sum_v * VAT // 100)}. В документе {fmt(vat_v)} — посчитан по {wrong}%.")
    total_v = sum_v + vat_v
    if "total" in errs:
        total_v = sum_v + vat_v + R.choice([-1, 1]) * R.choice([100_000, 1_000_000, 10_000])
        fix["total"] = L(f"QQS bilan qiymat = {fmt(sum_v)} + {fmt(vat_v)} = {fmt(sum_v + vat_v)}. Hujjatda {fmt(total_v)}.",
                         f"Стоимость с НДС = {fmt(sum_v)} + {fmt(vat_v)} = {fmt(sum_v + vat_v)}. В документе {fmt(total_v)}.")
    rate_v = "12%"
    if "rate" in errs:
        rate_v = R.choice(["15%", "20%"])
        fix["rate"] = L(f"QQS stavkasi — 12% (2023-yildan). {rate_v} — eskirgan stavka.", f"Ставка НДС — 12% (с 2023 года). {rate_v} — устаревшая ставка.")
    if "s_tin" in errs:
        s_tin = bad_digits(s_tin)
        fix["s_tin"] = L(f"STIR 9 ta raqamdan iborat bo'ladi. Hujjatda {len(s_tin)} ta raqam.", f"ИНН состоит из 9 цифр. В документе {len(s_tin)} цифр.")
    if "b_tin" in errs:
        b_tin = bad_digits(b_tin)
        fix["b_tin"] = L(f"Xaridor STIRi 9 ta raqamdan iborat bo'lishi kerak. Hujjatda {len(b_tin)} ta.", f"ИНН покупателя должен состоять из 9 цифр. В документе {len(b_tin)}.")
    if "same" in errs:
        b_tin = s_tin
        fix["b_tin"] = L("Xaridor STIRi sotuvchinikiga teng — firma o'z-o'ziga faktura yoza olmaydi.", "ИНН покупателя совпадает с ИНН продавца — фирма не выставляет фактуру сама себе.")
    if "ikpu" in errs:
        ik = ik[:R.choice([15, 16])]
        fix["ikpu"] = L(f"IKPU (MXIK) kodi 17 ta raqamdan iborat. Hujjatda {len(ik)} ta.", f"Код ИКПУ состоит из 17 цифр. В документе {len(ik)}.")
    if "date" in errs:
        fdate = cdate - timedelta(days=R.randint(3, 30))
        fix["date"] = L(f"Faktura sanasi ({d(fdate)}) shartnomadan ({d(cdate)}) oldin — shartnomasiz yetkazib berish bo'lmaydi.",
                        f"Дата фактуры ({d(fdate)}) раньше договора ({d(cdate)}) — поставки без договора не бывает.")
    no = R.randint(100, 2999); cno = f"{R.randint(1, 99)}-{R.choice(['S', 'T', 'Q'])}"
    rows = [
        row("no", "Faktura raqami va sanasi", "Номер и дата фактуры", f"№ {no} · {d(fdate)} (shartnoma № {cno} · {d(cdate)} asosida)", f"№ {no} · {d(fdate)} (на основании договора № {cno} · {d(cdate)})"),
        row("seller", "Sotuvchi", "Продавец", seller, FIRMS_RU[seller]),
        row("s_tin", "Sotuvchi STIRi", "ИНН продавца", s_tin),
        row("buyer", "Xaridor", "Покупатель", buyer, FIRMS_RU[buyer]),
        row("b_tin", "Xaridor STIRi", "ИНН покупателя", b_tin),
        row("goods", "Tovar", "Товар", g[0], g[1]),
        row("ikpu", "IKPU (MXIK) kodi", "Код ИКПУ", ik),
        row("qty", "Miqdor", "Количество", f"{qty} {g[2]}", f"{qty} {g[3]}"),
        row("price", "Narx (QQSsiz)", "Цена (без НДС)", fmt(price)),
        row("sum", "Yetkazib berish qiymati", "Стоимость поставки", fmt(sum_v)),
        row("rate", "QQS stavkasi", "Ставка НДС", rate_v),
        row("vat", "QQS summasi", "Сумма НДС", fmt(vat_v)),
        row("total", "QQS bilan qiymati", "Стоимость с НДС", fmt(total_v)),
    ]
    # «date» xatosi shartnoma qatorida emas, faktura sanasida ko'rinadi — kalit «no» qatoriga bog'lanadi
    if "date" in fix: fix["no"] = fix.pop("date")
    if "same" in errs: errs = (errs - {"same"}) | {"b_tin"}
    keys = {"date": "no"}
    bad = sorted({keys.get(e, e) for e in errs})
    return L("Hisob-faktura", "Счёт-фактура"), rows, bad, fix

CASH = [("Bankdan naqd pul olindi (chek № {n})", "Получены наличные из банка (чек № {n})", "5110"),
        ("Xaridordan tovar uchun naqd to'lov", "Оплата наличными от покупателя за товар", "4010"),
        ("Ta'sischidan ustav kapitaliga hissa", "Взнос учредителя в уставный капитал", "4610"),
        ("Xizmat safaridan qaytgan xodim ishlatilmagan avansni qaytardi", "Сотрудник вернул неиспользованный аванс после командировки", "4220")]
def kassa(errs: set):
    a = R.choice(CASH); n = R.randint(1000, 9999)
    amount = R.randint(8, 950) * 10_000 + R.choice([0, 0, 5_000])
    korr = a[2]; fix = {}
    if "korr" in errs:
        korr = R.choice([c[2] for c in CASH if c[2] != a[2]])
        fix["korr"] = L(f"Asosga ko'ra kirim Dt 5010 — Kt {a[2]} bo'lishi kerak. Hujjatda Kt {korr}.", f"По основанию приход: Дт 5010 — Кт {a[2]}. В документе Кт {korr}.")
    words_n = amount
    if "words" in errs:
        s = str(amount)
        words_n = amount + R.choice([10_000, 100_000, -10_000, 1_000_000]) if amount > 1_000_000 else amount + 100_000
        fix["words"] = L(f"Yozuvdagi summa raqamdagiga ({fmt(amount)}) mos emas: yozuvda {fmt(words_n)}.", f"Сумма прописью не совпадает с цифрами ({fmt(amount)}): прописью {fmt(words_n)}.")
    head = "imzolangan ✓"; head_ru = "подписано ✓"; cash = "imzolangan ✓"; cash_ru = "подписано ✓"
    if "head" in errs:
        head, head_ru = "—", "—"
        fix["head"] = L("Kassa orderini bosh hisobchi (yoki rahbar) imzolashi shart — imzosiz order haqiqiy emas.", "Кассовый ордер обязательно подписывает главный бухгалтер (или руководитель) — без подписи ордер недействителен.")
    if "cashier" in errs:
        cash, cash_ru = "—", "—"
        fix["cashier"] = L("Pulni qabul qilgan kassir imzosi yo'q.", "Нет подписи кассира, принявшего деньги.")
    who = R.choice(NAMES)
    rows = [
        row("no", "Order raqami va sanasi", "Номер и дата ордера", f"№ {R.randint(1, 400)} · {d(day_in_2026())}"),
        row("who", "Kimdan qabul qilindi", "Принято от", who),
        row("why", "Asos", "Основание", a[0].format(n=n), a[1].format(n=n)),
        row("korr", "Korrespondent schyot", "Корреспондирующий счёт", f"Dt 5010 — Kt {korr}", f"Дт 5010 — Кт {korr}"),
        row("sum", "Summa (raqamda)", "Сумма (цифрами)", fmt(amount)),
        row("words", "Summa (yozuvda)", "Сумма (прописью)", uz_words(words_n), ru_words(words_n)),
        row("head", "Bosh hisobchi imzosi", "Подпись главного бухгалтера", head, head_ru),
        row("cashier", "Kassir imzosi", "Подпись кассира", cash, cash_ru),
    ]
    return L("Kassa kirim orderi", "Приходный кассовый ордер"), rows, sorted(errs), fix

def salary(errs: set):
    who = R.choice(NAMES); gross = R.randint(30, 260) * 100_000
    pit_v = gross * PIT // 100; soc_v = gross * SOC // 100; fix = {}
    if "pit" in errs:
        wrong = R.choice([10, 13, 7.5])
        pit_v = int(gross * wrong / 100)
        fix["pit"] = L(f"JShDS = {fmt(gross)} × 12% = {fmt(gross * PIT // 100)}. Hujjatda {fmt(pit_v)}.", f"НДФЛ = {fmt(gross)} × 12% = {fmt(gross * PIT // 100)}. В документе {fmt(pit_v)}.")
    if "soc" in errs:
        soc_v = gross * 25 // 100
        fix["soc"] = L(f"Ijtimoiy soliq (tijorat korxonasi) = {fmt(gross)} × 12% = {fmt(gross * SOC // 100)}. 25% — budjet tashkilotlari stavkasi.",
                       f"Соцналог (коммерческая организация) = {fmt(gross)} × 12% = {fmt(gross * SOC // 100)}. 25% — ставка бюджетных организаций.")
    net_v = gross - pit_v
    if "net" in errs:
        if R.random() < 0.6:
            net_v = gross - pit_v - soc_v
            fix["net"] = L(f"Qo'lga = hisoblangan − JShDS = {fmt(gross)} − {fmt(pit_v)} = {fmt(gross - pit_v)}. Ijtimoiy soliq ish beruvchi hisobidan to'lanadi — xodim maoshidan ushlanmaydi.",
                           f"К выдаче = начислено − НДФЛ = {fmt(gross)} − {fmt(pit_v)} = {fmt(gross - pit_v)}. Соцналог платит работодатель — из зарплаты не удерживается.")
        else:
            net_v = gross - pit_v + R.choice([-100_000, 100_000, -10_000])
            fix["net"] = L(f"Qo'lga = {fmt(gross)} − {fmt(pit_v)} = {fmt(gross - pit_v)}. Hujjatda {fmt(net_v)}.", f"К выдаче = {fmt(gross)} − {fmt(pit_v)} = {fmt(gross - pit_v)}. В документе {fmt(net_v)}.")
    mon = R.choice(["sentabr", "oktabr", "avgust", "iyul"]); mon_ru = {"sentabr": "сентябрь", "oktabr": "октябрь", "avgust": "август", "iyul": "июль"}[mon]
    rows = [
        row("who", "Xodim", "Сотрудник", who),
        row("per", "Davr", "Период", f"2026-yil {mon}", f"{mon_ru} 2026 г."),
        row("gross", "Hisoblangan ish haqi", "Начисленная зарплата", fmt(gross)),
        row("pit", "JShDS (12%) — ushlandi", "НДФЛ (12%) — удержан", fmt(pit_v)),
        row("soc", "Ijtimoiy soliq (12%, ish beruvchi hisobidan)", "Соцналог (12%, за счёт работодателя)", fmt(soc_v)),
        row("net", "Qo'lga beriladi", "К выдаче", fmt(net_v)),
    ]
    return L("Ish haqi hisob-kitob varaqasi", "Расчётный листок по зарплате"), rows, sorted(errs), fix

def proxy(errs: set):
    who = R.choice(NAMES); frm = R.choice(FIRMS); g = R.choice(GOODS); given = day_in_2026()
    valid = given + timedelta(days=R.choice([5, 10, 15, 30]))
    pas = R.choice(["AA", "AB", "AC", "AD", "FA"]) + " " + "".join(str(R.randint(0, 9)) for _ in range(7))
    fix = {}; head, head_ru = "imzolangan ✓", "подписано ✓"
    if "valid" in errs:
        valid = given - timedelta(days=R.randint(1, 20))
        fix["valid"] = L(f"Amal qilish muddati ({d(valid)}) berilgan sanadan ({d(given)}) oldin — ishonchnoma hech qachon amal qilmaydi.",
                         f"Срок действия ({d(valid)}) раньше даты выдачи ({d(given)}) — доверенность никогда не действует.")
    if "pas" in errs:
        pas = pas[:-1]
        fix["pas"] = L("Pasport raqami 2 ta harf va 7 ta raqamdan iborat. Hujjatda 6 ta raqam.", "Номер паспорта — 2 буквы и 7 цифр. В документе 6 цифр.")
    if "head" in errs:
        head, head_ru = "—", "—"
        fix["head"] = L("Ishonchnomani rahbar imzolaydi — rahbar imzosisiz u haqiqiy emas.", "Доверенность подписывает руководитель — без его подписи она недействительна.")
    rows = [
        row("no", "Ishonchnoma raqami", "Номер доверенности", f"№ {R.randint(1, 300)}"),
        row("given", "Berilgan sana", "Дата выдачи", d(given)),
        row("valid", "Amal qilish muddati", "Действительна до", d(valid)),
        row("who", "Kimga berildi", "Кому выдана", who),
        row("pas", "Pasport", "Паспорт", pas),
        row("from", "Kimdan olish uchun", "На получение от", frm, FIRMS_RU[frm]),
        row("goods", "Nima olish uchun", "На получение", g[0], g[1]),
        row("head", "Rahbar imzosi", "Подпись руководителя", head, head_ru),
    ]
    return L("Ishonchnoma", "Доверенность"), rows, sorted(errs), fix

KINDS = {
    "faktura": (faktura, ["sum", "vat", "total", "rate", "s_tin", "b_tin", "same", "ikpu", "date"], {"sum", "vat", "total"}),
    "kassa": (kassa, ["korr", "words", "head", "cashier"], set()),
    "salary": (salary, ["pit", "soc", "net"], set()),
    "proxy": (proxy, ["valid", "pas", "head"], set()),
}
EASY = {"rate", "s_tin", "b_tin", "same", "ikpu", "head", "cashier", "pas", "valid"}

def pick_errs(kind: str, lv: int) -> set:
    _, pool, arith = KINDS[kind]
    if lv == 1:
        c = [e for e in pool if e in EASY] or pool
        return {R.choice(c)}
    if lv == 2:
        if R.random() < 0.25: return set()          # toza hujjat — «Xato yo'q»
        c = [e for e in pool if e not in EASY] or pool
        return {R.choice(c)}
    n = 2 if R.random() < 0.7 else 3
    es = set()
    for e in R.sample(pool, len(pool)):
        if len(es) >= n: break
        if e in arith and es & arith: continue       # bir hujjatda ikkita arifmetik xato bo'lmasin (javob noaniq bo'ladi)
        if {e, *es} >= {"b_tin", "same"}: continue
        es.add(e)
    return es

def build(n_total=240):
    out = []
    plan = []
    for i in range(n_total):
        lv = [1, 2, 2, 3, 3][i % 5]
        kind = ["faktura", "faktura", "kassa", "salary", "proxy"][R.randint(0, 4)] if lv != 3 else R.choice(["faktura", "faktura", "kassa", "salary", "proxy"])
        plan.append((lv, kind))
    for i, (lv, kind) in enumerate(plan, 1):
        errs = pick_errs(kind, lv)
        title, rows, bad, fix = KINDS[kind][0](set(errs))
        keys = {r["k"] for r in rows}
        assert set(bad) <= keys, (kind, bad)
        assert set(fix) == set(bad), (kind, bad, list(fix))
        e_uz = "Hujjatda xato yo'q — hamma hisob-kitob va rekvizitlar to'g'ri." if not bad else "Xato qatorlar: " + ", ".join(next(r["l"]["uz"] for r in rows if r["k"] == k) for k in bad) + "."
        e_ru = "В документе нет ошибок — все расчёты и реквизиты верны." if not bad else "Ошибочные строки: " + ", ".join(next(r["l"]["ru"] for r in rows if r["k"] == k) for k in bad) + "."
        doc_uz = {"title": title["uz"], "rows": [{"k": r["k"], "l": r["l"]["uz"], "v": r["v"]["uz"]} for r in rows]}
        doc_ru = {"title": title["ru"], "rows": [{"k": r["k"], "l": r["l"]["ru"], "v": r["v"]["ru"]} for r in rows]}
        q_uz = "Hujjatni tekshiring: xato qatorlarni belgilang (bir nechta bo'lishi mumkin). Xato bo'lmasa — «Xato yo'q»."
        q_ru = "Проверьте документ: отметьте ошибочные строки (их может быть несколько). Если ошибок нет — «Ошибок нет»."
        uz = {"q": q_uz, "doc": doc_uz, "e": e_uz, "fix": {k: v["uz"] for k, v in fix.items()}, "lv": lv, "kind": kind}
        ru = {"q": q_ru, "doc": doc_ru, "e": e_ru, "fix": {k: v["ru"] for k, v in fix.items()}, "lv": lv, "kind": kind}
        out.append({"id": f"doc{i:04d}", "uz": uz, "ru": ru, "dt": ",".join(bad)})
    return out

def sql(items):
    q = lambda s: "'" + s.replace("'", "''") + "'"
    lines = ["-- Faktura detektivi: hujjat savollari banki (scripts/doc_bank.py, seed 20261102). Qayta yuklash xavfsiz.",
             "insert into public.liga_bank(id, pool, t, uz, ru, dt, kt, a, active) values"]
    vals = [f"({q(x['id'])}, 'doc', 'doc', {q(json.dumps(x['uz'], ensure_ascii=False))}::jsonb, {q(json.dumps(x['ru'], ensure_ascii=False))}::jsonb, {q(x['dt'])}, null, null, true)" for x in items]
    lines.append(",\n".join(vals))
    lines.append("on conflict (id) do update set pool = excluded.pool, t = excluded.t, uz = excluded.uz, ru = excluded.ru, dt = excluded.dt, active = excluded.active;")
    return "\n".join(lines) + "\n"

def check(items):
    """Mustaqil tekshiruv: har bir hujjatni o'qib, xatolarni qayta topadi va kalit bilan solishtiradi."""
    num = lambda s: int(s.replace(" ", ""))
    bad_n = 0
    for x in items:
        rows = {r["k"]: r["v"] for r in x["uz"]["doc"]["rows"]}
        kind = x["uz"]["kind"]; found = set()
        if kind == "faktura":
            qty = int(rows["qty"].split()[0]); price = num(rows["price"]); s = num(rows["sum"]); v = num(rows["vat"]); t = num(rows["total"])
            if s != qty * price: found.add("sum")
            if v != s * 12 // 100: found.add("vat")
            if t != s + v: found.add("total")
            if rows["rate"] != "12%": found.add("rate")
            if len(rows["s_tin"]) != 9: found.add("s_tin")
            if len(rows["b_tin"]) != 9 or rows["b_tin"] == rows["s_tin"]: found.add("b_tin")
            if len(rows["ikpu"]) != 17: found.add("ikpu")
            fd = rows["no"].split("· ")[1][:10]; cd = rows["no"].split("· ")[2][:10]
            p = lambda z: date(int(z[6:]), int(z[3:5]), int(z[:2]))
            if p(fd) < p(cd): found.add("no")
        elif kind == "kassa":
            s = num(rows["sum"])
            if rows["words"] != uz_words(s): found.add("words")
            why = rows["why"]; exp = next(c[2] for c in CASH if why.startswith(c[0].split(" (")[0].split("{")[0].strip()))
            if not rows["korr"].endswith(exp): found.add("korr")
            if rows["head"] == "—": found.add("head")
            if rows["cashier"] == "—": found.add("cashier")
        elif kind == "salary":
            g = num(rows["gross"]); p_ = num(rows["pit"]); so = num(rows["soc"]); ne = num(rows["net"])
            if p_ != g * 12 // 100: found.add("pit")
            if so != g * 12 // 100: found.add("soc")
            if ne != g - p_: found.add("net")
        elif kind == "proxy":
            p = lambda z: date(int(z[6:]), int(z[3:5]), int(z[:2]))
            if p(rows["valid"]) < p(rows["given"]): found.add("valid")
            if len(rows["pas"].split()[1]) != 7: found.add("pas")
            if rows["head"] == "—": found.add("head")
        key = set(filter(None, x["dt"].split(",")))
        if found != key:
            bad_n += 1; print("MOS EMAS", x["id"], kind, sorted(found), sorted(key), file=sys.stderr)
        # ruscha va o'zbekcha hujjat bir xil qatorlarga ega
        assert [r["k"] for r in x["uz"]["doc"]["rows"]] == [r["k"] for r in x["ru"]["doc"]["rows"]]
        assert set(x["uz"]["fix"]) == key and set(x["ru"]["fix"]) == key
        # raqamlar ruscha va o'zbekcha nusxada bir xil
        for a, b in zip(x["uz"]["doc"]["rows"], x["ru"]["doc"]["rows"]):
            if a["k"] in ("sum", "vat", "total", "price", "gross", "pit", "soc", "net", "s_tin", "b_tin", "ikpu", "pas"): assert a["v"] == b["v"], (x["id"], a, b)
        if kind == "kassa":
            ru = {r["k"]: r["v"] for r in x["ru"]["doc"]["rows"]}
            exp_n = num(rows["sum"]) if "words" not in key else None
            if exp_n is not None: assert ru["words"] == ru_words(exp_n)
    n_clean = sum(1 for x in items if not x["dt"])
    print(f"{len(items)} ta hujjat, toza: {n_clean}, mos kelmagan: {bad_n}", file=sys.stderr)
    return bad_n == 0

if __name__ == "__main__":
    items = build()
    if "--check" in sys.argv:
        # so'z bilan yozish namunalari
        for n in (1_000, 21_000, 101_000, 1_250_000, 12_345_000, 900_005_000):
            print(n, "|", uz_words(n), "|", ru_words(n), file=sys.stderr)
        sys.exit(0 if check(items) else 1)
    sys.stdout.write(sql(items))
