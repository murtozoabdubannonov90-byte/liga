# Hisobchi Liga

Buxgalterlar uchun haftalik musobaqa: har ish kuni yangi bosqich (12 ta provodka + 8 ta qonun, kodeks va hisob savoli), haftalik liga, Telegram bot.

- Ilova: https://murtozoabdubannonov90-byte.github.io/liga/
- Bot: https://t.me/Buxgalterlar_Ligasi_bot
- Baza: Supabase (MijozPro-CRM loyihasi), bot — Edge Function `liga-bot`

## 2.0 versiya (2026-10-02)

Ilova qaytadan yozildi: React + Vite + TypeScript, yangi dizayn ("buxgalteriya daftari + tablo"), animatsiyalar, ovoz va tebranish. Eski ilova zaxira sifatida: `/liga/v1/`.

| Imkoniyat | Qayerda |
|---|---|
| Til tanlash: O'zbekcha, Ўзбекча, Русский | Birinchi ochilishda; keyin Profil → Sozlamalar → Til |
| Natija kartochkasi + taklif havolasi | Reyting → «Natijani ulashish». Taklif qilingan do'st birinchi to'lov qilsa — taklif qilganga **+7 kun** obuna |
| Liga darajalari: Bronza → Kumush → Oltin → Olmos | Reyting → Daraja. Har juma 12:10 da yangilanadi, bot shaxsan xabar beradi |
| Duel 1 ga 1 (10 savol) | Bosh sahifa → Duel → «Duel yaratish va yuborish» |
| Jonli oylik final | Reyting → Final (jadval har 5 soniyada yangilanadi) |
| Ovoz, tebranish, konfetti | Profil → Sozlamalar → Ovoz va tebranish |
| Kunning mini-darsi (60 ta dars) | Bosh sahifa → Bugungi dars; bot ham guruhga 09:00 da yuboradi |
| Balans o'yini | Bosh sahifa → Balans o'yini |
| Savol muharriri (jamoa savollari) | Admin panel → Savollar; superadmin → Umumiy savollar |
| Xodim tanlash testi (ro'yxatsiz havola) | Admin panel → Testlar → «Test yaratish» → havolani nomzodga yuboring |
| QR sertifikat | Profil → Sertifikatlar; tekshiruv: `…/liga/?v=KOD` |
| Shaxsiy eslatma 16:00 | Bot orqali ilovani ochgan o'yinchiga, bugungi bosqich bajarilmagan bo'lsa |
| Android ilova (APK) | GitHub → Releases → **Hisobchi Liga — Android** → `HisobchiLiga.apk` |

### Dasturchi uchun

```
cd app
npm install
npm run dev            # localhost da ishlatish
npm run build          # tekshiruv + yig'ish (app/dist)
npm run deploy         # yig'ib, sayt ildiziga joylash (keyin git commit + push)
python3 tests/app.test.py        # 2.0 testlari (107 ta)
node scripts/i18n-keys.mjs       # rus lug'atida tarjimasiz matn qolmaganini tekshiradi
```

- Matnlar: kalit — o'zbekcha matn (`t("...")`), rus tarjimasi `app/src/lib/ru.ts`, kirill — avtomatik.
- Baza o'zgarishlari: `db/2026-10-02_v2_imkoniyatlar.sql`. Bot: `bot/index.ts` (Edge Function `liga-bot`, v11), `/app` manzili ilova uchun (duel xabari, Telegram ulash, kartochka ulashish — Telegram initData tekshiriladi).
- Android: Capacitor (`app/android`), ilova saytni ochadi — sayt yangilansa ilova ham yangilanadi. APK ni `.github/workflows/android.yml` bepul yig'adi. Imzo kaliti ixtiyoriy: GitHub → Settings → Secrets → Actions → `ANDROID_KEYSTORE_B64` va `ANDROID_KEY_PASS` (bo'lmasa debug imzo — yangi APK ni o'rnatishdan oldin eskisini o'chirish kerak bo'ladi).
- Eski (1.0) ilova testlari: `python3 -m http.server 8765 & python3 tests/app.test.py` (v1/ ni tekshiradi).

## 2026-10-03c: xatodan o'rganish, g'oliblar, sinov davri
- **Javob effekti:** to'g'ri javobda ekran chetlaridan yashil sharlar va yashil belgilar ko'tariladi; xatoda katta qizil X, qizil chet, karta silkinadi va telefon tebranadi (Telegram, brauzer, Android ilova — `@capacitor/haptics`).
- **Misol bilan tushuntirish:** xato javobdan keyin «Misol bilan tushuntirish» — provodka ikki T-hisobda summa bilan (savoldagi summa yoki 1 000 000), hisobvaraq turi, ko'paydi/kamaydi, qoida, sizning javobingiz tahlili; hisoblashda farq va ehtimoliy sabab (QQS, 12 oy).
- **Xatolar ustida ishlash** (Asosiy → «Xato daftari»): oxirgi 5 xato misol bilan → mashq: shu savollar chalg'ituvchilar orasida → teskari savol (provodkadan muomalani, javobdan savolni topish). Ikkalasi to'g'ri bo'lsa xato daftardan o'chadi. Bosqich savollari ham (javobi ochilgandan keyin) daftarga yoziladi.
- **Kunlik kuchli uchlik:** bosqich bali bo'yicha (teng — tezroq). Keyingi ish kuni har savolga 🥇 +10, 🥈 +7, 🥉 +4 soniya (serverda hisoblanadi). Mukofot bosqich boshida va oxirida ko'rinadi; bot guruhga va g'oliblarga shaxsan yozadi (17:00, juma 12:00).
- **Imtiyozlaringiz** (bosh sahifa): bugungi qo'shimcha soniya, o'tgan hafta medali va sertifikat, «Haftaning savoli», oylik final. Reytingda — kunlik kuchli uchlik.
- **Sinov rejimi:** yoqilgan — hamma bepul, to'lov ekrani chiqmaydi. O'chirish: Profil → Superadmin → «Karta» → «Sinov rejimini o'chirish».
- Baza: `db/2026-10-03c_kunlik_golib.sql`. Bot: v14. Testlar: 107 ta.

## 2026-10-03b: javoblar faqat serverda

- **Liga savollari serverda** (`liga_bank`, 480 ta yangi savol, har bosqichga 40 ta). Ilovaga savol javobsiz yuboriladi; har javob serverda tekshiriladi, vaqt (60 s) serverda o'lchanadi, ball va yulduzlarni server hisoblaydi (`liga_stage_start`, `liga_run_show`, `liga_run_answer`, `liga_run_finish`). `liga_save` endi bosqich ballarini qabul qilmaydi.
- **Har o'yinchiga boshqa savollar**: bosqichda 40 tadan 20 tasi (12 provodka + 8) tasodifiy tanlanadi — guruhda javob ulashish foydasiz.
- **Final, duel, xodim testi** ham serverda tekshiriladi (`liga_final_start`, `liga_duel_start`, `liga_test_begin`); eski mijozga ishongan funksiyalar yopildi.
- **Telegram orqali kirish**: Telegram ichida hisob Telegram ID bo'yicha avtomatik topiladi (telefon va kompyuter birga); brauzer/Android'da «Kirish» → bot → avtomatik kirish. Bir nechta qurilma (`liga_tokens`).
- **Cheklarga kunlik cheklov yo'q** (1–6 oy).
- **Yangi**: soliq taqvimi (bot 3 va 1 kun oldin eslatadi; superadmin tahrirlaydi), qonun yangiliklari (+ qisqa test, guruhga avtomatik), kalkulyatorlar (ish haqi, QQS, amortizatsiya), Didox/my.soliq/1C amaliy mavzusi (36 savol), jamoalar bellashuvi (dushanba juftlash, juma natija), xodim testi uchun PDF hisobot (ko'nikma va mavzular bo'yicha).
- Savollar manbasi shifrlangan holda `content/bank.asc` da (kalit faqat serverda va egasida). Ochiq repoda javoblar yo'q.
- Baza: `db/2026-10-03b_server_savollar.sql`. Bot: v13. Testlar: 85 ta.

## 2026-10-03 yangilanishi

- **Juma** bosqichi 12:00 da yopiladi (ilova, bot, server). Yangi hafta faqat shanbadan boshlab bosqich qabul qiladi.
- **Bot har o'yinchiga shaxsan yozadi** (Telegram ulangan bo'lsa): 09:00 — bugungi bosqich; bosqich tugashi bilan — natija (to'g'ri javoblar, bosqich bali, haftalik jami); 16:00 (juma 11:00) — bajarmaganlarga eslatma; juma 12:00 — jamoadagi o'rni.
- **Telegram ulash**: to'lov havolasi yoki kontakt yuborilganda avtomatik; ilovada «Natijangiz Telegram'ga kelsin» kartasi (bot `/start link_KOD`).
- **Guruhlar uchun**: 09:00 da Telegram quiz-so'rovnoma «Kunning savoli» (`public/polls.json`, `npm run build` yasaydi); 16:00/17:00 xabarlarida «jamoadan N kishi o'ynadi».
- **Himoya**: server shu hafta ballarini va jami XP ni kamaytirmaydi (telefon almashsa ham yo'qolmaydi, ilova serverdagisini qaytarib oladi); ilova ochiq turganda juma 12:00 o'tsa hafta yangilanadi; chek 1–6 oy, bot orqali ham kuniga 5 tadan ko'p emas; 3 soniyagacha chiqib qaytish kechiriladi (qo'ng'iroq); vaqt hamma joyda Toshkent bo'yicha.
- Baza: `db/2026-10-03_juma_shaxsiy.sql`. Bot: v12. Testlar: 61 ta.

## Qoidalar

| | |
|---|---|
| Bosqich | Har ish kuni bittadan, **faqat o'z kunida 09:00–17:00, juma 09:00–12:00** (liga juma 12:00 da tugaydi). 20 savol, har biriga 1 daqiqa, har savolga bir marta javob |
| Liga bali | Faqat bosqichlardan. Har bir bosqichdan ko'pi bilan **450 XP** (20 × 18 + 3 yulduz × 30). Jami = bosqichlar yig'indisi |
| Kunlik mashq, blits, sovg'a, yutuqlar | Jami XP ga qo'shiladi, ligaga emas |
| Blits | 20 ta provodka, vaqt cheklovi yo'q, rekord — 20 dan nechta to'g'ri |
| Hafta | Dushanba — juma 12:00. Hafta davomida natija faqat o'ziga ko'rinadi, juma 12:00 da jadval hammaga |
| Mavsum | 12 bosqichdan keyin bosqichlar yangidan boshlanadi (2-mavsum, 3-mavsum…) |
| Kuchli uchlik | 👑🥈🥉 nishon (bir hafta), chempionlar zalida nomi, haftalik g'olib sertifikati (chop etish/PDF) |
| Oylik chempionat | Oy davomida 2 marta kuchli uchlikka kirganlar (kam bo'lsa — oylik bali bo'yicha top-3) oyning **oxirgi shanbasi 10:00–13:00** finalda: 20 savol, har biri 1 daqiqa, teng ballda tezroq yutadi. 2026: 31.10, 28.11, 26.12 |
| Viloyat ligasi | Har jamoaning eng yaxshi 3 nafari bali qo'shiladi, viloyat ichida solishtiriladi (o'tgan hafta) |
| Haftaning savoli | Hafta g'olibi savol taklif qiladi → admin tasdiqlaydi → jamoaga muallif ismi bilan chiqadi (+50 XP, ligaga emas) |
| Yo'nalishlar | 292 ta mavzu savoli: QQS, Ish haqi, Asosiy vositalar, Zaxiralar, Soliqlar, MHXS, Provodka. Jami baza **532 savol** |
| Halol o'yin | Bosqich va finalda savol ochiq turganda ilovadan chiqilsa — savol xato. Matnni nusxalab bo'lmaydi, ekranda ism va raqam oxiri yozilgan. Vaqt cheklovlari o'zgarmagan |

## Jamoalar (sotish uchun)

Har bir sotib olgan guruh — alohida **jamoa**: o'z kodi (`BX12AB`), admin PIN, obuna muddati, boshlanish sanasi (keyingi dushanba). Jamoalar bir-birining natijasini ko'rmaydi. Ishtirokchilar soni cheklanmagan (xohlasa jamoaga chegara qo'yiladi).

### Superadmin (sotuvchi)
1. Ilova → **Profil** → **🛡️ Admin kirish** → superadmin PIN.
2. **➕ Jamoa yaratish**: nom, viloyat, obuna (30 / 90 kun, «To'lov kutilmoqda» yoki muddatsiz), chegarasi. Sinov muddati yo'q — jamoa keyingi dushanbadan boshlanadi.
3. Kod, admin PIN va taklif havolasi avtomatik nusxalanadi — xaridorga yuboring.
4. Ro'yxatda: **+30 kun** (to'lov qilinganda), **To'xtatish/Yoqish**.

Superadmin PIN bazada: `select value from liga_bot_config where key='super_pin';`

### Jamoa admini (xaridor)
1. Ilova → **Profil** → **🛡️ Admin kirish** → jamoa PIN.
2. Admin panelda: taklif havolalari, obuna muddati, a'zolar (bali, viloyati, aniqlik foizi), **📱 Qurilmani almashtirish** (xodim yangi telefonga o'tsa), o'chirish.
   - **📄 Oylik hisobot** — har xodimning haftalik ballari, top-3 soni, aniqlik, final natijasi; **PDF saqlash / chop etish**.
   - **💳 Obuna to'lovi** — muddatni tanlab **Hisob yaratish** → Payme yoki Click orqali to'lash. Narx: har ishtirokchi uchun oyiga 30 000 so'm. To'lov tushishi bilan obuna avtomatik uzayadi.
   - **❓ Haftaning savoli** — g'olib taklifini **✅ Tasdiqlash** yoki **Rad etish**.
3. Telegram guruhiga botni qo'shib, guruhda `/ulash KOD` yozadi — bosqich xabarlari va juma natijalari shu guruhga chiqadi.

### Ishtirokchi
Taklif havolasini bosadi (`t.me/Buxgalterlar_Ligasi_bot?start=g_KOD` yoki `…/liga/?g=KOD`) — ro'yxatdan o'tishda jamoa kodi o'zi qo'yiladi.
Obuna tugasa, bosqichlar yopiladi va ilovada ogohlantirish chiqadi.

## Shaxsiy obuna (asosiy liga)
- Narx: har bir ishtirokchi uchun oyiga 30 000 so'm (`liga_bot_config.price_per_member`).
- Tartib: ro'yxatdan o'tadi → «Ligaga qo'shilish» oynasi → kartaga pul o'tkazadi → **🤖 Chekni botga yuborish** (yoki ilovada yuklaydi) → bot tekshiradi va darhol ligaga qo'shadi.
- Bot tekshiruvi: rasm ekanini, hajmini va chek avval yuborilmaganini (takroriy chek qabul qilinmaydi). Pul kartaga tushganini admin tekshiradi.
- Chek darhol adminning Telegramiga keladi: **✅ Tasdiqlash** / **❌ Rad etish** (rad etilsa obuna bekor, ishtirokchiga xabar boradi). Ulash: admin panel → **🔔 Cheklarni Telegramda olish** → botda **Start**.
- Botga to'g'ridan-to'g'ri yozganlar: **/tolov** → telefon raqamini yuboradi → karta va chek.
- To'lanmaguncha bosqichlar yopiq (kunlik mashq va blits ochiq), server ham bosqich ballarini yozmaydi.
- Admin panel → **🧾 To'lov cheklari**: chekni ko'rish, **✅ Tasdiqlash** yoki **Rad etish** (rad etilsa obuna bekor bo'ladi). Naqd to'laganlarga — **💳 +1 oy (naqd)**.
- Karta raqami: Superadmin → **💳 To'lov kartasi** → **Saqlash**.
- 01.10.2026 gacha ro'yxatdan o'tganlar 04.10.2026 gacha bepul, keyin to'lov bilan.
- Jamoa kodi bilan kirganlarga jamoa obunasi amal qiladi.

## Xavfsizlik
- Barcha ma'lumot Supabase bazasida, faqat tekshiruvli funksiyalar orqali (jadvallarga to'g'ridan-to'g'ri kirish yopiq).
- Har ishtirokchining maxfiy kaliti faqat o'z telefonida — natijani boshqa birov yoza olmaydi. Bitta raqam bitta telefonda; yangi telefonga o'tishni admin tasdiqlaydi.
- Server o'zi tekshiradi: faqat shu haftaning ochilgan bosqichlari, har biri ≤ 450 XP.
- Telefon raqamlar faqat jamoa adminiga ko'rinadi. Jamoalar bir-birining ro'yxatini ko'rmaydi.
- PIN: 10 daqiqada 15 ta noto'g'ri urinishdan keyin bloklanadi.
- To'lov kalitlari (PAYME_KEY, CLICK_SECRET) va bot tokeni faqat Supabase Secrets'da.

## To'lovlarni ulash (bir marta)
1. Payme Business (business.payme.uz) yoki Click (merchant.click.uz) da YaTT/MCHJ sifatida kassa oching.
2. Payme kassa sozlamasi: **Endpoint URL** = `https://bopzjxboembvcqycfwin.supabase.co/functions/v1/liga-pay/payme`, hisob maydoni nomi = `invoice_id`.
   Click: **Prepare URL** = `.../liga-pay/click/prepare`, **Complete URL** = `.../liga-pay/click/complete`.
3. Supabase → **Edge Functions** → **Secrets** → **Add new secret**: `PAYME_KEY` (kassa kaliti), `CLICK_SECRET` (secret key).
4. SQL: `update liga_bot_config set value='MERCHANT_ID' where key='payme_merchant_id';` (Click uchun `click_service_id`, `click_merchant_id`).
Shundan keyin admin panelda Payme/Click tugmalari chiqadi.

## Bot jadvali (Toshkent vaqti, dushanba–juma)
09:00 — bosqich ochildi · 16:00 — 1 soat qoldi · 17:00 — o'yin tugadi · juma 11:00 — liga tugashiga 1 soat · juma 12:01 — natijalar (har jamoaga o'zinikini).

## Fayllar
- `index.html` — butun ilova (savollar `STAGES` ichida)
- `bot/index.ts` — Telegram bot
- `db/2026-10-01_jamoalar.sql` — jamoalar uchun baza o'zgarishlari
- `db/2026-10-01b_xavfsizlik_musobaqalar.sql` — himoya, viloyat, final, haftaning savoli, hisobot, to'lovlar
- `db/2026-10-01c_eskilarni_ochirish.sql` — eski ochiq funksiyalarni o'chirish
- `db/2026-10-01e_bot_chek.sql` — bot orqali chek, adminga Telegram xabari
- `db/2026-10-01d_shaxsiy_tolov.sql` — shaxsiy obuna, chek orqali to'lov
- `pay/index.ts` — to'lov qabul qiluvchi (Edge Function `liga-pay`)
- `tests/app.test.py` — brauzer testlari

## Testlar
```
python3 -m http.server 8765 &
python3 tests/app.test.py
```
Tekshiriladi (62 ta): kalit bilan saqlash, viloyat, halol o'yin, 532 savol, yo'nalishlar, haftaning savoli, oylik final, admin (qurilma, hisobot, to'lov havolalari), bosqich ochilish vaqtlari, har javobdan keyin XP saqlanishi, takroriy savol yo'qligi, 450 chegara, 240 noyob savol, blits (20 provodka, taymersiz, ligaga qo'shilmaydi), havola orqali jamoa kodi, jamoaning o'z boshlanish sanasi, 2-mavsum, statistika, chempionlar zali, nishonlar.
