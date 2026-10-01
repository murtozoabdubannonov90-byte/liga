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

## Jamoalar (sotish uchun)

Har bir sotib olgan guruh — alohida **jamoa**: o'z kodi (`BX12AB`), admin PIN, obuna muddati, boshlanish sanasi (keyingi dushanba). Jamoalar bir-birining natijasini ko'rmaydi. Ishtirokchilar soni cheklanmagan (xohlasa jamoaga chegara qo'yiladi).

### Superadmin (sotuvchi)
1. Ilova → **Profil** → **🛡️ Admin kirish** → superadmin PIN.
2. **➕ Jamoa yaratish**: nom, obuna kuni (14 = sinov, 0 = muddatsiz), chegarasi.
3. Kod, admin PIN va taklif havolasi avtomatik nusxalanadi — xaridorga yuboring.
4. Ro'yxatda: **+30 kun** (to'lov qilinganda), **To'xtatish/Yoqish**.

Superadmin PIN bazada: `select value from liga_bot_config where key='super_pin';`

### Jamoa admini (xaridor)
1. Ilova → **Profil** → **🛡️ Admin kirish** → jamoa PIN.
2. Admin panelda: taklif havolalari (bot va ilova), obuna muddati, barcha a'zolar va ularning bali, o'chirish.
3. Telegram guruhiga botni qo'shib, guruhda `/ulash KOD` yozadi — bosqich xabarlari va juma natijalari shu guruhga chiqadi.

### Ishtirokchi
Taklif havolasini bosadi (`t.me/Buxgalterlar_Ligasi_bot?start=g_KOD` yoki `…/liga/?g=KOD`) — ro'yxatdan o'tishda jamoa kodi o'zi qo'yiladi.
Obuna tugasa, bosqichlar yopiladi va ilovada ogohlantirish chiqadi.

## Bot jadvali (Toshkent vaqti, dushanba–juma)
09:00 — bosqich ochildi · 16:00 — 1 soat qoldi · 17:00 — o'yin tugadi · juma 11:00 — liga tugashiga 1 soat · juma 12:01 — natijalar (har jamoaga o'zinikini).

## Fayllar
- `index.html` — butun ilova (savollar `STAGES` ichida)
- `bot/index.ts` — Telegram bot
- `db/2026-10-01_jamoalar.sql` — jamoalar uchun baza o'zgarishlari
- `tests/app.test.py` — brauzer testlari

## Testlar
```
python3 -m http.server 8765 &
python3 tests/app.test.py
```
Tekshiriladi: bosqich ochilish vaqtlari, har javobdan keyin XP saqlanishi, takroriy savol yo'qligi, 450 chegara, 240 noyob savol, blits (20 provodka, taymersiz, ligaga qo'shilmaydi), havola orqali jamoa kodi, jamoaning o'z boshlanish sanasi, 2-mavsum, statistika, chempionlar zali, nishonlar.
