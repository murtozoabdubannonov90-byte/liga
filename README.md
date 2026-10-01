# Hisobchi Liga

Buxgalterlar uchun haftalik musobaqa: har ish kuni yangi bosqich (12 ta provodka + 8 ta qonun, kodeks va hisob savoli), haftalik liga, Telegram bot.

- Ilova: https://murtozoabdubannonov90-byte.github.io/liga/
- Bot: https://t.me/Buxgalterlar_Ligasi_bot
- Baza: Supabase (MijozPro-CRM loyihasi), bot — Edge Function `liga-bot`

## Qoidalar

| | |
|---|---|
| Bosqich | Har ish kuni bittadan, **faqat o'z kunida 09:00–17:00**. 20 savol, har biriga 1 daqiqa, har savolga bir marta javob |
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
- `pay/index.ts` — to'lov qabul qiluvchi (Edge Function `liga-pay`)
- `tests/app.test.py` — brauzer testlari

## Testlar
```
python3 -m http.server 8765 &
python3 tests/app.test.py
```
Tekshiriladi (62 ta): kalit bilan saqlash, viloyat, halol o'yin, 532 savol, yo'nalishlar, haftaning savoli, oylik final, admin (qurilma, hisobot, to'lov havolalari), bosqich ochilish vaqtlari, har javobdan keyin XP saqlanishi, takroriy savol yo'qligi, 450 chegara, 240 noyob savol, blits (20 provodka, taymersiz, ligaga qo'shilmaydi), havola orqali jamoa kodi, jamoaning o'z boshlanish sanasi, 2-mavsum, statistika, chempionlar zali, nishonlar.
