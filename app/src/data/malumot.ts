/* Buxgalter ma'lumotnomasi: tashkiliy-huquqiy shakllar va 2026 soliq qoidalari (bosh sahifada, yig'ilgan holda).
   Bu — zaxira nusxa: ilova avval bazadagi liga_info() ni o'qiydi (har dushanba yangilanadi), ochilmasa shu ro'yxat ko'rinadi.
   Holat: 26.10.2026. Bazani yangilaganda shu faylni ham yangilang (scripts/info-seed.mjs). */
export const UPDATED = "26.10.2026";
type L = { uz: string; ru: string };
export type Info = { id: string; short: L; title: L; sub: L; rows: [L, L][]; plus?: L[]; note?: L };

export const INFO: Info[] = [
  {
    id: "mchj", short: { uz: "MChJ", ru: "ООО" },
    title: { uz: "Mas'uliyati cheklangan jamiyat", ru: "Общество с ограниченной ответственностью" },
    sub: { uz: "Sheriklar bilan biznes uchun eng ko'p tanlanadigan shakl", ru: "Самая популярная форма для бизнеса с партнёрами" },
    rows: [
      [{ uz: "Qonun", ru: "Закон" }, { uz: "«Mas'uliyati cheklangan hamda qo'shimcha mas'uliyatli jamiyatlar to'g'risida» (2001)", ru: "«Об обществах с ограниченной и дополнительной ответственностью» (2001)" }],
      [{ uz: "Ishtirokchilar", ru: "Участники" }, { uz: "1 dan 50 gacha — jismoniy va yuridik shaxslar", ru: "от 1 до 50 — физические и юридические лица" }],
      [{ uz: "Javobgarlik", ru: "Ответственность" }, { uz: "Ishtirokchi faqat ustav fondidagi ulushi doirasida tavakkal qiladi", ru: "Участник рискует только в пределах своей доли в уставном фонде" }],
      [{ uz: "Ustav fondi", ru: "Уставный фонд" }, { uz: "Umumiy eng kam miqdor yo'q (litsenziyali faoliyatlar bundan mustasno)", ru: "Общего минимума нет (кроме лицензируемых видов деятельности)" }],
      [{ uz: "Foyda taqsimoti", ru: "Распределение прибыли" }, { uz: "Dividend — 5% soliq", ru: "Дивиденды — налог 5%" }],
    ],
    plus: [
      { uz: "Yangi sherik qo'shish, ulushni sotish yoki sovg'a qilish oson", ru: "Легко ввести партнёра, продать или подарить долю" },
      { uz: "Bank, investor va yirik xaridorlar uchun eng tushunarli shakl", ru: "Самая понятная форма для банков, инвесторов и крупных покупателей" },
      { uz: "Shaxsiy mol-mulk korxona qarzlari uchun xavf ostida emas", ru: "Личное имущество не отвечает по долгам компании" },
    ],
  },
  {
    id: "xk", short: { uz: "XK", ru: "ЧП" },
    title: { uz: "Xususiy korxona", ru: "Частное предприятие" },
    sub: { uz: "Bitta egasi bor, sherik kutilmaydigan biznes uchun", ru: "Для бизнеса с одним владельцем, без партнёров" },
    rows: [
      [{ uz: "Qonun", ru: "Закон" }, { uz: "«Xususiy korxona to'g'risida» (2003)", ru: "«О частном предприятии» (2003)" }],
      [{ uz: "Mulkdor", ru: "Собственник" }, { uz: "Faqat bitta jismoniy shaxs", ru: "Только одно физическое лицо" }],
      [{ uz: "Javobgarlik", ru: "Ответственность" }, { uz: "Avval korxona mol-mulki; yetmasa — mulkdor o'z mol-mulki bilan (subsidiar)", ru: "Сначала имущество предприятия; если не хватает — собственник своим имуществом (субсидиарно)" }],
      [{ uz: "Ustav fondi", ru: "Уставный фонд" }, { uz: "Majburiy eng kam miqdor yo'q", ru: "Обязательного минимума нет" }],
      [{ uz: "Foyda", ru: "Прибыль" }, { uz: "Soliqlardan keyin mulkdor ixtiyorida; mulkdorga to'langan foyda soliq maqsadida dividendga tenglashtiriladi — 5%", ru: "После налогов — в распоряжении собственника; выплата собственнику для налога приравнивается к дивидендам — 5%" }],
    ],
    plus: [
      { uz: "Qarorlarni yolg'iz qabul qilasiz — yig'ilish bayonnomalari kerak emas", ru: "Решения принимаете единолично — протоколы собраний не нужны" },
      { uz: "Ochish va yuritish MChJga qaraganda soddaroq", ru: "Открыть и вести проще, чем ООО" },
    ],
    note: { uz: "Sherik qo'shmoqchi bo'lsangiz — XKni MChJga qayta tashkil etish kerak bo'ladi.", ru: "Чтобы ввести партнёра, ЧП придётся преобразовать в ООО." },
  },
  {
    id: "ok", short: { uz: "OK", ru: "СП" },
    title: { uz: "Oilaviy korxona", ru: "Семейное предприятие" },
    sub: { uz: "Qarindoshlar birga ishlaydigan biznes — o'z imtiyozlari bor", ru: "Бизнес, где вместе работают родственники, — со своими льготами" },
    rows: [
      [{ uz: "Qonun", ru: "Закон" }, { uz: "«Oilaviy tadbirkorlik to'g'risida» (2012)", ru: "«О семейном предпринимательстве» (2012)" }],
      [{ uz: "Ishtirokchilar", ru: "Участники" }, { uz: "Kamida 2 kishi, faqat qarindoshlar: er-xotin, ota-ona, bolalar, nevaralar, aka-uka va opa-singillar (turmush o'rtoqlari bilan), amaki, tog'a, xola, amma — voyaga yetgan va mehnatga layoqatli", ru: "Не менее 2 человек, только родственники: супруги, родители, дети, внуки, братья и сёстры (с супругами), дяди и тёти — совершеннолетние и трудоспособные" }],
      [{ uz: "Ta'sis hujjati", ru: "Учредительный документ" }, { uz: "Faqat ta'sis shartnomasi — alohida ustav kerak emas", ru: "Только учредительный договор — отдельный устав не нужен" }],
      [{ uz: "Javobgarlik", ru: "Ответственность" }, { uz: "Avval korxona mol-mulki; yetmasa — ishtirokchilar subsidiar javob beradi", ru: "Сначала имущество предприятия; если не хватает — участники отвечают субсидиарно" }],
      [{ uz: "Ustav fondi", ru: "Уставный фонд" }, { uz: "Eng kam miqdor yo'q; yagona uy yoki kvartirani ulush qilib qo'shib bo'lmaydi", ru: "Минимума нет; единственный дом или квартиру вносить нельзя" }],
      [{ uz: "Soliq", ru: "Налоги" }, { uz: "Alohida rejim yo'q — umumiy qoidalar; ishtirokchilarga foyda — dividend, 5%", ru: "Особого режима нет — общие правила; прибыль участникам — дивиденды, 5%" }],
    ],
    plus: [
      { uz: "Turar joyda (uyda) faoliyat yuritish mumkin — noturar bino shart emas", ru: "Можно работать в жилом помещении (дома) — нежилое здание не обязательно" },
      { uz: "Bir joyda yashab, ishlab chiqarsa — elektr, gaz, suv aholi tarifida", ru: "Если живут и производят в одном месте — свет, газ, вода по тарифу для населения" },
      { uz: "Mol-mulk solig'i turar joy stavkasida, yer solig'i jismoniy shaxs stavkasida", ru: "Налог на имущество — по ставке для жилья, земельный — по ставке для физлиц" },
      { uz: "Ishtirokchilarning ishlagan vaqti ish stajiga qo'shiladi (ijtimoiy soliq to'langan bo'lsa)", ru: "Работа участников засчитывается в стаж (при уплате социального налога)" },
      { uz: "Davlat bo'sh noturar joy, yer va tarmoqqa ulanishda ko'maklashadi", ru: "Государство помогает с нежилыми помещениями, землёй и подключением к сетям" },
    ],
    note: { uz: "Ro'yxatdan o'tish: Davlat xizmatlari markazida 1 BHM (440 000 so'm), onlayn — 10% arzon.", ru: "Регистрация: в ЦГУ — 1 БРВ (440 000 сумов), онлайн — на 10% дешевле." },
  },
  {
    id: "yatt", short: { uz: "YaTT", ru: "ИП" },
    title: { uz: "Yakka tartibdagi tadbirkor", ru: "Индивидуальный предприниматель" },
    sub: { uz: "Yuridik shaxs ochmasdan ishlash", ru: "Работа без создания юрлица" },
    rows: [
      [{ uz: "Maqomi", ru: "Статус" }, { uz: "Yuridik shaxs emas — jismoniy shaxs tadbirkor", ru: "Не юрлицо — физическое лицо-предприниматель" }],
      [{ uz: "Javobgarlik", ru: "Ответственность" }, { uz: "Butun shaxsiy mol-mulki bilan", ru: "Всем личным имуществом" }],
      [{ uz: "Soliq (2026)", ru: "Налог (2026)" }, { uz: "Aylanmadan olinadigan soliq 1% — yillik daromad 1 mlrd so'mgacha; qat'iy belgilangan JShDS bekor qilingan (O'RQ-1108, 25.12.2025)", ru: "Налог с оборота 1% — при доходе до 1 млрд сумов в год; фиксированный НДФЛ отменён (ЗРУ-1108, 25.12.2025)" }],
      [{ uz: "Chegaradan oshsa", ru: "Сверх порога" }, { uz: "1 mlrd so'mdan oshgan kundan — QQS va foyda solig'i", ru: "С дня превышения 1 млрд сумов — НДС и налог на прибыль" }],
    ],
  },
  {
    id: "soliq", short: { uz: "2026", ru: "2026" },
    title: { uz: "Soliq stavkalari va imtiyozlar — 2026", ru: "Ставки налогов и льготы — 2026" },
    sub: { uz: "Asosiy stavkalar va yangi farmondagi o'zgarishlar", ru: "Основные ставки и изменения по новому указу" },
    rows: [
      [{ uz: "Aylanma soliq", ru: "Налог с оборота" }, { uz: "4% (asosiy stavka)", ru: "4% (базовая ставка)" }],
      [{ uz: "Umumiy rejim chegarasi", ru: "Порог общего режима" }, { uz: "Yillik aylanma 12 000 BHM — 1.06.2026 dan (Prezident farmoni, 29.05.2026). BHM 440 000 so'm bo'lgani uchun — 5,28 mlrd so'm", ru: "Годовой оборот 12 000 БРВ — с 01.06.2026 (Указ Президента от 29.05.2026). При БРВ 440 000 сумов — 5,28 млрд сумов" }],
      [{ uz: "QQS", ru: "НДС" }, { uz: "12%", ru: "12%" }],
      [{ uz: "Foyda solig'i", ru: "Налог на прибыль" }, { uz: "15%", ru: "15%" }],
      [{ uz: "Dividend", ru: "Дивиденды" }, { uz: "5%", ru: "5%" }],
      [{ uz: "JShDS / ijtimoiy soliq", ru: "НДФЛ / социальный налог" }, { uz: "12% / 12%", ru: "12% / 12%" }],
      [{ uz: "BHM", ru: "БРВ" }, { uz: "440 000 so'm — 1.09.2026 dan", ru: "440 000 сумов — с 01.09.2026" }],
    ],
    plus: [
      { uz: "Savdo, umumiy ovqatlanish va xizmat: ixtiyoriy soddalashtirilgan QQS 6%, foyda solig'i 0% (1.06.2026–1.01.2030); kirim QQS hisobga olinmaydi", ru: "Торговля, общепит и услуги: добровольный упрощённый НДС 6%, налог на прибыль 0% (01.06.2026–01.01.2030); входящий НДС не зачитывается" },
      { uz: "1.10.2026 dan QQS manfiy qoldig'i avtomatik qaytariladi; 10 mln so'mgacha — arizasiz", ru: "С 01.10.2026 отрицательное сальдо НДС возвращается автоматически; до 10 млн сумов — без заявления" },
      { uz: "1.01.2027 dan kichik biznes buxgalter va soliq maslahatchisi xarajatlarini ikki baravar chegiradi", ru: "С 01.01.2027 малый бизнес вычитает расходы на бухгалтера и налогового консультанта в двойном размере" },
      { uz: "1.01.2028 gacha kichik biznesda xavf summasi 500 mln so'mgacha bo'lsa soliq tekshiruvi o'tkazilmaydi — xatoni o'zingiz tuzatasiz", ru: "До 01.01.2028 у малого бизнеса при сумме риска до 500 млн сумов налоговая проверка не проводится — ошибку исправляете сами" },
    ],
    note: { uz: "Manbalar: lex.uz (O'RQ-1108), president.uz (29.05.2026 farmon), buxgalter.uz.", ru: "Источники: lex.uz (ЗРУ-1108), president.uz (указ от 29.05.2026), buxgalter.uz." },
  },
  {
    id: "ijtimoiy", short: { uz: "1%", ru: "1%" },
    title: { uz: "Ijtimoiy soliq imtiyozlari", ru: "Льготы по социальному налогу" },
    sub: { uz: "12% o'rniga 1% — kimlar uchun va qanday shartda", ru: "1% вместо 12% — для кого и на каких условиях" },
    rows: [
      [{ uz: "Asosiy stavka", ru: "Базовая ставка" }, { uz: "12%", ru: "12%" }],
      [{ uz: "Xizmat sohalari", ru: "Сфера услуг" }, { uz: "1% — 30 yoshgacha, oylik ish haqi kamida 2,5 MHTEKM bo'lgan xodimlar uchun; 10 soha: chakana savdo, umumiy ovqatlanish, mehmonxona, avtotransportda yo'lovchi va yuk tashish, avtomobil ta'miri, kompyuter xizmatlari, maishiy texnika ta'miri, qishloq xo'jaligi va veterinariya xizmatlari, ko'ngilochar markazlar. 1.01.2028 gacha (PQ-78, 27.02.2025)", ru: "1% — для работников до 30 лет с зарплатой не менее 2,5 МРОТ; 10 сфер: розница, общепит, гостиницы, автоперевозки пассажиров и грузов, ремонт авто, компьютерные услуги, ремонт бытовой техники, сельхоз- и ветеринарные услуги, развлекательные центры. До 01.01.2028 (ПП-78 от 27.02.2025)" }],
      [{ uz: "Nogironligi bor xodim", ru: "Работник с инвалидностью" }, { uz: "I va II guruh nogironligi bo'lgan xodim uchun nodavlat yuridik shaxs — 1% (ish haqi eng kam miqdordan kam bo'lmasa); YaTT bunday xodim uchun ijtimoiy soliq to'lamaydi", ru: "За работника с инвалидностью I и II группы негосударственное юрлицо платит 1% (если зарплата не ниже минимальной); ИП за такого работника соцналог не платит" }],
      [{ uz: "To'qimachilik, poyabzal, charm", ru: "Текстиль, обувь, кожа" }, { uz: "I–II guruh nogironligi bo'lganlarni ishga olsa: foyda solig'i 2%, ijtimoiy soliq 1% — 1.01.2025–1.01.2028 (PF-229)", ru: "При найме лиц с инвалидностью I–II группы: налог на прибыль 2%, соцналог 1% — 01.01.2025–01.01.2028 (УП-229)" }],
      [{ uz: "Issiqxona xo'jaliklari", ru: "Тепличные хозяйства" }, { uz: "1% — daromadning kamida 60% issiqxonadan bo'lsa, 1.01.2026–1.01.2029 (PQ-371, 13.10.2026)", ru: "1% — при доле дохода от теплиц не менее 60%, 01.01.2026–01.01.2029 (ПП-371 от 13.10.2026)" }],
      [{ uz: "YaTT o'zi uchun", ru: "ИП за себя" }, { uz: "Oyiga 1 BHM (1.09.2026 dan 440 000 so'm)", ru: "1 БРВ в месяц (с 01.09.2026 — 440 000 сумов)" }],
    ],
    note: { uz: "Imtiyozli stavka faqat shartga mos keladigan xodimlarga qo'llanadi, qolganlar uchun — 12%. Diqqat: Iqtisodiyot va moliya vazirligi ijtimoiy soliq imtiyozlarini bosqichma-bosqich qisqartirib, 2030 yildan to'liq bekor qilishni taklif qildi (22.09.2026) — hozircha taklif, amaldagi imtiyozlar saqlanadi.", ru: "Льготная ставка применяется только к работникам, подходящим под условия, по остальным — 12%. Внимание: Минэкономфин предложил поэтапно сократить льготы по соцналогу и полностью отменить их с 2030 года (22.09.2026) — пока это предложение, действующие льготы сохраняются." },
  },
  {
    id: "itpark", short: { uz: "IT", ru: "IT" },
    title: { uz: "IT Park rezidentlari", ru: "Резиденты IT Park" },
    sub: { uz: "Dasturiy mahsulot va IT-xizmatlar eksporti uchun", ru: "Для экспорта ПО и IT-услуг" },
    rows: [
      [{ uz: "Soliqlar", ru: "Налоги" }, { uz: "Barcha soliqlar va ijtimoiy soliqdan ozod — QQSdan tashqari", ru: "Освобождены от всех налогов и соцналога — кроме НДС" }],
      [{ uz: "Xodimlar JShDS", ru: "НДФЛ работников" }, { uz: "Qat'iy 7,5%", ru: "Фиксированно 7,5%" }],
      [{ uz: "Muddat", ru: "Срок" }, { uz: "1.01.2040 gacha uzaytirilgan (oldin 2028 gacha edi)", ru: "Продлено до 01.01.2040 (ранее до 2028)" }],
      [{ uz: "Shart", ru: "Условие" }, { uz: "Yillik daromadning 50% dan ko'pi — ruxsat etilgan faoliyat eksportidan (yoki IT-ta'limda bitiruvchilarning yarmidan ko'pi eksportchi rezidentlarga ishga kirgan)", ru: "Более 50% годового дохода — экспорт разрешённых видов деятельности (или в IT-образовании более половины выпускников трудоустроены у резидентов-экспортёров)" }],
      [{ uz: "Bojxona", ru: "Таможня" }, { uz: "O'z ehtiyoji uchun uskuna va dasturlar importida bojxona to'lovlaridan ozod (yig'imlardan tashqari)", ru: "Освобождение от таможенных платежей (кроме сборов) при импорте оборудования и ПО для своих нужд" }],
    ],
  },
  {
    id: "jshds", short: { uz: "JShDS", ru: "НДФЛ" },
    title: { uz: "Xodim uchun daromad solig'i imtiyozlari", ru: "Льготы по НДФЛ для работника" },
    sub: { uz: "Ish haqining bir qismi soliqdan ozod — xodimlarga ayting", ru: "Часть зарплаты освобождается от налога — расскажите работникам" },
    rows: [
      [{ uz: "Xususiy bog'cha va maktab", ru: "Частный сад и школа" }, { uz: "Farzand uchun to'lov — har bir bolaga oyiga 3 mln so'mgacha ish haqi soliqdan ozod", ru: "Оплата за ребёнка — до 3 млн сумов в месяц на каждого ребёнка освобождается от налога" }],
      [{ uz: "Kasbiy va oliy ta'lim", ru: "Профессиональное и высшее образование" }, { uz: "O'zi, 26 yoshgacha farzandi yoki turmush o'rtog'i uchun kontrakt to'lovi va ta'lim krediti (foizlari bilan) soliqdan ozod", ru: "Контракт за себя, детей до 26 лет или супруга, а также образовательный кредит (с процентами) освобождаются от налога" }],
      [{ uz: "Qanday olinadi", ru: "Как получить" }, { uz: "1) Ish beruvchiga ariza — buxgalteriya ish haqining shu qismini to'g'ridan-to'g'ri ta'lim muassasasiga o'tkazadi; 2) yoki yil oxirida daromad deklaratsiyasi va to'lov hujjatlari bilan soliq organidan qaytarib olinadi", ru: "1) Заявление работодателю — бухгалтерия перечисляет эту часть зарплаты прямо в учебное заведение; 2) или в конце года через декларацию о доходах с платёжными документами" }],
    ],
    note: { uz: "30.09.2026 da Prezident xususiy maktab uchun chegarani 6 mln so'mga oshirishni e'lon qildi. 26.10.2026 holatiga normativ hujjat chiqmagan — hozircha 3 mln so'm amal qiladi.", ru: "30.09.2026 Президент объявил о повышении лимита для частных школ до 6 млн сумов. На 26.10.2026 нормативный акт не вышел — пока действует 3 млн сумов." },
  },
  {
    id: "mulk", short: { uz: "Yer", ru: "Земля" },
    title: { uz: "Mol-mulk va yer solig'i imtiyozlari: yangi shart", ru: "Льготы по налогу на имущество и землю: новое условие" },
    sub: { uz: "2026 yildan imtiyozdan foydalanish uchun xodim va ish haqi talabi", ru: "С 2026 года для льготы нужны работники и уровень зарплаты" },
    rows: [
      [{ uz: "Kimga", ru: "Кому" }, { uz: "Mol-mulk va yer solig'i imtiyozidan foydalanayotgan yuridik shaxslar", ru: "Юрлицам, пользующимся льготами по налогу на имущество и землю" }],
      [{ uz: "Shartlar (hammasi birga)", ru: "Условия (все одновременно)" }, { uz: "Yillik o'rtacha xodimlar soni kamida 3 nafar; har bir xodimning ish haqi kamida 2 MHTEKM; sotishdan tushum imtiyoz summasidan ko'p", ru: "Среднегодовая численность — не менее 3 человек; зарплата каждого — не ниже 2 МРОТ; выручка от реализации больше суммы льготы" }],
      [{ uz: "Talab qo'llanmaydi", ru: "Не применяется к" }, { uz: "Byudjet va notijorat tashkilotlar, to'g'ridan-to'g'ri xorijiy investitsiyali korxonalar, MTBK ishtirokchilari, 1.01.2026 holatiga EIZ ishtirokchilari, nogironlar jamiyatlari tashkil etgan korxonalar", ru: "Бюджетным и некоммерческим организациям, предприятиям с прямыми иностранными инвестициями, участникам СРП, участникам СЭЗ на 01.01.2026, предприятиям обществ инвалидов" }],
      [{ uz: "Qachondan", ru: "С какого момента" }, { uz: "Yil yakuni bo'yicha tekshiriladi; yil davomida tashkil etilganlar — keyingi yil oxiridan", ru: "Проверяется по итогам года; созданные в течение года — с конца следующего года" }],
    ],
    plus: [
      { uz: "Yangi (12.10.2026, PQ-368): transport-logistika markazlari yer va mol-mulk solig'idan 2040 yilgacha to'liq ozod. Shart: ESKATO quruqlik portlari bitimi ro'yxatida bo'lish, TOS va WMS tizimlari, «E-logistika» platformasida «BB» va undan yuqori reyting", ru: "Новое (12.10.2026, ПП-368): транспортно-логистические центры полностью освобождены от земельного налога и налога на имущество до 2040 года. Условия: включение в соглашение ЭСКАТО о сухих портах, системы TOS и WMS, рейтинг «BB» и выше на платформе «E-logistika»" },
      { uz: "Yangi (13.10.2026, PQ-371): issiqxona xo'jaliklari — daromadning kamida 60% issiqxonadan bo'lsa, 1.01.2027–1.01.2030 yuridik shaxslardan yer solig'i va mol-mulk solig'i stavkalari 50% kamaytiriladi, aylanmadan olinadigan soliqdan to'liq ozod", ru: "Новое (13.10.2026, ПП-371): тепличные хозяйства — при доле дохода от теплиц не менее 60% с 01.01.2027 по 01.01.2030 ставки земельного налога с юрлиц и налога на имущество снижаются на 50%, полное освобождение от налога с оборота" },
    ],
  },
];
