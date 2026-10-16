/* Buxgalter ma'lumotnomasi: tashkiliy-huquqiy shakllar va 2026 soliq qoidalari (bosh sahifada, yig'ilgan holda).
   Holat: 16.10.2026. O'zgarsa — shu faylni yangilang (UPDATED sanasi bilan). */
export const UPDATED = "16.10.2026";
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
];
