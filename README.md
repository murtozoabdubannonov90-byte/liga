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
| Mashq zali: 3 ta tezkor o'yin, vazifalar, yutuqlar, oylik sovrin jamg'armasi | Bosh sahifa → Mashq zali |
| Android ilova (APK) | GitHub → Releases → **Hisobchi Liga — Android** → `HisobchiLiga.apk` |

### Dasturchi uchun

```
cd app
npm install
npm run dev            # localhost da ishlatish
npm run build          # tekshiruv + yig'ish (app/dist)
npm run deploy         # yig'ib, sayt ildiziga joylash (keyin git commit + push)
python3 tests/app.test.py        # 2.0 testlari (266 ta)
node scripts/i18n-keys.mjs       # rus lug'atida tarjimasiz matn qolmaganini tekshiradi
```

- Matnlar: kalit — o'zbekcha matn (`t("...")`), rus tarjimasi `app/src/lib/ru.ts`, kirill — avtomatik.
- Baza o'zgarishlari: `db/2026-10-02_v2_imkoniyatlar.sql`. Bot: `bot/index.ts` (Edge Function `liga-bot`, v11), `/app` manzili ilova uchun (duel xabari, Telegram ulash, kartochka ulashish — Telegram initData tekshiriladi).
- Android: Capacitor (`app/android`), ilova saytni ochadi — sayt yangilansa ilova ham yangilanadi. APK ni `.github/workflows/android.yml` bepul yig'adi. Imzo kaliti ixtiyoriy: GitHub → Settings → Secrets → Actions → `ANDROID_KEYSTORE_B64` va `ANDROID_KEY_PASS` (bo'lmasa debug imzo — yangi APK ni o'rnatishdan oldin eskisini o'chirish kerak bo'ladi).
- Eski (1.0) ilova testlari: `python3 -m http.server 8765 & python3 tests/app.test.py` (v1/ ni tekshiradi).

## 2026-10-23: Liga — har ish kuni 09:00–18:00
- Bosqich har ish kuni 09:00–18:00 (avval 17:00), liga juma **18:00** da yakunlanadi (natijalar, darajalar 18:01/18:10). Kubok finali 17:00 da qoladi.
- Server: `liga_close_hour` = 18; `liga_cur_week_id`/`liga_last_week_id` — almashish 13:00 UTC, identifikator yozuvi o'zgarmagan ("juma T07:00"). Ilova: `CLOSE_H`/`FRI_CLOSE_H` = 18, `weekId` = weekEnd − 6 soat.
- Cron (UTC): liga-eslatma 12:00, liga-kun-oxiri 13:00, liga-juma-11 12:00 (juma), liga-tugadi 13:01, liga-darajalar 13:10. SMS eslatma 16:00–17:30.
- SQL: `db/2026-10-22e_liga_18_00.sql` (22.10 soat 17:00 dan keyin qo'llandi, bugungi bosqich 17:00 da yopildi).

## 2026-10-22d: Sovrinli musobaqa — guruhga 3 marta, shaxsan 2 marta e'lon
- Guruhga kuniga 3 marta — 10:00 («💥 BOOM YANGILIK»), 12:00 («🔥 Diqqat, buxgalterlar»), 15:00 («⏰ Oxirgi N soat»): jamg'arma, peshqadamlar, «🚀 Musobaqaga qo'shilish» tugmasi (`?start=px`); slotda 1 marta (cron `liga-musobaqa-2soat`, bot `px_promo`).
- Shaxsan kuniga 2 marta — 10:00 va 15:00 (`PX_DM_SLOTS`, `liga_px_promo_list_sys`): to'lov qilmaganlarga taklif, to'lab bugun o'ynab bo'lmaganlarga eslatma; chek tekshirilayotgan va bugun o'ynab bo'lganlarga yuborilmaydi. Har daqiqada 80 tadan, takrorlanmaydi (`px_promo_last_<kun>_<soat>`). Qo'lda: `select liga_bot_call('px_promo_now')`.
- SQL: `db/2026-10-22d_musobaqa_har_2_soat.sql`.

## 2026-10-22c: Sovrinli musobaqa — ishtirokchilar soni (faqat egasiga)
- Musobaqa sahifasining yuqorisida faqat egasiga (`free_phones` dagi telefon) ko'rinadigan qator: to'lagan, chek kutmoqda, bugun o'ynadi, oyda o'ynagan (har daqiqada yangilanadi). Boshqalarga `liga_px_owner` null qaytaradi — hech narsa ko'rinmaydi.
- SQL: `db/2026-10-22c_musobaqa_ishtirokchilar_soni.sql`.

## 2026-10-22: Sovrinli musobaqa — kuniga 1 marta, davom ettirish, qiyinroq savollar
- Har bir ishtirokchiga kuniga 1 ta o'yin (`kind='mix'`): 20 ta aralash savol (12 provodka, 5 schyot, 3 balans bo'limi), har biriga 40 soniya. 20 ta savol tugagach — ertagacha yopiq (`px_done_today`).
- Adashib chiqib ketsa qaytib kirib davom ettiradi (`liga_px_start` bugungi sessiyani qaytaradi); qayta kirilganda yoki ilovadan chiqilganda o'sha savol xato hisoblanadi (`liga_px_skip`, `{away:true}`) — AI'dan so'rab qaytishning oldini oladi. «Orqaga» o'yinni tugatmaydi.
- Savollar: +78 ta qiyin provodka (`db/2026-10-22_px_bank_hard.sql`, `scripts/px_bank_hard.py`), provodkada 10 ta variant (chalg'ituvchilar to'g'ri javob guruhidan). O'yinchiga 7 kun ichida ko'rgan savoli chiqmaydi (provodka ~417, schyot 106, balans 48; haftada 84/35/21 kerak).
- To'lov: faqat Murtozo bepul (free_phones), qolganlar 30 000 so'm to'lab chek yuboradi.
- SQL: `db/2026-10-22b_musobaqa_kuniga_bir.sql`.

## 2026-10-21h: Sovrinli musobaqa — alohida to'lov, 20 savol, takrorlanmaydigan savollar, takliflar
- To'lov liga obunasidan alohida: `liga_px_pay` (30 000 so'm, `px_price`). Chek ilovada («Musobaqaga qo'shilish» sahifasi, `pxPay`) yoki botda (`/musobaqa`, `/start px`, «💳 Musobaqaga qo'shilish» tugmasi) yuboriladi; administratorga rasm + «✅ Pul tushdi / ❌ Soxta» (`rp:`) keladi, tasdiqlangach musobaqa ochiladi va o'yinchiga xabar boradi. `liga_px_paid` = shu oy tasdiqlangan to'lov (yoki free_phones).
- O'yinda 20 ta savol (`px_q_n`), har savolga 40 soniya; 18:00 da o'yin yopiladi.
- Savollar o'yinchiga takrorlanmaydi: `liga_px_seen` tarixi — avval ko'rmaganlari, hammasi tugasa eng eskisi. Provodka: 144 + o'tgan kunlik savollar; schyot: har biri 2 xil (raqam→nom, nom→raqam).
- Qo'shilmaganlarga taklif 22.10 08:00 va 08:30 (`px_invite_a/b`, cron liga-musobaqa-taklif-1/2); 09:05 dagi «boshlandi» xabari faqat to'lov qilganlarga.
- Bosh sahifa kartasida reklama: sovrinlar va «Qo'shilish». Bot havolasi `?go=px` musobaqani ochadi.
- SQL: `db/2026-10-21h_musobaqa_tolov.sql`.

## 2026-10-21g: Sovrinli musobaqa — qoidalar
- Ballar 22.10.2026 09:00 dan hisoblanadi (`px_start_at`); oldingi ballar reytingga kirmaydi. Ballar liga/umumiy ballga qo'shilmaydi.
- Faqat to'lov qilganlar (`liga_px_paid`: paid_until ≥ bugun yoki free_phones) o'ynay oladi; ochiq vaqt 09:00–18:00 (`px_open_from/to`).
- Har o'yinda 10 ta savol (`px_q_n`), har savolga 40 soniya (`px_q_secs`; o'yin jami `px_secs`=400), vaqt o'tsa — xato. Savollar qiyinroq: provodkada 8 variant (yarmi o'tgan kunlik savollardan), schyotda 6 ta bir guruhdan.
- Faqat telefonda: ilova va server `p_platform` ni tekshiradi (android/ios/mobile_web). AI/botga qarshi: avtomat brauzer bloklanadi, nusxa olish yopiq, boshqa oynaga 1,5 soniyadan ko'p chiqilsa o'yin tugaydi, juda tez (<0,35 s) javob — xato.
- Ichida «tugashiga N kun qoldi» kartasi. Bot 22.10 09:05 dan hammaga qoidalarni yuboradi.
- SQL: `db/2026-10-21g_musobaqa_qoidalar.sql`.

## 2026-10-21f: Sovrinli musobaqa — faqat savollar
- Sahifada faqat **Savollar** (3 ta o'yin) va **Reyting**; «Vazifalar» va «Yutuqlar» olib tashlandi.
- Ball faqat savollar uchun: to'g'ri javob 10 + seriya bonusi (+2 … +10), xato — 0. Vazifa bonuslari reytingga qo'shilmaydi (oldingi 74 ta yozuv, 2 750 ball, hisobdan chiqarildi). Tekshiruv: 489 ta o'yinda ball/to'g'ri javob/seriya mos — xato yo'q.
- Ligaga kirish — oyiga 30 000 so'm (sahifada va e'londa yozilgan). E'lon va 18:30 reyting xabari — faqat o'zbekcha.
- Baza: `db/2026-10-21f_musobaqa_faqat_savollar.sql`.

## 2026-10-21e: «Mashq zali» → «Sovrinli musobaqa», jamg'arma 300 000 so'm
- Nomi hamma joyda (ilova, bot, ruscha — «Призовой турнир») «Sovrinli musobaqa».
- Oktabr jamg'armasi qat'iy **300 000 so'm** (`px_fund_base=300000`, `px_fund_per_pay=0`): 🥇 150 000 · 🥈 90 000 · 🥉 60 000; g'oliblar 31-oktabr yakunida (obunasi faol kuchli uchlik).
- 22.10.2026 09:05–09:20 da Telegram'ga ulangan har bir ishtirokchiga shaxsiy e'lon (har daqiqa 80 tadan, takrorlanmaydi): cron `liga-musobaqa-elon`, kun — `liga_bot_config.px_announce_day`. Qo'lda: `select liga_bot_call2('px_announce_now','{}')`.
- Baza: `db/2026-10-21e_sovrinli_musobaqa.sql`.

## 2026-10-21b: kubok — hamma o'ynaydi, g'oliblar ochko bo'yicha (saralashsiz o'tish bekor)
- Saralashsiz o'tish yo'q: 1-raundda hamma o'ynaydi. Har raundda faqat g'oliblar o'tadi — yutqazgan hech qachon qaytmaydi.
- G'oliblar soni 2 ning darajasi bo'lmasa (290 → 145), keyingi bosqichga ochkosi eng ko'p P ta g'olib o'tadi (145 → 128; teng ochkoda — tezroq). Qolganlar «ochko bo'yicha chiqib qoldi» (`liga_day_cut`): bot shaxsan va guruhdagi raund natijasida aytadi, ilovada ham ko'rinadi. Keyingi raundlarda soni doim juft: 128 → 64 → … → final 17:00.
- Ishtirokchilar soni toq bo'lsa — eng oxirgi qo'shilgan bugun kubokda emas («ertadan»), 1-raundda juftsiz odam qolmasligi uchun.
- Baza: `db/2026-10-21b_kubok_hamma_ochko.sql` (2026-10-21 saralash tartibini almashtiradi).

## 2026-10-21: Mashq zali (ligadan alohida, sovrin jamg'armasi bilan)
Kunlik bosqichlar, liga bali, duellar va kubokka **ta'sir qilmaydi**: alohida jadvallar (`liga_px_*`), alohida ball va reyting; mavjud funksiyalar o'zgartirilmagan.
- **Qayerda:** Asosiy → «Mashq zali» kartasi (jamg'arma va o'rningiz) → bo'limlar: O'yinlar · Vazifalar · Yutuqlar · Reyting.
- **3 ta o'yin, har biri 60 soniya** (savol va javob faqat serverda tekshiriladi, vaqt serverda o'lchanadi):
  - *Debet ↔ Kredit* — muomala → Dt va Kt (144 ta provodka, ikkinchi tugma bosilishi bilan javob ketadi);
  - *Schyotlar rejasi* — raqam → nom yoki nom → raqam (53 ta hisobvaraq; chalg'ituvchilar shu guruhdan);
  - *Balans bo'limi* — Aktiv / Majburiyat / Kapital / Daromad / Xarajat.
- **Ball:** to'g'ri javob 10 + seriya bonusi (+2 … +10), xato — 0 va seriya yo'qoladi. 0,35 soniyadan tez javob — xato (skriptga qarshi). O'yin paytida 3 soniyadan ko'p boshqa ilova/oynaga o'tilsa — o'yin yakunlanadi (to'plangan ball saqlanadi). Ekranda ism suv belgisi.
- **Kunlik vazifalar:** 3 ta o'yin (+30), bitta o'yinda 10 ta to'g'ri (+40), uchala o'yin turi (+50), 7 ta ketma-ket (+30) — oylik reytingga qo'shiladi.
- **12 ta yutuq (nishon):** birinchi o'yin, 10/50 o'yin, 100/1000 to'g'ri, snayper (20 to'g'ri), xatosiz, 10 seriya, 3/7 kun ketma-ket, uch yo'nalish ustasi, oy kuchli uchligi.
- **Reyting:** oy / hafta / bugun (o'z jamoasi ichida), o'tgan oylar g'oliblari.
- **Sovrin jamg'armasi (asosiy liga):** `px_fund_base` + `px_fund_per_pay` (standart **5 000 so'm**) × shu oyda tasdiqlangan shaxsiy to'lovlar (oylar soni bilan). Taqsimot `px_split` = 50/30/20 %. Oy tugagach (har kuni 00:10 da cron `liga-mashq-oy` tekshiradi) **obunasi faol** eng yaxshi 3 kishi `liga_px_win` ga yoziladi. Obunasizlar o'ynaydi va reytingda ko'rinadi («obunasiz» belgisi), lekin sovrin olmaydi — ularga «Obuna bo'lish» tugmasi chiqadi.
- **Superadmin → «Mashq»:** joriy jamg'arma, top-10, sozlamalar (to'lovdan ulush, boshlang'ich summa, taqsimot, o'yin vaqti, yoqish/o'chirish), g'oliblar telefoni va «berildi/berilmagan» belgisi.
- **Bot:** ish kunlari **18:30** da (bosqichlar yopilgandan keyin) guruh va kanalga jamg'arma va top-5 e'loni (cron `liga-mashq-elon`, qo'lda: `select liga_bot_call('px_board_now')`).
- Baza: `db/2026-10-21_mashq_zali.sql`, savollar `db/2026-10-21b_mashq_savollar.sql` (qayta yasash: `python3 app/scripts/px-seed.py`), e'lon `db/2026-10-21c_mashq_elon.sql`. Ilova: `app/src/screens/Px.tsx`, `app/src/engine/px.ts`. Testlar: 266 ta.

## 2026-10-21: kubok — saralash raundi, «eng yaxshi yutqazgan» bekor; guruhda pin faqat adminlarga
- Yutqazgan endi hech qachon keyingi raundga qaytmaydi. Ishtirokchilar soni n, P — n dan oshmaydigan eng katta 2 ning darajasi. n > P bo'lsa 1-raund — **saralash**: (n − P) ta duel; oxirgi 7 kundagi bosqich bali eng yuqori (2P − n) kishi saralashsiz 2-raundga o'tadi. 2-raunddan boshlab soni P, P/2 … — toq bo'lmaydi. Masalan 290 → saralash 34 duel, 222 kishi to'g'ridan-to'g'ri → 256 → 128 → … → final 17:00.
- Toq sonda oxirgi qo'shilganni chetlatish endi yo'q — hamma qatnashadi.
- Muhokama guruhida oddiy a'zolar xabar qadamaydi (`setChatPermissions`, `can_pin_messages: false`); bot har ish kuni 09:00 da tekshirib qo'yadi. Qo'lda: bot amali `discuss_perms`.
- Baza: `db/2026-10-21_kubok_saralash.sql`.

## 2026-10-20b: bo'sh ekran, javobsiz xato, limitlar, ijtimoiy soliq 6520
- **Bo'sh ekran / ochilmaslik:** Telegram skripti endi sahifani to'xtatib turmaydi (Telegram ichida 6 s gacha kutiladi, brauzerda kutilmaydi); server so'rovlariga vaqt chegarasi (20 s); Telegram orqali kirish 10 s da javob bermasa ilova baribir ochiladi; eski telefonlar (Android 6–9 WebView, iOS 11–13) uchun alohida ES5 to'plam (`@vitejs/plugin-legacy`); service worker: sahifa 5 s da kelmasa — keshdagisi, oldingi 3 ta versiya fayllari serverda saqlanadi (`assets/builds.json`); yuklanish ekrani va 15 s nazorat — ochilmasa «Qayta yuklash» (kesh tozalanadi); ekranda xato bo'lsa — oq ekran o'rniga xabar (`Boundary`); savol/dars topilmasa — xabar va «Bosh sahifa».
- **Qurilma xatolari jurnali:** `liga_client_err` jadvali — qaysi telefonda nima buzilganini ko'rish uchun (`select * from liga_client_err order by at desc`).
- **Javob bermasa ham xato:** halol o'yin chegarasi 1,5 s → 3 s; bosqichdagi birinchi uzoq chiqish faqat ogohlantirish, keyingilari xato.
- **Kunlik limitlar olib tashlandi:** bosqich va mashqlarda 5 ta jon (5 xatodan keyin to'xtash) yo'q; duel/jonli duel kuniga 20/30 cheklovi yo'q (faqat 2 daqiqada 15 tadan ko'p — spam himoyasi).
- **Ijtimoiy soliq — 6520** (buxgalter.uz, «Проводки по зарплате»: Дт затрат — Кт 6520; to'lov Дт 6520 — Кт 5110). Bazada 18 ta, ilovada 4 ta savol, 2 ta dars, kalkulyator izohi tuzatildi; 6520 hisobvaraqlar ro'yxatiga qo'shildi. «JShDS va ijtimoiy soliq birga to'landi» savollari faqat JShDS ga o'zgartirildi. Tuzatish skripti: `app/scripts/fix_6520.py`.
- Baza: `db/2026-10-20b_limitlar_xatolar_6520.sql`. Testlar: 230 ta.

## 2026-10-20: Telegram niki yo'qlardan nik so'rash
- Bot Telegram niki (username) yo'q ishtirokchilarga shaxsan yozadi: nik nima uchun kerak (kubok duelida raqib yozishi uchun), qanday qo'yiladi (Sozlamalar → Foydalanuvchi nomi) va «✅ Nik qo'ydim — tekshirish» tugmasi. Tugma bosilganda bot nikni darhol tekshiradi va saqlaydi.
- Ish kunlari 13:00 da (cron `liga-nik`), bir odamga ko'pi bilan 4 marta, kamida 2 kun oraliq bilan; yuborishdan oldin nik qo'yilgan-qo'yilmaganini tekshiradi. Qo'lda: bot amali `nick_ask_now`.
- 20:00 kunlik hisobotda: niki yo'qlar soni, so'ralganlar, so'ralgach qo'yganlar.
- Baza: `db/2026-10-20_nik_sorash.sql`.

## 2026-10-19: ball xatosi, kurs 12:00 da, ma'lumotnoma har hafta, kirmaganlar
- **Xato tuzatildi:** juma 17:00 dan keyin ilovani ochganlarda o'tgan haftaning bosqich bali yangi haftada qolib ketardi (24 kishi). Endi yangi hafta 0 dan boshlanadi; o'tgan hafta natijalari buzilmagan.
- **Valyuta kursi** — har kuni 12:00 da (cbu.uz javob bermasa 12:20, 12:40 da qayta). Kartada: «Yangilandi: bugun 12:00 · har kuni 12:00 da».
- **Buxgalter ma'lumotnomasi** bazada (`liga_info`), sarlavhada «Yangilandi: sana». Har dushanba avtomatik tekshiriladi (scheduled task): yangilik bo'lsa `app/src/data/malumot.ts` yangilanadi → `node app/scripts/info-seed.mjs "izoh"` SQL → bazaga; o'zgarish bo'lmasa faqat «Oxirgi tekshiruv» sanasi (`select liga_info_set_sys(null, 'izoh')`). Internet bo'lmasa — telefonda saqlangani, u ham bo'lmasa ilovadagi zaxira.
- **Kirmaganlar:** bot o'yinchini ajratadi (`liga_player_kind`): hech o'ynamagan — «xush kelibsiz, birinchi bosqich» (09:00, 12:00, 16:00), 2+ ish kuni o'ynamagan — «sizni sog'indik» (09:00, 12:00). Ilovada hali o'ynamaganga «Birinchi bosqichingiz» kartasi. Kunlik hisobotda (20:00) ikkala son.
- Baza: `db/2026-10-19_ball_kurs_kirmaganlar.sql`. Bot: v45. Testlar: 214 ta.

## 2026-10-07b: kubok — 15 savol, 90 soniya, 30 daqiqa
- Kubok duellari: 15 ta provodka, har savolga 90 soniya (jonli duel ham 90 soniya), har duel 30 daqiqa ochiq. Bugungi juftlar ham yangilandi va jadval hammaga qayta yuborildi.
- Baza: `liga_kubok_15_90_30` (db/2026-10-07_duel_kubogi.sql oxirida). Bot: v18.

## 2026-10-07: kunlik duel kubogi (olimpiya tizimi)
- Har ish kuni 09:00 da tasodifiy juftlar: chorak final 10:30, 11:00, 11:30, 12:00; g'oliblar — yarim final 14:00 va 14:30; final 16:00. Faqat provodka, 10 savol, har duel 1 soat ochiq.
- Durang yoki ikkalasi kelmasa — qur'a. Bot: ertalab jadval hammaga va guruhga, keyingi bosqichga chiqqanlarga «Siz yarim finalga chiqdingiz», 5 daqiqa oldin, boshlanganda va kubok g'olibi — hammaga.
- Asosiy ekranda «Kunlik duel kubogi»: bosqichlar bo'yicha jadval, g'oliblar, kubok g'olibi.
- Bugungi (07.10) juftlar yangi tizimga almashtirildi va jadval darhol hammaga yuborildi.
- Baza: `db/2026-10-07_duel_kubogi.sql`. Bot: v17. Testlar: 124 ta.

## 2026-10-06b: juftlar to'liq tasodifiy, jadval hammaga, 5 daqiqa oldin eslatma
- Juftlar endi to'liq tasodifiy (`liga_day_pair2_sys`). 09:00 da bot har kimga va jamoa guruhiga butun kunlik jadvalni yuboradi (kim kim bilan, soat nechada) va shaxsan o'z duelini.
- Duelga 5 daqiqa qolganda «⏳ Duelga 5 daqiqa qoldi!», soati kelganda «🔔 Duel boshlandi!» (`liga_day_duel_due2_sys`).
- Asosiy ekrandagi «Bugungi duel» kartasi doim ko'rinadi: juft bo'lmasa — qachon tuzilishi; ostida jamoaning bugungi duellar jadvali (`liga_day_duels_list`).
- Baza: `db/2026-10-06b_juftlik_tasodifiy.sql`. Bot: v16.

## 2026-10-06: kunlik juftlik dueli
- Har ish kuni 09:00 da jamoa a'zolari kechagi bosqich bali bo'yicha saralanadi (teng bo'lsa — tasodifiy), yonma-yon turganlar juftlanadi (1–2, 3–4 …). Har juftga tasodifiy soat (du–pa 10:00–16:00, juma 09:30–11:00), duel 1 soat ochiq, kuniga 1 marta.
- Faqat provodka (10 savol), jonli duel qoidasi. Belgilangan vaqtda kirmagan yutqazadi; ikkalasi kirmasa — o'ynalmadi.
- Bot: ertalab har kimga raqibi va soati, vaqt kelganda «Duel boshlandi» (cron `liga-juft-duel`, har 5 daqiqa). Asosiy ekranda «Bugungi duel» kartasi; adminga — bugungi juftliklar.
- Baza: `db/2026-10-06_kunlik_juftlik.sql`. Bot: v15. Testlar: 121 ta.

## 2026-10-05: jonli duel, admin uchun jamoa natijalari
- **Jonli duel** (Asosiy → «Duel» → «Jonli duel yaratish»): ikkalasi bir vaqtda o'ynaydi, 10 savol, har biriga 1 daqiqa. Kim birinchi to'g'ri javob bersa — ochko oladi va ikkalasiga keyingi savol chiqadi; xato qilgan shu savolda qulflanadi. Teng ochkoda tezroq yutadi. Hammasi serverda (`liga_live_*`). Havola bot orqali (`?start=d_L…`).
- **Jamoa natijalari** — faqat admin PIN bilan kirgan odamning Asosiy ekranida: har a'zoning bugungi bosqichi (to'g'ri/jami, ball) va haftalik bosqich bali. Kunlik mashq va blits kirmaydi. Oddiy ishtirokchilarga ko'rinmaydi.
- Baza: `db/2026-10-05_jonli_duel.sql`. Testlar: 115 ta.

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

## Oktyabr kunlik rejasi (14–30.10.2026)
- Har ish kuni o'z mavzusi: **15 provodka + 5 qonun savoli** (Soliq kodeksi moddalari, Prezident farmon/qarorlari, VM qarorlari, BHMS, qonunlar). Qiyinlik oy bo'yi o'sadi (1 → 13-daraja) va kun ichida ham osondan qiyinga (avval provodkalar, keyin qonun savollari).
- Mavzular: 14 Kassa va bank · 15 Xaridorlar va yetkazib beruvchilar · 16 TMZ · 19 Ish haqi · 20 QQS · 21 AV kirimi · 22 Amortizatsiya va AV chiqimi · 23 Ishlab chiqarish va tannarx · 26 Sotish va davr xarajatlari · 27 Valyuta · 28 Ustav kapitali va dividendlar · 29 Kreditlar, foizlar, penyalar · 30 Oy yakuni.
- Qonun faktlari manbalar bilan tekshirilgan (lex.uz, soliq.uz, buxgalter.uz; 2026 tahrirlari: BHMS 21 №3593, BHMS 5 №3546, BHMS 2 №3542, MChJ to'g'risidagi O'RQ-1137, PF-100, PF-115).
- Server: `liga_day_plan` (sana → pool, mavzu, nazariya), `liga_plan_draw`, `liga_stage_start` reja bo'lsa shu kunning 20 savolini beradi; ilova mavzu/nazariyani `liga_day_plans` dan oladi; bot ertalab mavzuni aytadi.
- Manba: `content/oct.asc` (shifrlangan). Yuklash: `select net.http_get('<raw url>/content/oct.asc')`, so'ng `select liga_plan_load_sys(<javob>)` — kalit serverda.
- 5 ta yangi schyot qo'shildi: 2510, 4230, 4860, 8530, 9040.

## Dekabr Katta finali
- Oktyabr kuchli uchligi + noyabr kuchli uchligi (takrorlansa — noyabrning keyingisi) = 6 finalchi. **28.12.2026, dushanba 10:00–13:00**, 12 provodka + 8 qonun savoli oyning eng qiyin kunlaridan (8-daraja va yuqori).
- Oy reytingi — shu oyda yakunlangan liga haftalari ballari yig'indisi (joriy hafta qo'shilmaydi — hafta sirligi buzilmaydi), har juma 12:00 da yangilanadi. Oktyabr **12.10.2026 (dushanba) dan** hisoblanadi (`gf_from`), undan oldingi haftalar kirmaydi.
- Oktyabr va noyabrdagi oddiy oylik finallar shu final bilan almashtirildi. Sozlama: `liga_bot_config` → `gf_months`, `gf_month`, `gf_date`.
- Ilova: bosh sahifada «Katta final» kartasi, har kuni birinchi kirishda eslatma oynasi (o'rningiz va kuchli uchlikka qancha XP yetmayotgani), Reyting → Final.

## Medallar va sertifikatlar (v2)
- Haftalik kuchli uchlikka juma 12:01 da avtomatik: o'ringa qarab **oltin / kumush / bronza** medal (lenta, rang, bezak va hafta raqami har xil) va sertifikat. Bot g'olibga sertifikat havolasini yuboradi.
- Sertifikat — rasmiy hujjat ko'rinishi (A4, chop etish/PDF), seriya `HL-YYYY-WW-O'RIN-ID`, liga muhri, QR kod, **raqamli imzo** (HMAC-SHA256, kalit faqat serverda).
- QR → `?v=ID` ochiq tekshiruv sahifasi: ma'lumot to'g'ridan-to'g'ri serverdan (`liga_cert_verify2`), imzo mosligi, jonli soat (skrinshot bilan soxtalashtirib bo'lmaydi), shu haftaning butun kuchli uchligi va ularning sertifikatlari.
- Profil → «Medallarim» javoni; Reyting → Zal — medallar.
- Tuzatildi: 2.10 haftasida Anvar E. sertifikatida 3-o'rin (aslida 2-o'rin) va Хаджаев У. natijasining alohida "hafta" bo'lib qolgani.

## Yangi a'zolarga bepul davr (2026-10-13)
- 10.10.2026 dan keyin ro'yxatdan o'tgan har bir o'yinchi ro'yxatdan o'tgan kunidan **30 kun bepul** o'ynaydi (`liga_bot_config`: `free_days` = 30, `free_from` = 2026-10-10). Ro'yxatdan o'tishda to'lov sahifasi ochilmaydi, ilova va bot «birinchi 30 kun bepul» deb yozadi.
- Muddat `liga_eff_until` ichida hisoblanadi; bepul davrda to'lasa obuna bepul davr tugagan kundan uzayadi.
- Kunlar sonini o'zgartirish: `update liga_bot_config set value = '14' where key = 'free_days';` · o'chirish: `value = '0'`.

## To'lov cheki — soxtadan himoya (2026-10-12)
- Chek (ilova yoki bot orqali) faqat **tekshiruvga** tushadi (`status = 'check'`), bosqichlar **yopiq** qoladi.
- Adminga bot chek rasmini yuboradi: summa, kartangizning oxirgi 4 raqami, o'yinchining avval rad etilgan cheklari soni. Bank ilovasida pul tushganini ko'rib «✅ Pul tushdi — ochish» bosiladi — obuna to'lov kunidan 30 kun ochiladi; «❌ Soxta» — rad. O'yinchiga ikkala holatda ham botdan xabar boradi (ilovadagi admin panel orqali qaror qilinsa ham).
- Bir xil chek rasmi ikkinchi marta qabul qilinmaydi (rasm hash / Telegram `file_unique_id`); bitta o'yinchida bir vaqtda bitta tekshiruvdagi chek; 14 kunda 2 marta rad etilsa — 7 kun chek qabul qilinmaydi.
- Funksiyalar: `liga_receipt_guard`, `liga_receipt_apply`, `liga_receipt2_sys`, `liga_receipt_decide2_sys`, `liga_receipt_info_sys` (faqat server), `db/2026-10-12_chek_tasdiq.sql`.
- Bank hisobini avtomatik ko'rish imkoni yo'q (bank API ulanmagan), shuning uchun yakuniy tasdiq — admin.

## 2026-10-13 kechki yangilanishlar
- **Ball:** ilova, bot va sertifikatlarda «XP» o'rniga «ball» (RU — «баллов»).
- **Sertifikat imzosi:** «Hisobchi Liga Kengashi · Hakamlar hay'ati nomidan» (`cert_signer`).
- **Kunlik duel kubogi (14.10 dan, ko'p ishtirokchi uchun):** juftlar 09:00 da tuziladi va bot orqali e'lon qilinadi; **duellar 10:00 dan**. Raundning barcha duellari **bir vaqtda** o'ynaladi. 1-raundda ortiqcha o'yinchilar «saralash»dan o'tadi, qolganlar avtomatik keyingi raundga chiqadi — shunda keyingi raund 2 ning darajasi bo'ladi (64/32/16/8/4/2). Raundlar har 40 daqiqada (30 daqiqa duel + 10 daqiqa oraliq); **12:00–14:00 — o'yin yo'q** (duel oynasi 12:00 ga tegsa 14:00 ga suriladi); **final har doim 17:00**.
  - 60 kishi: saralash 10:00 (28 duel, 4 kishi avtomatik o'tadi) → 1/16 final 10:40 (16) → 1/8 final 11:20 (8) → chorak final 14:00 (4) → yarim final 14:40 (2) → final 17:00. 54 kishi: saralash 22 duel + 10 avtomatik, qolgani xuddi shunday.
  - Funksiyalar: `liga_cup_round_time`, `liga_cup_timetable(n)` (jadval), `liga_cup_rstage` (raund nomi, avtomatik o'tganlar hisobga olinadi), `liga_cup_start_sys`, `liga_cup_advance`, `liga_cup_me2` (ilova: jadval va «avtomatik o'tdingiz»), `liga_cup_byes_sys` (bot) — `db/2026-10-13e_kubok_parallel.sql`, vaqtlar — `db/2026-10-14_kubok_1000.sql`.
  - Bot: guruhga to'liq ro'yxat (4096 belgidan uzun bo'lsa bo'laklab), shaxsan — 8 tadan ko'p duel bo'lsa qisqa jadval + o'z dueli; avtomatik o'tganlarga alohida xabar. Ilova: kun jadvali, katta raundda faqat o'z dueli + «Barcha N duelni ko'rish».
- **Takrorlanmaslik:** duel, jonli duel va kubok savollari o'yinchilar shu hafta (dushanbadan) ko'rgan savollarni chetlab tanlanadi (`liga_draw_fresh`, `liga_seen_week`); oddiy duelda ikkinchi o'yinchi birinchisi bilan aynan bir xil savollarni oladi.
- **Savollar tekshiruvi:** serverdagi 740 savol, ilova mashq savollari (240), 60 dars va mavzu generatorlari 8 qismda manbalar bilan tekshirildi: 55 ta bank savoli tuzatildi, 1 tasi o'yindan olindi (s9-07 — O'RQ-1137 27-m. ga zid), 12 ta mashq/dars, 4 ta generator tuzatildi. Yangi schyotlar: 6950, 6960, 9050, 9330. Manba: `content/patch-2026-10-13.asc`.

## Raqib bilan bog'lanish (2026-10-14)
- Kunlik duel kubogida raqib ismi bosiladigan bo'ldi (asosiy ekrandagi kubok kartasi va duel kutish zali): bosilganda **telefon raqami** va **Telegram niki** chiqadi, «Qo'ng'iroq» va «Yozish» tugmalari bilan.
- Ma'lumot faqat o'sha kubok duelining ishtirokchisiga beriladi (`liga_duel_opp_contact`, token bilan tekshiriladi) — boshqa duellar yoki begonalar ko'ra olmaydi.
- Telegram niki `safari_players.tg_username` ustunida: o'yinchi botga yozganda yoki ilovani Telegram ichida ochganda saqlanadi; eskilari bot `tg_names` amali bilan (va har kuni 09:00 dagi `day_start` da) `getChat` orqali to'ldiriladi. Niki yo'q bo'lsa — «Yozish» Telegram profilini ochadi.
- Migratsiya: `db/2026-10-14b_raqib_aloqa.sql`.
- Bot ham kubok xabarlarida (09:00 dagi juftlik e'loni, keyingi bosqichga chiqish, «5 daqiqa qoldi», «Duel boshlandi») oxiriga «Raqib bilan bog'lanish: 📞 telefon · ✈️ @nik» qatorini qo'shadi (`liga_duel_opp_contact_sys`, migratsiya `db/2026-10-14c_raqib_aloqa_bot.sql`).

## Kubokda faolsiz o'yinchi (2026-10-14)
- Kubok duelida o'yinchi **7 daqiqa (~5 savol)** davomida birorta ham javob bermasa — duel shu zahoti yakunlanadi (`liga_live_tick`, `liga_live_idle_sec()` = 420; dastlab 180 edi, 2026-10-14e da 420 ga o'zgartirildi).
- Biri faolsiz, ikkinchisi o'ynayapti → o'ynayotgan yutadi (`note = 'idle'`; oldinda bo'lmasa, ochkosi raqibnikidan 1 ta ko'p qilinadi).
- Ikkalasi faolsiz → duel to'xtatiladi (`note = 'idle2'`), g'olib ochko/vaqt bo'yicha, teng bo'lsa — qur'a.
- Faollik: har javob urinishi (to'g'ri yoki xato) `liga_live.a_act / b_act` ga yoziladi. Do'stona duellarga ta'sir qilmaydi.
- Migratsiya: `db/2026-10-14d_duel_faolsiz.sql`.

## Kubok: hamma 1-raunddan o'ynaydi (2026-10-15)
- Avval setka 2 ning darajasiga moslanardi: 132 kishida faqat 4 ta saralash dueli bo'lib, 124 kishi 1-raunddan avtomatik o'tib ketardi.
- Endi har raundda hamma juftlanadi (n/2 duel). Toq bo'lsa faqat 1 kishi o'tadi — u tasodifiy, bugun hali avtomatik o'tmaganlar ichidan tanlanadi. Keyingi raund juftlari ham har safar tasodifiy.
- 132 kishi: 66 → 33 → 16(+1) → 8(+1) → 4(+1) → 2(+1) → yarim final → final 17:00. Raund nomi o'yinchilar sonidan kattaroq eng yaqin 2 ning darajasi bo'yicha (`liga_cup_pstage`).
- Har kuni ishtirokchilar soni o'zgarsa ham jadval to'g'ri tuziladi: 2 dan 400 gacha bo'lgan har bir son uchun tekshirildi (bitta final, final doim 17:00, raundlar ustma-ust tushmaydi; 256 dan ko'pda 16:00 dan keyin 30 daqiqalik qadam).
- **Telegram kanal:** botni kanalga administrator («Post Messages» huquqi bilan) qilib qo'shilsa, kanal `liga_channels` ga yoziladi va darhol bugungi qura chiqadi. Keyin har kuni: 09:00 dagi qura, har raund natijalari + keyingi raund qurasi, kubok g'olibi. Qo'lda qayta yuborish: bot amali `channel_cup`. Migratsiya: `db/2026-10-15b_kanal.sql`.
- **1-raund doim juft (2026-10-15):** ishtirokchilar soni toq bo'lsa, eng oxirgi ro'yxatdan o'tgan o'yinchi o'sha kuni kubokda qatnashmaydi (`liga_day_bench`), kunlik bosqichda odatdagidek o'ynaydi. Bot va ilova unga «ertadan kubokda qatnashasiz» deydi. Keyingi raundlarda toq son chiqsa (masalan 66 → 33), bitta g'olib avtomatik o'tadi va ro'yxatda «➡️ juftsiz qoldi» deb ko'rinadi. Migratsiya: `db/2026-10-15e_kubok_juft.sql`.
- **Keyingi raundlarda ham juftsiz yo'q (2026-10-16):** g'oliblar soni toq chiqsa (masalan 30 → 15), avtomatik o'tish o'rniga shu raundning **eng yaxshi yutqazgani** qaytariladi — o'ynagan, eng ko'p ochko yig'gan, teng bo'lsa tezroq javob bergan. 240 → 120 → 60 → 30 → 16 → 8 → 4 → 2 → final. Migratsiya: `db/2026-10-16_kubok_eng_yaxshi_yutqazgan.sql`.
- Raund ikki marta tuzilib qolmasligi uchun `pg_advisory_xact_lock`. Migratsiya: `db/2026-10-15_kubok_hamma_oynaydi.sql`.

## Juma ham 09:00–17:00 (2026-10-14)
- Juma kuni bosqich boshqa kunlar kabi 17:00 gacha ochiq (`liga_close_hour` = 17). Haftalik liga **juma 17:00** da yakunlanadi: natijalar 17:01, darajalar 17:10, «1 soat qoldi» ogohlantirishi 16:00.
- Hafta identifikatori yozuvi o'zgarmadi (`YYYY-MM-DDT07:00`, juma sanasi) — faqat almashish payti 12:00 → 17:00 (`liga_cur_week_id`, `liga_last_week_id`, ilovada `weekEnd`/`weekId`). Shuning uchun joriy hafta ballari saqlanib qoladi.

## Ishtirokchilar muhokama guruhi (2026-10-14)
Telegram qoidasi bo'yicha bot guruh ocholmaydi va odamni guruhga o'zi qo'sha olmaydi, shuning uchun:
1. Liga administratori Telegram'da yangi guruh ochadi va @Buxgalterlar_Ligasi_bot ni qo'shadi.
2. Botni guruhda **administrator** qiladi («Foydalanuvchilarni taklif qilish» huquqi bilan).
3. Guruhda `/muhokama` deb yozadi (faqat `liga_admin_chats` dagi admin ishlata oladi).
4. Bot taklif havolasini yaratadi va Telegram'i ulangan har bir ishtirokchiga shaxsan «💬 Guruhga qo'shilish» tugmasini yuboradi (guruhda borlarga yubormaydi), oxirida hisobotni guruhga yozadi.
- Yangi ishtirokchilarga — har ish kuni 09:00 dagi `day_start` da va Telegram'ni ilovadan ulagan zahoti.
- Telegram'i ulanmaganlar havolani ilovaning bosh sahifasida («Ishtirokchilar guruhi» kartasi) ko'radi.
- Guruh jamoaga (`ASOSIY`) ulanadi — bosqich e'lonlari va juma natijalari u yerga ham chiqadi.
- Qo'lda qayta yuborish: cron amali `discuss_invite`. Migratsiya: `db/2026-10-14f_muhokama_guruhi.sql`.
- Yetkazish holati `safari_players.discuss_status` da (`in` — guruhda, `sent` — yetdi, `fail` — yetmadi: botni ochmagan yoki bloklagan, `kicked`). Cron amallari: `discuss_check` — faqat tekshiradi, `discuss_resend` — guruhda yo'qlarga qayta yuboradi. Migratsiya: `db/2026-10-14h_muhokama_holat.sql`.
- **Guruhda duelga chaqiruv:** guruhda `/duel` → bot «⚔️ Qabul qilish» tugmali chaqiruv chiqaradi. Tugmani **birinchi bosgan** raqib bo'ladi (`liga_live_take_sys`, qator qulf bilan — ikki kishi bir vaqtda bossa ham faqat bittasi o'tadi), qolganlarga «Kechikdingiz» chiqadi. 30 daqiqada qabul qilinmasa — bekor. Duel tugagach natija o'sha xabarga yoziladi.
- **Natijalar guruhga:** kunlik kubokning har bir raundi tugagach natijalar ro'yxati, kubok g'olibi, bosqich ochilishi/yopilishi va kunlik kuchli uchlik (`day_end`) — shu guruhga. Cron `liga-guruh-natija` (har 2 daqiqa) → `liga_group_tick()` → bot `group_due`. Migratsiya: `db/2026-10-14i_guruh_duel_natijalar.sql`.
- **Tomoshabinlar uchun jonli ko'rinish:** guruhdagi duel boshlangach chaqiruv xabari har savoldan keyin yangilanadi — o'yinchilar ismi, hisob, savol raqami, o'tgan savol matni, kim birinchi topgani va to'g'ri javob (joriy savol javobi ko'rsatilmaydi). `liga_live` dagi trigger (`liga_live_group_notify`) botni `group_live` amali bilan chaqiradi. Migratsiya: `db/2026-10-14j_juma17_tomosha.sql`.
- **Ilovadan tashlangan duel ham kuzatiladi:** guruhga «Yuborish» orqali tashlangan duel havolasini (`?start=d_L…`) bot taniydi, unga javoban jonli tablo xabarini chiqaradi (`liga_group_track_sys`).
- **Duel tugashi bilan** (trigger orqali darhol) tablo xabari yakuniy natijaga aylanadi: ismlar, hisob, g'olib va **har savol bo'yicha** kim birinchi to'g'ri topdi (✅), kim xato javob berdi (❌), kim javob bermadi (➖) hamda to'g'ri javob. Shu xabarga javob qilib qisqa natija ham yuboriladi (bildirishnoma uchun). Xato javoblar `liga_live.log` dagi `al`/`bl` maydonlariga yoziladi (`liga_live_next`). Migratsiya: `db/2026-10-14k_guruh_duel_tafsilot.sql`.
- Oddiy guruh superguruhga aylansa (masalan, «Chat history for new members → Visible» yoqilganda), bot yangi guruh id va havolani o'zi saqlaydi (`liga_discuss_move_sys`).
- **Buyruqlar menyusi** (`setup`): oddiy a'zolarga guruhda faqat /duel, /natija, /qoida ko'rinadi; /ulash va /muhokama faqat guruh adminlarining menyusida. Oddiy a'zo /ulash yoki /muhokama yozsa — bot javob yozmaydi, buyruqni jimgina o'chiradi. Allaqachon ulangan guruhga bot qayta qo'shilsa, «/ulash KOD» ko'rsatmali salom xabari chiqmaydi.
- **Reklamaga qarshi** (`bot/reklama.ts`, sinovlar `bot/reklama_test.ts` — `deno test bot/reklama_test.ts`): hamma yoza oladi, lekin bot adminlardan boshqalarning quyidagi xabarlarini o'chiradi — begona saytlarga havola (lex.uz, soliq.uz, norma.uz, buxgalter.uz, gov.uz, didox.uz va boshqa rasmiy saytlar mumkin), kanal/guruhdan forward, kanal/guruh/bot @mentionlari, tugmali xabarlar, begona inline-botlar, kanal nomidan yozish. Tahrirlangan xabarlar ham tekshiriladi. Ogohlantirish 20 soniyada o'chadi; 7 kun ichida 3-marta takrorlagan odam 24 soat yozolmaydi (`liga_discuss_strikes`). Botga kerakli huquqlar: xabarlarni o'chirish, foydalanuvchilarni cheklash, havola orqali taklif. Migratsiya: `db/2026-10-14g_muhokama_reklama.sql`.

## 2026-10-16 yangilanishlar
- **Asosiy ekran qisqardi:** kubokning har raundi yig'ilgan — sarlavhada raund nomi, soat, duellar soni, «siz shu yerda»; bosilsa ochiladi (bir vaqtda bittasi). Kun jadvali ham yig'iladi.
- **Buxgalter ma'lumotnomasi** (bosh sahifa, `#info`): MChJ, XK, oilaviy korxona, YaTT, 2026 soliq stavkalari va imtiyozlar — har biri bosganda ochiladi. Matn: `app/src/data/malumot.ts` (UPDATED sanasi bilan; o'zgarsa shu faylni yangilang).
- **Dizayn:** shrift Golos Text (o'zbek kirilini to'liq qamraydi), Unbounded faqat katta raqamlarda; bir xil soyali kartalar o'rniga chiziqli bloklar, tezkor amallar — jurnal kataklari.
- **Muhokama guruhi tepasida havola:** bot guruhga qoidalar va havola yozilgan xabarni qadaydi (pin) va guruh tavsifiga havolani yozadi. `/muhokama` dan keyin avtomatik; qayta qilish: `select liga_bot_call('discuss_pin')`. Bot guruhda «Xabarlarni qadash» va «Guruh ma'lumotini o'zgartirish» huquqiga ega bo'lishi kerak.
- **Jonli duel tomoshabini** joriy savolni, ikkala o'yinchi ismini, kim xato qilganini va kim birinchi topganini ko'radi (javob bera olmaydi).
- **AI'dan foydalanishga qarshi:** bosqichda ham, jonli duelda ham savol ochiq turganda ilovadan chiqish yoki **kompyuterda boshqa oynaga o'tish** (AI chat) 3 soniyadan oshsa — bosqichda savol xato, duelda shu savolda qulflanadi. Duelda ham matnni nusxalab bo'lmaydi va ekranda o'yinchi ismi (suv belgisi) bor. Ikkinchi telefon bilan suratga olishni texnik to'liq to'sib bo'lmaydi — vaqt chegarasi va suv belgisi buni qiyinlashtiradi.
- Migratsiya: `db/2026-10-16b_tomoshabin_savol_eslatma.sql`.

## 2026-10-16 (kechqurun)
- **Sana va valyuta kursi** bosh sahifaning eng tepasida: bugungi sana (hafta kuni bilan) va Markaziy bank kursi — USD, EUR, RUB, CNY, o'zgarishi bilan. Bot har soatda (`:07`) cbu.uz dan oladi (`rates`, cron `liga-kurs`), jadval `liga_rates`, ilova `liga_rates()` orqali o'qiydi.
- **Admin kartasi yig'iladi:** «Bosqich ballari», «Bugungi juftliklar», «Savol paytida ilovadan chiqqanlar» — har biri bosganda ochiladi.
- **Ma'lumotnoma kengaydi (9 mavzu):** ijtimoiy soliq 1% imtiyozlari (PQ-78, nogironligi bor xodimlar, PF-229), IT Park (2040 gacha, JShDS 7,5%), xodim uchun JShDS imtiyozlari (bog'cha/maktab 3 mln, kontrakt), mol-mulk va yer solig'i imtiyozi uchun yangi shartlar.
- **AI (Gemini, Jarvis) nazorati kuchaytirildi:** chegara 3 → 1,5 soniya; ekran ustiga chiqadigan AI oynasi (Android blur), Telegram'da boshqa chatga o'tish (`deactivated`) ham ushlanadi; 0,4 soniyadan uzoq har bir chiqish serverga yoziladi (`liga_away`, `liga_run_away`, `liga_live_away`) va admin ro'yxatida kim necha marta chiqqani, nechta savol shu sababli xato bo'lgani ko'rinadi (`liga_admin_away`). Umumiy kod: `app/src/lib/guard.ts`.
- Migratsiya: `db/2026-10-16c_ai_nazorat_kurs.sql`.

## SMS eslatma (Eskiz.uz) — 2026-10-16
- **Kimga:** (1) kubok dueli ochilganidan 5 daqiqa o'tib ham kirmagan o'yinchiga — duel yopilishidan oldin; (2) 15:00–16:30 da bugungi bosqichni hali boshlamagan faol ishtirokchiga. Bir kishiga bir kunda har turdan bittadan, kunlik chegara `sms_cap` (400).
- **Ishlash:** cron `liga-sms` har 5 daqiqada (09:00–17:55, du–ju) → bot `sms_tick` → `liga_sms_due()` navbat beradi → Eskiz API → `liga_sms_mark`. Jurnal: `liga_sms_log`. Holat: `liga_sms_preview()`.
- **Yoqish (admin, botga shaxsiy):** `/sms_login email parol` (xabar darhol o'chiriladi; yoki edge secret ESKIZ_EMAIL/ESKIZ_PASSWORD) → `/sms test 998901234567` → `/sms on`. O'chirish `/sms off`, chegara `/sms cap 300`, holat `/sms`.
- **Matnlar o'zgarmas** (`bot/index.ts` → `SMS_TEXT`) — Eskiz kabinetida shablon sifatida tasdiqlatiladi.
- Migratsiya: `db/2026-10-16d_sms.sql`.

## Bot jadvali (Toshkent vaqti, dushanba–juma)
09:00 — bosqich ochildi · **12:00 — bosqichni hali bajarmaganlarga shaxsan eslatma** (`remind_noon`, cron `liga-eslatma-12`) · 16:00 — 1 soat qoldi · 17:00 — o'yin tugadi · juma 11:00 — liga tugashiga 1 soat · juma 12:01 — natijalar (har jamoaga o'zinikini).

**Har kuni 20:00 (shanba–yakshanba ham)** — jamoa adminiga kunlik hisobot (`daily_report`): yangi a'zolar, bugun kirganlar, bosqich natijalari va o'ynamaganlar, duel kubogi chempioni, hafta reytingi top-3, to'lovlar (tasdiq kutayotgan cheklar, tugayotgan obunalar), tizim holati (avtomatik ishlar va bot so'rovlaridagi xatolar). Ma'lumot `liga_daily_report_sys(p_code)` dan, qabul qiluvchilar — `liga_admin_chats`. Cron: `liga-kunlik-hisobot` `0 15 * * *` (UTC). Sinov uchun qayta yuborish: `select liga_bot_call('daily_report_now')`.

Bot deploy: Supabase'dagi `liga-bot/index.ts` — faqat shu repodagi `bot/index.ts` ni aniq commit bo'yicha import qiladigan qisqa fayl. Bot o'zgarsa: commit + push, keyin shim'dagi commit SHA ni yangilab qayta deploy qiling.

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
