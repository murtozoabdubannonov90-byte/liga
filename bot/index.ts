// Hisobchi Liga — Telegram bot (@Buxgalterlar_Ligasi_bot)
// Token Supabase Secrets'da: TELEGRAM_BOT_TOKEN. Kodda token yo'q.
// Jamoalar: har bir Telegram guruh /ulash KOD bilan bitta jamoaga bog'lanadi; natijalar va bosqich xabarlari jamoa bo'yicha.
import { createClient } from "npm:@supabase/supabase-js@2";
import { adReason, mentionsOf } from "./reklama.ts";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP = "https://murtozoabdubannonov90-byte.github.io/liga/";
const BOT = "Buxgalterlar_Ligasi_bot";
const deep = (code?: string) => `https://t.me/${BOT}?start=${code && code !== "ASOSIY" ? "g_" + code : "liga"}`;
const appUrl = (code?: string) => code && code !== "ASOSIY" ? `${APP}?g=${encodeURIComponent(code)}` : APP;

async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return await r.json();
}
async function hookSecret() {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("liga:" + TOKEN));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
const openApp = (code?: string) => ({ inline_keyboard: [[{ text: "🏆 Ligani ochish", web_app: { url: appUrl(code) } }]] });
const openBot = (code?: string) => ({ inline_keyboard: [[{ text: "🏆 Ligani ochish", url: deep(code) }]] });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------- tillar ----------------
const CYR1: Record<string, string> = { a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в" };
function cyrWord(w: string) {
  const s = w.replace(/[ʻʼ‘’`]/g, "'"), low = s.toLowerCase(); let out = "";
  for (let i = 0; i < low.length; i++) {
    const c = low[i], n = low[i + 1], n2 = low[i + 2], prev = out[out.length - 1]; let r = "";
    if ((c === "o" || c === "g") && n === "'") { r = c === "o" ? "ў" : "ғ"; i++; }
    else if (c === "s" && n === "h") { r = "ш"; i++; } else if (c === "c" && n === "h") { r = "ч"; i++; }
    else if (c === "y" && n === "o" && n2 !== "'") { r = "ё"; i++; } else if (c === "y" && n === "u") { r = "ю"; i++; }
    else if (c === "y" && n === "a") { r = "я"; i++; } else if (c === "y" && n === "e") { r = "е"; i++; }
    else if (c === "e") r = (i === 0 || (prev !== undefined && "аоиуўеэёюя".includes(prev))) ? "э" : "е";
    else if (c === "'") r = "ъ"; else r = CYR1[c] ?? c;
    out += r;
  }
  if (s.length > 1 && s === s.toUpperCase() && /[A-Z]/.test(s)) return out.toUpperCase();
  return /^[A-Z]/.test(s) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}
const cyr = (t: string) => t.replace(/(<[^>]*>|@[A-Za-z0-9_]+|https?:\/\/\S+|XP|[A-Za-z][A-Za-z'ʻʼ‘’`]*[A-Za-z]|[A-Za-z])/g, (m) => (m[0] === "<" || m[0] === "@" || m.startsWith("http") || m === "XP" ? m : cyrWord(m)));
// shaxsiy xabarlar: o'zbekcha matn kalit, rus tarjimasi shu yerda
const RU: Record<string, string> = {
  "⏰ <b>{n}, bugungi bosqich hali bajarilmagan!</b>\n{s}-bosqich soat {c} da yopiladi — 1 soat qoldi.": "⏰ <b>{n}, сегодняшний этап ещё не пройден!</b>\nЭтап {s} закроется в {c} — остался 1 час.",
  "Jamoangizdan {p} kishi bugungi bosqichni bajarib bo'ldi.": "Из вашей команды сегодняшний этап уже прошли: {p}.",
  "✅ <b>{s}-bosqich yakunlandi!</b>\n🎯 {r}/{t} to'g'ri {st}\n💰 Bosqich bali: <b>{x}</b>\n📊 Shu hafta jami: <b>{w} ball</b>\n\n{next}": "✅ <b>Этап {s} пройден!</b>\n🎯 Верно: {r}/{t} {st}\n💰 Баллы за этап: <b>{x}</b>\n📊 Всего за неделю: <b>{w} баллов</b>\n\n{next}",
  "Ertaga 09:00 da yangi bosqich ochiladi.": "Завтра в 09:00 откроется новый этап.",
  "Dushanba 09:00 da yangi bosqich ochiladi.": "В понедельник в 09:00 откроется новый этап.",
  "Liga bugun 17:00 da yakunlanadi — natijalar shu yerga keladi.": "Лига завершится сегодня в 17:00 — результаты придут сюда.",
  "Natijalar juma 17:00 da shu yerga keladi.": "Результаты придут сюда в пятницу в 17:00.",
  "☀️ <b>Xayrli tong, {n}!</b>\nBugun <b>{s}-bosqich</b> ochildi — 20 savol.\n⏰ Soat {c} gacha ochiq.": "☀️ <b>Доброе утро, {n}!</b>\nСегодня открыт <b>этап {s}</b> — 20 вопросов.\n⏰ Открыт до {c}.",
  "Bosqichni boshlash": "Начать этап",
  "📢 <b>Hisobchi Liga — muhim yangiliklar!</b>\n\n1️⃣ <b>Ertadan (14-oktabr) yangi kunlik reja:</b> har kuni o'z mavzusi — 15 provodka + 5 qonun savoli (Soliq kodeksi, Prezident farmon va qarorlari). Oy oxirigacha osondan qiyinga.\n\n2️⃣ <b>Oktabr reytingi 12-oktabr (dushanba)dan hisoblanmoqda</b> — undan oldingi ballar kirmaydi. Har bir bosqich bali muhim!\n\n3️⃣ 🏆 <b>Katta final — 28-dekabr:</b> oktabr va noyabrning kuchli uchligi (6 kishi) bellashadi.\n\n4️⃣ ⚔️ <b>Kunlik duel kubogi</b> 09:00 dan boshlanadi, final — 17:00 da (13:00–14:00 — tanaffus).\n\n5️⃣ 🥇🥈🥉 Haftalik kuchli uchlikka o'ringa qarab <b>medal va QR kodli sertifikat</b> — juma kuni avtomatik beriladi.\n\n6️⃣ Endi «XP» o'rniga <b>ball</b> deymiz — har bir to'g'ri javob uchun beriladigan ochko. Reyting shu ball bo'yicha.\n\nErtaga soat 09:00 da — 1-kun: «Kassa va bank». Omad! 💪": "📢 <b>Hisobchi Liga — важные новости!</b>\n\n1️⃣ <b>С завтрашнего дня (14 октября) — новый план:</b> у каждого дня своя тема — 15 проводок + 5 вопросов по законодательству (Налоговый кодекс, указы и постановления Президента). До конца месяца — от простого к сложному.\n\n2️⃣ <b>Рейтинг октября считается с 12 октября (понедельник)</b> — более ранние баллы не учитываются. Важен балл каждого этапа!\n\n3️⃣ 🏆 <b>Большой финал — 28 декабря:</b> сразятся тройки октября и ноября (6 человек).\n\n4️⃣ ⚔️ <b>Кубок дуэлей дня</b> начинается в 09:00, финал — в 17:00 (13:00–14:00 — перерыв).\n\n5️⃣ 🥇🥈🥉 Тройке недели — <b>медаль по месту и сертификат с QR-кодом</b>, выдаются автоматически в пятницу.\n\n6️⃣ Вместо «XP» теперь говорим <b>баллы</b> — очки за каждый верный ответ. Рейтинг считается по баллам.\n\nЗавтра в 09:00 — день 1: «Касса и банк». Удачи! 💪",
  "{m} <b>Tabriklaymiz, {n}! Siz haftalik ligada {p}-o'rinni egalladingiz.</b>\nMedalingiz va QR kodli sertifikatingiz tayyor — uni ish beruvchingizga ham ko'rsatishingiz mumkin.": "{m} <b>Поздравляем, {n}! Вы заняли {p}-е место в недельной лиге.</b>\nВаша медаль и сертификат с QR-кодом готовы — его можно показать и работодателю.",
  "Sertifikatni ochish": "Открыть сертификат",
  "☀️ <b>Xayrli tong, {n}!</b>\nBugun <b>{s}-bosqich: «{t}»</b> ochildi — 15 provodka + 5 qonun savoli.\n⏰ Soat {c} gacha ochiq.": "☀️ <b>Доброе утро, {n}!</b>\nСегодня открыт <b>этап {s}: «{t}»</b> — 15 проводок + 5 вопросов по законодательству.\n⏰ Открыт до {c}.",
  "🏁 <b>Hafta yakunlandi!</b>\n{m} Siz jamoada <b>{p}-o'rin</b>ni egalladingiz ({n} kishidan).\n💰 Haftalik ball: <b>{x}</b>\n\nDarajangiz 12:10 da yangilanadi. Yangi hafta dushanba 09:00 da.": "🏁 <b>Неделя завершена!</b>\n{m} Ваше место в команде: <b>{p}</b> (из {n}).\n💰 Баллы за неделю: <b>{x}</b>\n\nУровень обновится в 12:10. Новая неделя — в понедельник в 09:00.",
  "🏁 <b>Hafta yakunlandi.</b>\nBu hafta bosqich o'ynamadingiz. Dushanba 09:00 da yangi hafta — qaytib keling! 💪": "🏁 <b>Неделя завершена.</b>\nНа этой неделе вы не проходили этапы. Новая неделя — в понедельник в 09:00, возвращайтесь! 💪",
  "Natijalarni ko'rish": "Посмотреть результаты",
  "✅ <b>Ulandi!</b>\nEndi har bosqichdan keyin natijangiz, ertalab bosqich eslatmasi va juma kuni o'rningiz shu yerga keladi.": "✅ <b>Подключено!</b>\nТеперь после каждого этапа сюда придёт ваш результат, утром — напоминание об этапе, а в пятницу — ваше место.",
  "Ligani ochish": "Открыть лигу",
  "📅 <b>Soliq taqvimi</b>": "📅 <b>Налоговый календарь</b>",
  "{d} ({n} kun qoldi)": "{d} (осталось дней: {n})",
  "{d} (ertaga)": "{d} (завтра)",
  "Muddatni o'tkazib yubormang — jarima bo'lmasin!": "Не пропустите срок — без штрафов!",
  "Mashq qilish": "Потренироваться",
  "{m} <b>Tabriklaymiz! Siz bugungi bosqichda {p}-o'rin oldingiz.</b>\nShu ruhda davom eting — haftalik kuchli uchlik medal va sertifikat oladi.": "{m} <b>Поздравляем! Сегодня вы заняли {p}-е место в этапе.</b>\nТак держать — тройка недели получает медаль и сертификат.",
  "ertaga": "завтра", "dushanba kuni": "в понедельник",
  "✅ <b>Kirish tasdiqlandi!</b>\nIlovaga qayting — avtomatik kirasiz.": "✅ <b>Вход подтверждён!</b>\nВернитесь в приложение — вход выполнится автоматически.",
  "Bosqichni ochish": "Открыть этап",
  "⚔️ <b>Duel yakunlandi!</b>\n{a} — {as} · {b} — {bs}\n\n{w}": "⚔️ <b>Дуэль завершена!</b>\n{a} — {as} · {b} — {bs}\n\n{w}",
  "🏆 Siz yutdingiz!": "🏆 Вы победили!", "Bu safar raqib kuchliroq. Yana chaqiring!": "В этот раз соперник сильнее. Вызовите ещё раз!", "🤝 Durang!": "🤝 Ничья!",
  "⚔️ <b>{n} duelingizni qabul qildi va o'ynadi.</b>\nEndi navbat sizda!": "⚔️ <b>{n} принял(а) ваш вызов и сыграл(а).</b>\nТеперь ваша очередь!",
  "Duelni ochish": "Открыть дуэль",
  "⚔️ <b>Sizni duelga chaqirishdi!</b>\n10 ta savol: kim ko'proq to'g'ri topsa — g'olib, teng bo'lsa tezrog'i.": "⚔️ <b>Вас вызвали на дуэль!</b>\n10 вопросов: побеждает тот, кто ответит правильно на большее число, при равенстве — кто быстрее.",
  "Duelga kirish": "Принять дуэль",
  "⚡ <b>Sizni jonli duelga chaqirishdi!</b>\n10 ta savol, ikkalangiz bir vaqtda o'ynaysiz: kim birinchi to'g'ri topsa — ochko o'shaniki.": "⚡ <b>Вас вызвали на живую дуэль!</b>\n10 вопросов, вы играете одновременно: очко получает тот, кто первым ответит верно.",
  "👋 <b>Hisobchi Liga</b>ga xush kelibsiz!\nDo'stingiz sizni taklif qildi. Ro'yxatdan o'ting — haftalik ligada bellashamiz.": "👋 Добро пожаловать в <b>Hisobchi Liga</b>!\nВас пригласил друг. Зарегистрируйтесь — и соревнуйтесь в еженедельной лиге.",
  "Ro'yxatdan o'tish": "Зарегистрироваться",
  "🏅 <b>Tabriklaymiz! Siz {t} ligaga ko'tarildingiz.</b>": "🏅 <b>Поздравляем! Вы поднялись в лигу «{t}».</b>",
  "Siz {t} ligaga tushdingiz. Bu hafta ko'proq bosqich bajaring — qaytasiz!": "Вы опустились в лигу «{t}». Пройдите больше этапов на этой неделе — и вернётесь!",
  "Mening natijam — Hisobchi Liga 🏆\nSiz ham qo'shiling:": "Мой результат — Hisobchi Liga 🏆\nПрисоединяйтесь:",
  "Kartochkangiz tayyor — endi uni istalgan chatga yuborishingiz mumkin.": "Карточка готова — теперь её можно отправить в любой чат.",
  "Ligaga qo'shilish": "Присоединиться",
  "⚔️ <b>Bugungi duelingiz</b>\nRaqib: <b>{o}</b>\n⏰ Soat <b>{s}</b> da boshlanadi (1 soat ochiq).\n📒 Faqat provodka, 10 savol. Kim birinchi to'g'ri topsa — ochko o'shaniki.\nKechagi bosqich: siz — {m}, raqib — {r} ball.": "⚔️ <b>Ваша дуэль сегодня</b>\nСоперник: <b>{o}</b>\n⏰ Начало в <b>{s}</b> (открыта 1 час).\n📒 Только проводки, 10 вопросов. Кто первым ответит верно — получает очко.\nВчерашний этап: вы — {m}, соперник — {r} баллов.",
  "⚔️ <b>Bugungi duellar jadvali</b>": "⚔️ <b>Расписание дуэлей на сегодня</b>",
  "👉 Sizning duelingiz: soat <b>{s}</b>, raqib — <b>{o}</b>.\n📒 Faqat provodka, 10 savol, har biriga 1 daqiqa. Kim birinchi to'g'ri topsa — ochko o'shaniki. Duel 1 soat ochiq.": "👉 Ваша дуэль: в <b>{s}</b>, соперник — <b>{o}</b>.\n📒 Только проводки, 10 вопросов, по 1 минуте. Кто первым ответит верно — получает очко. Дуэль открыта 1 час.",
  "⏳ <b>Duelga 5 daqiqa qoldi!</b>\nSoat {s} da raqibingiz <b>{o}</b> bilan bellashasiz. Ilovani oching.": "⏳ <b>До дуэли 5 минут!</b>\nВ {s} вы соревнуетесь с <b>{o}</b>. Откройте приложение.",
  "🏆 <b>Bugungi duel kubogi</b>\nFaqat provodka · 15 savol · har biriga 1,5 daqiqa · har duel 30 daqiqa ochiq. G'olib keyingi bosqichga o'tadi.": "🏆 <b>Кубок дуэлей дня</b>\nТолько проводки · 15 вопросов · по 1,5 минуты · каждая дуэль открыта 30 минут. Победитель проходит дальше.",
  "🗓 <b>Kun jadvali</b>": "🗓 <b>Расписание дня</b>",
  "{at} — {st} ({d} duel)": "{at} — {st} ({d} дуэл.)",
  "Raundning barcha duellari bir vaqtda o'ynaladi. 12:00–14:00 — tanaffus. Raund erta tugasa ham, keyingisi jadvaldagi vaqtda boshlanadi.": "Все дуэли раунда играются одновременно. 12:00–14:00 — перерыв. Даже если раунд закончится раньше, следующий начнётся по расписанию.",
  "➡️ Keyingi raundga avtomatik o'tdi: {n}": "➡️ Автоматически прошли в следующий раунд: {n}",
  "Bugun <b>{n}</b> kishi qatnashadi: 1-raundda {d} ta duel bir vaqtda o'ynaladi.": "Сегодня участвуют <b>{n}</b> человек: в 1-м раунде одновременно играются {d} дуэлей.",
  "✅ <b>Siz saralashsiz keyingi raundga o'tdingiz!</b>\nOxirgi 7 kundagi bosqich balingiz yuqori bo'lgani uchun saralash duelini o'ynamaysiz. Keyingi duelingiz — soat <b>{s}</b> ({st}). Raqib saralash tugagach ma'lum bo'ladi, bot xabar beradi.": "✅ <b>Вы прошли в следующий раунд без отбора!</b>\nУ вас высокий балл этапов за последние 7 дней, поэтому отборочную дуэль вы не играете. Следующая дуэль — в <b>{s}</b> ({st}). Соперник станет известен после отбора, бот сообщит.",
  "👉 Sizning duelingiz ({st}): soat <b>{s}</b>, raqib — <b>{o}</b>.": "👉 Ваша дуэль ({st}): в <b>{s}</b>, соперник — <b>{o}</b>.",
  "🎉 <b>Siz {st}ga chiqdingiz!</b>\nRaqib: <b>{o}</b>, soat <b>{s}</b>. Faqat provodka, 15 savol, har biriga 1,5 daqiqa. Duel 30 daqiqa ochiq.": "🎉 <b>Вы вышли в {st}!</b>\nСоперник: <b>{o}</b>, в <b>{s}</b>. Только проводки, 15 вопросов, по 1,5 минуты. Дуэль открыта 30 минут.",
  "🏆 <b>Bugungi duel kubogi g'olibi — {n}!</b>\nTabriklaymiz! Keyingi kubok — keyingi ish kuni: juftlar 09:00 da, duellar 10:00 dan.": "🏆 <b>Победитель кубка дуэлей дня — {n}!</b>\nПоздравляем! Следующий кубок — в следующий рабочий день: пары в 09:00, дуэли с 10:00.",
  "{st} — {s} dan (g'oliblar)": "{st} — с {s} (победители)",
  "✅ <b>To'lovingiz tasdiqlandi!</b>\nBosqichlar ochildi. Obuna: <b>{d}</b> gacha. Omad! 💪": "✅ <b>Оплата подтверждена!</b>\nЭтапы открыты. Подписка до <b>{d}</b>. Удачи! 💪",
  "❌ <b>To'lov chekingiz tasdiqlanmadi</b> — pul kartaga tushmagan.\nBosqichlar yopiq. Haqiqatan to'lagan bo'lsangiz, administratorga yozing: @murtozo_44": "❌ <b>Чек не подтверждён</b> — деньги на карту не поступили.\nЭтапы закрыты. Если вы действительно оплатили, напишите администратору: @murtozo_44",
  "🔔 <b>Duel boshlandi!</b>\nRaqibingiz <b>{o}</b>. Soat {e} gacha kiring — kelmasangiz, duel raqibga beriladi.": "🔔 <b>Дуэль началась!</b>\nВаш соперник — <b>{o}</b>. Зайдите до {e} — иначе победа достанется сопернику.",
  "Raqib bilan bog'lanish:": "Связь с соперником:",
  "ℹ️ <b>Bugun ishtirokchilar soni toq bo'ldi</b> — eng oxirgi qo'shilgan siz bo'lganingiz uchun bugungi kubokda juftingiz yo'q. <b>Ertadan kubokda qatnashasiz.</b> Kunlik bosqich odatdagidek ochiq — o'ynashni unutmang!": "ℹ️ <b>Сегодня число участников нечётное</b> — вы присоединились последним, поэтому сегодня в кубке у вас нет пары. <b>С завтрашнего дня вы участвуете в кубке.</b> Ежедневный этап открыт как обычно — не забудьте сыграть!",
  "💬 Guruhga qo'shilish": "💬 Вступить в группу",
  "💬 <b>{n}, Hisobchi Liga ishtirokchilari guruhi ochildi!</b>\nSavollar, provodkalar va duellarni shu yerda muhokama qilamiz, raqibingiz bilan kelishib olasiz. Qo'shiling:": "💬 <b>{n}, открылась группа участников Hisobchi Liga!</b>\nЗдесь обсуждаем вопросы, проводки и дуэли, договариваемся с соперником. Присоединяйтесь:",
  "🕛 <b>{n}, bugungi {s}-bosqich hali bajarilmagan.</b>\nSoat {c} gacha vaqt bor — hozir 10–15 daqiqa ajrating, keyin unutib qo'yasiz.": "🕛 <b>{n}, сегодняшний этап {s} ещё не пройден.</b>\nВремя есть до {c} — уделите 10–15 минут сейчас, потом забудете.",
  "Jamoangizdan {p} kishi bugun bajarib bo'ldi.": "Из вашей команды сегодня уже прошли: {p}.",
  "Musobaqaga kirish": "Войти в турнир",
  "⚖️ Hamma o'ynaydi. G'oliblardan keyingi bosqichga ochkosi eng ko'p {k} kishi o'tadi, keyin har raundda juftsiz odam qolmaydi.": "⚖️ Играют все. Из победителей дальше проходят {k} с наибольшими очками, затем в каждом раунде без пары никто не остаётся.",
  "🏁 <b>{n}, siz duelda yutdingiz, lekin bugun keyingi bosqichga chiqa olmadingiz.</b>\nBu raundda {w} kishi yutdi — keyingi bosqichga ochkosi eng ko'p {k} kishi o'tadi (teng ochkoda — tezroq javob bergan). Sizning ochkongiz: {p}.\nErtaga yana kubok — omad!": "🏁 <b>{n}, вы выиграли дуэль, но сегодня не прошли дальше.</b>\nВ этом раунде победили {w} чел. — дальше проходят {k} с наибольшими очками (при равенстве — кто быстрее). Ваши очки: {p}.\nЗавтра снова кубок — удачи!",
  "➡️ Saralashsiz keyingi raundga o'tdi — {c} kishi (oxirgi 7 kundagi bosqich bali eng yuqorilar): {n}": "➡️ Без отбора в следующий раунд прошли {c} чел. (лучшие по баллам этапов за 7 дней): {n}",
  "Bugun <b>{n}</b> kishi qatnashadi: saralashda {d} ta duel, {b} kishi (oxirgi 7 kundagi bosqich bali bo'yicha) saralashsiz keyingi raundga o'tdi. Keyingi raundlarda juftsiz odam qolmaydi.": "Сегодня участвуют <b>{n}</b> чел.: в отборе {d} дуэлей, {b} чел. (по баллам этапов за 7 дней) прошли в следующий раунд без отбора. Дальше без пары никто не останется.",
  "👤 <b>{n}, Telegram'da nikingiz (username) yo'q.</b>\nKubok duelida raqibingiz sizga Telegram'da yoza olishi uchun nik kerak — hozir sizni topib bo'lmayapti.\n\n<b>Nik qo'yish (1 daqiqa):</b>\n1. Telegram → <b>Sozlamalar</b> (Settings / Настройки)\n2. <b>Foydalanuvchi nomi</b> (Username / Имя пользователя)\n3. Nik yozing, masalan: <code>{ex}</code> → ✓\n\nKeyin pastdagi tugmani bosing.": "👤 <b>{n}, у вас в Telegram нет имени пользователя (username).</b>\nОно нужно, чтобы соперник по дуэли кубка мог вам написать — сейчас вас нельзя найти.\n\n<b>Как поставить (1 минута):</b>\n1. Telegram → <b>Настройки</b> (Settings)\n2. <b>Имя пользователя</b> (Username)\n3. Введите ник, например: <code>{ex}</code> → ✓\n\nЗатем нажмите кнопку ниже.",
  "✅ Nik qo'ydim — tekshirish": "✅ Ник поставил — проверить",
  "Nik hali ko'rinmayapti. Sozlamalar → Foydalanuvchi nomi bo'limida nik yozib, ✓ ni bosing, keyin qayta tekshiring.": "Ник пока не виден. Настройки → Имя пользователя: введите ник, нажмите ✓ и проверьте снова.",
  "✅ <b>Rahmat! Nikingiz saqlandi: @{u}</b>\nEndi duel raqibingiz sizga Telegram'da yoza oladi.": "✅ <b>Спасибо! Ник сохранён: @{u}</b>\nТеперь соперник по дуэли сможет вам написать.",
  "Saqlandi": "Сохранено",
  "👋 <b>{n}, ligaga xush kelibsiz!</b>\nSiz ro'yxatdan o'tgansiz, lekin hali birorta bosqich o'ynamadingiz.\n\nBugun <b>{s}-bosqich</b> ochiq: 20 savol, taxminan 15 daqiqa. Natijangiz faqat sizga ko'rinadi — bemalol sinab ko'ring.\n⏰ Soat {c} gacha.": "👋 <b>{n}, добро пожаловать в лигу!</b>\nВы зарегистрированы, но ещё не прошли ни одного этапа.\n\nСегодня открыт <b>этап {s}</b>: 20 вопросов, примерно 15 минут. Результат видите только вы — смело пробуйте.\n⏰ До {c}.",
  "👋 <b>{n}, birinchi bosqichingizni boshlang!</b>\nBugungi {s}-bosqich soat {c} gacha ochiq. 15 daqiqa ajrating — xato qilsangiz, to'g'ri javob va tushuntirish ko'rsatiladi.": "👋 <b>{n}, начните свой первый этап!</b>\nСегодняшний этап {s} открыт до {c}. Уделите 15 минут — при ошибке покажем правильный ответ и объяснение.",
  "⏰ <b>{n}, bugungi bosqich yopilishiga 1 soat qoldi.</b>\nHali birorta bosqich o'ynamadingiz — hoziroq birinchisini boshlang, 15 daqiqa yetadi.": "⏰ <b>{n}, до закрытия этапа остался 1 час.</b>\nВы ещё не прошли ни одного этапа — начните первый сейчас, хватит 15 минут.",
  "☀️ <b>{n}, sizni sog'indik!</b>\nBir necha kundan beri bosqich o'ynamadingiz. Bugun <b>{s}-bosqich</b> ochiq — haftalik ligaga qayting.\n⏰ Soat {c} gacha.": "☀️ <b>{n}, мы скучали!</b>\nВы несколько дней не проходили этапы. Сегодня открыт <b>этап {s}</b> — возвращайтесь в недельную лигу.\n⏰ До {c}.",
  "🕛 <b>{n}, bugun qaytasizmi?</b>\n{s}-bosqich soat {c} gacha ochiq. Har kuni bitta bosqich — haftalik ligada o'rningizni saqlaysiz.": "🕛 <b>{n}, вернётесь сегодня?</b>\nЭтап {s} открыт до {c}. Один этап в день — и вы сохраните место в недельной лиге.",
};
const TIER_UZ = ["Bronza", "Kumush", "Oltin", "Olmos"], TIER_RU = ["Бронза", "Серебро", "Золото", "Алмаз"];
function tr(lang: string | null | undefined, uz: string, v: Record<string, string | number> = {}) {
  let s = lang === "ru" ? (RU[uz] ?? uz) : lang === "uzc" ? cyr(uz) : uz;
  for (const k in v) s = s.split("{" + k + "}").join(String(v[k]));
  return s;
}
// Telegram Mini App initData tekshiruvi (bot tokeni bilan HMAC)
async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}
async function checkInit(initData: string): Promise<any | null> {
  if (!initData) return null;
  const p = new URLSearchParams(initData), hash = p.get("hash"); if (!hash) return null; p.delete("hash");
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => k + "=" + v).join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), TOKEN);
  const calc = [...await hmac(secret, dcs)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (calc !== hash) return null;
  if (Date.now() / 1000 - Number(p.get("auth_date") || 0) > 86400 * 7) return null;
  try { return JSON.parse(p.get("user") || "null"); } catch { return null; }
}
const appBtn = (text: string, q = "") => ({ inline_keyboard: [[{ text, web_app: { url: APP + q } }]] });
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
// har ish kuni (juma ham) — bosqich 17:00 gacha; liga juma 17:00 da tugaydi
const closeStr = (_w: number) => "17:00";
const stars = (n: number) => (n > 0 ? "⭐".repeat(Math.min(3, n)) : "");
// bugun jamoada nechta kishi bosqichni o'ynadi
async function todayCounts(): Promise<Record<string, { played: number; total: number }>> {
  const { data } = await db.rpc("liga_today_counts"); const m: Record<string, { played: number; total: number }> = {};
  for (const r of (data ?? []) as any[]) m[r.group_code] = { played: r.played, total: r.total };
  return m;
}
// shaxsiy xabar (bot bloklangan bo'lsa jim o'tadi); Telegram cheklovi: sekundiga ~25 ta
async function dm(chat: number, text: string, kb?: unknown) {
  const r = await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text, reply_markup: kb }); await pause(45); return !!r?.ok;
}
// kunning savoli — guruhga Telegram "quiz" so'rovnomasi (public/polls.json, ilova bilan bir xil savollar)
let POLLS: { uz: any[]; ru: any[] } | null = null;
async function sendDailyPoll(chat: number) {
  try { if (!POLLS) POLLS = await (await fetch(APP + "polls.json")).json(); } catch { return false; }
  const list = POLLS?.uz ?? []; if (!list.length) return false;
  const day = Math.round((tzDate().getTime() - Date.UTC(2026, 9, 1)) / 864e5);
  const q = list[((day * 37) % list.length + list.length) % list.length];
  // variantlar tartibi har kuni boshqacha, to'g'ri javob doim birinchi bo'lmasin
  const idx = q.o.map((_: string, i: number) => i); let seed = day * 9301 + 49297;
  for (let i = idx.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor((seed / 233280) * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const head = "📚 Kunning savoli: ";
  const r = await tg("sendPoll", { chat_id: chat, question: (head + q.q).slice(0, 300), options: idx.map((i: number) => ({ text: q.o[i] })), type: "quiz",
    correct_option_id: idx.indexOf(q.a), explanation: q.e || undefined, is_anonymous: true });
  return !!r?.ok;
}

const OY_UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const OY_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dayName = (d: Date, lang?: string | null) => lang === "ru" ? `${d.getUTCDate()} ${OY_RU[d.getUTCMonth()]}` : tr(lang, `${d.getUTCDate()}-${OY_UZ[d.getUTCMonth()]}`);
// soliq taqvimi: bugundan 1..3 kun ichidagi muddatlar (3 va 1 kun oldin eslatiladi; juma — dam olish kunlariga to'g'ri keladiganlar ham)
async function taxDue() {
  const { data } = await db.from("liga_tax_cal").select("id,day,months,title_uz,title_ru,topic").eq("active", true);
  const today = tzDate(), w = today.getUTCDay(), offs = w === 5 ? [1, 2, 3] : [1, 3], out: any[] = [];
  for (const n of offs) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() + n);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    for (const c of (data ?? []) as any[]) {
      const day = Math.min(c.day, last);
      if (day === d.getUTCDate() && (!c.months?.length || c.months.includes(d.getUTCMonth() + 1))) out.push({ ...c, date: d, n });
    }
  }
  return out;
}
// kunning kuchli uchligi: mukofot — keyingi ish kuni har savolga qo'shimcha vaqt
const EXTRA = [10, 7, 4], MEDAL = ["🥇", "🥈", "🥉"];
async function dayTop(code: string) {
  const { data } = await db.rpc("liga_day_top_sys", { p_code: code, p_day: tzDate().toISOString().slice(0, 10) });
  return (data ?? []) as any[];
}
function dayTopText(top: any[], w: number) {
  const when = w === 5 ? "dushanba kuni" : "ertaga";
  void when;
  return `🏅 <b>Bugungi kuchli uchlik</b>\n${top.map((x) => `${MEDAL[x.pos - 1]} ${esc(x.name)}`).join("\n")}\n\nTabriklaymiz! Haftalik kuchli uchlik medal nishoni va sertifikat oladi.`;
}
async function dayTopDm(top: any[], w: number) {
  let n = 0;
  for (const x of top) {
    if (!x.tg) continue;
    const when = tr(x.lang, w === 5 ? "dushanba kuni" : "ertaga");
    void when;
    if (await dm(x.tg, tr(x.lang, "{m} <b>Tabriklaymiz! Siz bugungi bosqichda {p}-o'rin oldingiz.</b>\nShu ruhda davom eting — haftalik kuchli uchlik medal va sertifikat oladi.",
      { m: MEDAL[x.pos - 1], p: x.pos }), appBtn(tr(x.lang, "Ligani ochish")))) n++;
  }
  return n;
}
// duel kubogi: bosqich nomlari va jadval matni
const STAGE_UZ: Record<string, string> = { qual: "1-raund", r256: "1/128 final", r128: "1/64 final", r64: "1/32 final", r32: "1/16 final", r16: "1/8 final", quarter: "Chorak final", semi: "Yarim final", final: "Final" };
const STAGE_RU: Record<string, string> = { qual: "1-й раунд", r256: "1/128 финала", r128: "1/64 финала", r64: "1/32 финала", r32: "1/16 финала", r16: "1/8 финала", quarter: "Четвертьфинал", semi: "Полуфинал", final: "Финал" };
const STAGE_RU_ACC: Record<string, string> = { qual: "1-й раунд", r64: "1/32 финала", r32: "1/16 финала", r16: "1/8 финала", quarter: "четвертьфинал", semi: "полуфинал", final: "финал" };
const stageName = (st: string, lang?: string | null) => {
  const ru = lang === "ru", m = (ru ? STAGE_RU : STAGE_UZ)[st]; if (m) return m;
  const k = /^r(\d+)$/.exec(st); const n = k ? Number(k[1]) : 0;
  return n >= 4 ? (ru ? `1/${n / 2} финала` : `1/${n / 2} final`) : (ru ? "Раунд" : "Raund");
};
const stageTo = (st: string, lang?: string | null) => (lang === "ru" ? STAGE_RU_ACC[st] ?? stageName(st, lang) : stageName(st, lang).toLowerCase());
async function cupBoard() {
  const { data } = await db.rpc("liga_cup_board_sys"); const by: Record<string, any[]> = {};
  for (const x of (data ?? []) as any[]) (by[x.group_code] ??= []).push(x);
  return by;
}
// bugun 1-raunddan avtomatik o'tganlar (guruh bo'yicha)
async function cupByes() {
  const { data } = await db.rpc("liga_cup_byes_sys"); const by: Record<string, any[]> = {};
  for (const x of (data ?? []) as any[]) (by[x.group_code] ??= []).push(x);
  return by;
}
// kun jadvali: ishtirokchilar soniga qarab raundlar va vaqtlari
async function cupPlan(n: number) {
  if (n < 2) return [] as any[];
  const { data } = await db.rpc("liga_cup_timetable", { p_n: n });
  return (data ?? []) as any[];
}
function planText(plan: any[], lang?: string | null) {
  if (!plan.length) return "";
  const L = ["\n" + tr(lang, "🗓 <b>Kun jadvali</b>")];
  for (const t of plan) L.push(tr(lang, "{at} — {st} ({d} duel)", { at: String(t.at).slice(0, 5), st: stageName(t.stage, lang), d: t.duels }));
  L.push(tr(lang, "Raundning barcha duellari bir vaqtda o'ynaladi. 12:00–14:00 — tanaffus. Raund erta tugasa ham, keyingisi jadvaldagi vaqtda boshlanadi."));
  if (plan[1] && plan[0].duels > plan[1].duels * 2) L.push(tr(lang, "⚖️ Hamma o'ynaydi. G'oliblardan keyingi bosqichga ochkosi eng ko'p {k} kishi o'tadi, keyin har raundda juftsiz odam qolmaydi.", { k: plan[1].duels * 2 }));
  return L.join("\n");
}
const HEAD = "🏆 <b>Bugungi duel kubogi</b>\nFaqat provodka · 15 savol · har biriga 1,5 daqiqa · har duel 30 daqiqa ochiq. G'olib keyingi bosqichga o'tadi.";
// to'liq jadval (guruh uchun) — Telegram 4096 belgi chegarasini hisobga olib bo'laklarga ajratiladi
function cupText(rows: any[], lang?: string | null, byes: any[] = [], plan: any[] = []) {
  const out: string[] = [tr(lang, HEAD)];
  const rounds = [...new Set(rows.map((r) => r.round))].sort((a, b) => a - b);
  for (const r of rounds) {
    const rr = rows.filter((x) => x.round === r);
    out.push("\n<b>" + stageName(rr[0].stage, lang) + "</b> · " + String(rr[0].slot).slice(0, 5));
    rr.forEach((x, i) => out.push(`${i + 1}. ${esc(x.a_name ?? "")} ⚔️ ${esc(x.b_name ?? "")}${x.winner_name ? " · ✅ " + esc(x.winner_name) : ""}`));
    if (r === 1 && byes.length) out.push(tr(lang, "➡️ Saralashsiz keyingi raundga o'tdi — {c} kishi (oxirgi 7 kundagi bosqich bali eng yuqorilar): {n}", { c: byes.length, n: byes.map((b) => esc(b.name ?? "")).join(", ") }));
  }
  out.push(planText(plan, lang));
  return out.filter(Boolean).join("\n");
}
// shaxsiy xabar uchun qisqa jadval: umumiy son, kun jadvali va o'z dueli
function cupShort(rows: any[], lang: string | null | undefined, byes: any[], plan: any[]) {
  const r1 = rows.filter((x) => x.round === 1).length, n = r1 * 2 + byes.length;
  const head = byes.length
    ? tr(lang, "Bugun <b>{n}</b> kishi qatnashadi: saralashda {d} ta duel, {b} kishi (oxirgi 7 kundagi bosqich bali bo'yicha) saralashsiz keyingi raundga o'tdi. Keyingi raundlarda juftsiz odam qolmaydi.", { n, d: r1, b: byes.length })
    : tr(lang, "Bugun <b>{n}</b> kishi qatnashadi: 1-raundda {d} ta duel bir vaqtda o'ynaladi.", { n, d: r1 });
  return tr(lang, HEAD) + "\n\n" + head + planText(plan, lang);
}
function chunks(text: string, max = 3900) {
  const out: string[] = []; let cur = "";
  for (const line of text.split("\n")) { if ((cur + "\n" + line).length > max && cur) { out.push(cur); cur = line; } else cur = cur ? cur + "\n" + line : line; }
  if (cur) out.push(cur);
  return out;
}
// Telegram kanal(lar) — kubok qurasi va natijalari shu yerga ham chiqadi
async function channels(): Promise<number[]> {
  const { data } = await db.from("liga_channels").select("chat_id").eq("active", true);
  return ((data ?? []) as any[]).map((c) => Number(c.chat_id));
}
async function toChannels(text: string, kb?: unknown) {
  let n = 0;
  for (const ch of await channels()) for (const part of chunks(text)) {
    const r = await tg("sendMessage", { chat_id: ch, parse_mode: "HTML", text: part, reply_markup: kb, disable_web_page_preview: true });
    if (r?.ok) n++;
    else if (/chat not found|kicked|not enough rights|have no rights|CHAT_WRITE_FORBIDDEN/i.test(String(r?.description ?? ""))) await db.from("liga_channels").update({ active: false }).eq("chat_id", ch);
    await pause(60);
  }
  return n;
}
// bugungi kubok jadvali (juftlar, natijalar, kun jadvali) — kanal yoki guruh uchun to'liq matn
async function cupFullText(code = "ASOSIY") {
  const by = await cupBoard(), bys = await cupByes(); const rows = by[code] ?? [];
  if (!rows.length) return "";
  const plan = await cupPlan(rows.filter((x) => x.round === 1).length * 2 + (bys[code] ?? []).length);
  return cupText(rows, "uz", bys[code] ?? [], plan);
}
// jadvalni hammaga (shaxsan, o'z dueli bilan) va jamoa guruhlariga yuborish
async function cupBroadcast(rows: any[]) {
  const by = await cupBoard(), bys = await cupByes(); let n = 0;
  const plans: Record<string, any[]> = {};
  for (const code of Object.keys(by)) plans[code] = await cupPlan(by[code].filter((x) => x.round === 1).length * 2 + (bys[code] ?? []).length);
  for (const code of Object.keys(by)) for (const c of await chatsOf(code))
    for (const part of chunks(cupText(by[code], "uz", bys[code] ?? [], plans[code]))) await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", reply_markup: openBot(code), text: part });
  if (by["ASOSIY"]) await toChannels(cupText(by["ASOSIY"], "uz", bys["ASOSIY"] ?? [], plans["ASOSIY"]), openBot("ASOSIY"));
  const mine: Record<string, any> = {}; for (const x of rows) mine[x.player] = x;
  const bye: Record<string, any> = {}; for (const code of Object.keys(bys)) for (const b of bys[code]) bye[b.player] = b;
  const { data: bn } = await db.rpc("liga_cup_bench_sys"); const bench = new Set(((bn ?? []) as any[]).map((x) => x.player));
  const { data: ppl } = await db.rpc("liga_cup_people_sys");
  for (const p of (ppl ?? []) as any[]) {
    const m = mine[p.player], board = by[p.group_code]; if (!board) continue;
    const bb = bys[p.group_code] ?? [], plan = plans[p.group_code] ?? [];
    let txt = board.length > 8 ? cupShort(board, p.lang, bb, plan) : cupText(board, p.lang, bb, plan);
    if (m) txt += "\n\n" + tr(p.lang, "👉 Sizning duelingiz ({st}): soat <b>{s}</b>, raqib — <b>{o}</b>.", { st: stageName(m.stage, p.lang), s: String(m.slot).slice(0, 5), o: esc(m.opp_name ?? "") });
    else if (bye[p.player]) txt += "\n\n" + tr(p.lang, "✅ <b>Siz saralashsiz keyingi raundga o'tdingiz!</b>\nOxirgi 7 kundagi bosqich balingiz yuqori bo'lgani uchun saralash duelini o'ynamaysiz. Keyingi duelingiz — soat <b>{s}</b> ({st}). Raqib saralash tugagach ma'lum bo'ladi, bot xabar beradi.",
      { s: String(plan[1]?.at ?? "").slice(0, 5), st: stageName(plan[1]?.stage ?? "", p.lang) });
    if (!m && !bye[p.player] && bench.has(p.player)) txt += "\n\n" + tr(p.lang, "ℹ️ <b>Bugun ishtirokchilar soni toq bo'ldi</b> — eng oxirgi qo'shilgan siz bo'lganingiz uchun bugungi kubokda juftingiz yo'q. <b>Ertadan kubokda qatnashasiz.</b> Kunlik bosqich odatdagidek ochiq — o'ynashni unutmang!");
    const opp = m ? await oppLine(m.code, p.tg, p.lang) : "";
    if (await dm(p.tg, (txt.length > 4000 ? cupShort(board, p.lang, bb, plan) : txt) + opp, m ? appBtn(tr(p.lang, "Duelni ochish"), "?d=" + m.code) : appBtn(tr(p.lang, "Ligani ochish")))) n++;
  }
  return n;
}
async function chatsOf(code: string) { return (await chats()).filter((c) => c.group_code === code); }

type Chat = { chat_id: number; group_code: string };
type Group = { code: string; name: string; start_date: string; active: boolean; paid_until: string | null };

async function chats(): Promise<Chat[]> {
  const { data } = await db.from("liga_bot_chats").select("chat_id,group_code").eq("active", true);
  return (data ?? []) as Chat[];
}
async function groupMap(): Promise<Record<string, Group>> {
  const { data } = await db.from("liga_groups").select("code,name,start_date,active,paid_until");
  const m: Record<string, Group> = {};
  for (const g of (data ?? []) as Group[]) m[g.code] = g;
  return m;
}
function groupOk(g?: Group) {
  if (!g || !g.active) return false;
  return !g.paid_until || g.paid_until >= tzDate().toISOString().slice(0, 10);
}
// har bir faol guruhga (jamoasi faol bo'lsa) xabar; text — jamoaga qarab tuziladi
async function toChats(make: (g: Group) => Promise<string | null> | string | null) {
  const gm = await groupMap(); let n = 0;
  for (const c of await chats()) {
    const g = gm[c.group_code]; if (!groupOk(g)) continue;
    const text = await make(g); if (!text) continue;
    await tg("sendMessage", { chat_id: c.chat_id, text, parse_mode: "HTML", reply_markup: openBot(g.code) }); n++;
  }
  return n;
}

async function resultsText(code: string) {
  const { data } = await db.rpc("liga_results_group", { p_code: code, p_id: null });
  if (!data?.length) return "🏁 <b>Hafta yakunlandi</b>\n\nBu hafta hech kim ball to'plamadi. Yangi haftada kuchliroq boshlaymiz!";
  const medal = ["👑", "🥈", "🥉"];
  const rows = data.map((p: any, i: number) => `${medal[i] ?? `${i + 1}.`} ${esc(p.name ?? "")} — <b>${p.week_xp} ball</b>`);
  const win = data[0];
  return `🏁 <b>Haftalik liga natijalari</b>\n\n${rows.join("\n")}\n\n🏆 G'olib: <b>${esc(win.name ?? "")}</b> — tabriklaymiz!\n👑🥈🥉 Kuchli uchlik ilovada nishon va sertifikat oladi.\nYangi hafta dushanba soat 09:00 da boshlanadi 👇`;
}

// guruh haqiqatan jamoaga ulanganmi (standart "ASOSIY" siz)
async function linkedCode(chatId: number): Promise<string> {
  const { data } = await db.from("liga_bot_chats").select("group_code").eq("chat_id", chatId).maybeSingle();
  return (data?.group_code as string) || "";
}
async function chatGroup(chatId: number): Promise<string> {
  const { data } = await db.from("liga_bot_chats").select("group_code").eq("chat_id", chatId).maybeSingle();
  return (data?.group_code as string) || "ASOSIY";
}

// ---------------- obuna to'lovi: karta + chek ----------------
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fmtD = (d: string) => d ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "";
// kubok: raqibning telefoni va Telegram niki — xabar oxiriga (a'zolar duelga kirmasa, bir-biriga qo'ng'iroq qilsin/yozsin)
const fmtPhone = (p: string) => { const d = p.replace(/\D/g, ""); return d.length === 12 && d.startsWith("998") ? `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : p; };
async function oppLine(code: string | null | undefined, myTg: number | null | undefined, lang: string | null | undefined) {
  if (!code || !myTg) return "";
  const { data } = await db.rpc("liga_duel_opp_contact_sys", { p_code: code, p_tg: myTg }); const c = ((data ?? []) as any[])[0];
  if (!c || (!c.phone && !c.tg_username)) return "";
  const parts = [c.phone ? "📞 " + esc(fmtPhone(c.phone)) : "", c.tg_username ? "✈️ @" + esc(c.tg_username) : ""].filter(Boolean);
  return "\n" + tr(lang, "Raqib bilan bog'lanish:") + " " + parts.join(" · ");
}
async function payCfg() {
  const { data } = await db.rpc("liga_pay_config2");
  return (data?.[0] ?? {}) as { card?: string; card_name?: string; price?: number };
}
async function cardMessage(chatId: number, months: number, name?: string, edit?: number) {
  const c = await payCfg(), price = c.price ?? 30000;
  const text = `💳 <b>Ligaga qo'shilish</b>${name ? ` — ${esc(name)}` : ""}\n\n` +
    `1️⃣ Kartaga <b>${fmt(price * months)} so'm</b> o'tkazing (${months} oy):\n<code>${esc(c.card || "—")}</code>\n${esc(c.card_name || "")}\n\n` +
    `2️⃣ To'lov chekining rasmini (skrinshot) <b>shu yerga yuboring</b>.\n\n` +
    `Administrator pul kartaga tushganini tekshiradi — tasdiqlangach bosqichlar ochiladi va shu yerga xabar keladi. Muddatni o'zgartirish uchun tugmani bosing:`;
  const kb = { inline_keyboard: [[1, 3, 6].map((m) => ({ text: (m === months ? "✅ " : "") + `${m} oy · ${fmt(price * m)}`, callback_data: `m:${m}` }))] };
  return edit ? tg("editMessageText", { chat_id: chatId, message_id: edit, text, parse_mode: "HTML", reply_markup: kb })
              : tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: kb });
}
async function playerName(id: string) {
  const { data } = await db.from("safari_players").select("first_name,last_name,phone,region,group_code").eq("id", id).maybeSingle();
  return data as any;
}
async function setSession(chatId: number, playerId: string, months = 1) {
  await db.from("liga_tg_sessions").upsert({ chat_id: chatId, player_id: playerId, months, updated_at: new Date().toISOString() });
}
const askContact = (chatId: number) => tg("sendMessage", { chat_id: chatId, parse_mode: "HTML",
  text: "📱 To'lovni qaysi hisobga yozishni bilishim uchun <b>telefon raqamingizni yuboring</b> (ilovada ro'yxatdan o'tgan raqam).",
  reply_markup: { keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });

// chek rasmini yuklab olish (data URI)
async function fileDataUri(fileId: string) {
  const f = await tg("getFile", { file_id: fileId });
  const path = f?.result?.file_path; if (!path) return null;
  if ((f.result.file_size ?? 0) > 1_000_000) return { big: true } as any;
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${path}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const ext = path.toLowerCase().endsWith(".png") ? "png" : path.toLowerCase().endsWith(".webp") ? "webp" : "jpeg";
  return { uri: `data:image/${ext};base64,` + btoa(bin) };
}

async function onReceipt(m: any) {
  const chatId = m.chat.id;
  const { data: ses } = await db.from("liga_tg_sessions").select("player_id,months").eq("chat_id", chatId).maybeSingle();
  if (!ses) return askContact(chatId);
  const photo = m.photo?.length ? m.photo[m.photo.length - 1] : null;
  const doc = m.document && /^image\//.test(m.document.mime_type ?? "") ? m.document : null;
  const f = photo ?? doc;
  if (!f) return tg("sendMessage", { chat_id: chatId, text: "❗ Chekni <b>rasm</b> (skrinshot) ko'rinishida yuboring.", parse_mode: "HTML" });
  // tekshiruv: rasm, hajm, takroriy emas
  const d = await fileDataUri(f.file_id);
  if (!d) return tg("sendMessage", { chat_id: chatId, text: "❗ Rasmni ochib bo'lmadi. Qayta yuboring." });
  if ((d as any).big) return tg("sendMessage", { chat_id: chatId, text: "❗ Rasm juda katta. Skrinshotni oddiy rasm qilib yuboring." });
  const { data, error } = await db.rpc("liga_receipt2_sys", { p_player: ses.player_id, p_months: ses.months, p_image: d.uri,
    p_uid: f.file_unique_id, p_file_id: photo ? f.file_id : null, p_chat: chatId });
  if (error) { console.error(error); return tg("sendMessage", { chat_id: chatId, text: "❗ Xatolik. Birozdan keyin qayta yuboring." }); }
  const r = data?.[0];
  if (r?.reason === "dup") return tg("sendMessage", { chat_id: chatId, text: "⚠️ Bu chek avval yuborilgan. Bitta chek faqat bir marta qabul qilinadi." });
  if (r?.reason === "pending") return tg("sendMessage", { chat_id: chatId, text: "⏳ Oldingi chekingiz hali tekshirilmoqda. Administrator javobini kuting — natija shu yerga keladi." });
  if (r?.reason === "blocked") return tg("sendMessage", { chat_id: chatId, text: "⛔ Oxirgi cheklaringiz tasdiqlanmagani uchun chek qabul qilish vaqtincha to'xtatildi. Administrator bilan bog'laning: @murtozo_44" });
  if (!r?.id) return tg("sendMessage", { chat_id: chatId, text: "❗ Xatolik. Birozdan keyin qayta yuboring." });
  const p = await playerName(ses.player_id);
  await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML",
    text: `🧾 <b>Chek qabul qilindi${p?.first_name ? `, ${esc(p.first_name)}` : ""}!</b>\n\nAdministrator pul kartaga tushganini tekshiradi. Tasdiqlangach bosqichlar ochiladi va shu yerga xabar keladi.\n\n⚠️ Soxta chek yuborilsa, chek qabul qilish to'xtatiladi.` });
  await notifyAdmins(Number(r.id));
}

// yangi chek — jamoa adminlariga (rasm + tasdiqlash tugmalari)
async function notifyAdmins(invId: number) {
  const { data: inv } = await db.from("liga_invoices").select("id,group_code,player_id,months,amount,receipt,tg_file_id,provider,status").eq("id", invId).maybeSingle();
  if (!inv) return { error: "no invoice" };
  const { data: chatsA } = await db.from("liga_admin_chats").select("chat_id").eq("group_code", inv.group_code);
  if (!chatsA?.length) return { sent: 0 };
  const p = await playerName(inv.player_id) ?? {};
  const c0 = await payCfg(), last4 = String(c0.card ?? "").replace(/\D/g, "").slice(-4);
  const { data: info } = await db.rpc("liga_receipt_info_sys", { p_id: inv.id }); const hi = (info ?? [])[0] ?? {};
  const caption = `🧾 <b>Yangi to'lov cheki</b> №${inv.id}\n👤 ${esc(((p.first_name ?? "") + " " + (p.last_name ?? "")).trim())}\n📞 ${esc(p.phone ?? "")}` +
    `${p.region ? `\n📍 ${esc(p.region)}` : ""}\n💳 <b>${fmt(Number(inv.amount))} so'm</b> · ${inv.months} oy\n` +
    (hi.rejected ? `⚠️ Avval rad etilgan cheklari: <b>${hi.rejected}</b>\n` : "") +
    `\n🔒 Bosqichlar hali <b>yopiq</b>.\nBank ilovangizda (yoki SMS'da) ${last4 ? `kartangizga (…${last4}) ` : ""}<b>${fmt(Number(inv.amount))} so'm</b> tushganini tekshiring.` +
    `${last4 ? `\nChekda ham qabul qiluvchi karta …${last4} bo'lishi kerak.` : ""}\n\nPul tushgan bo'lsa — «✅ Pul tushdi», tushmagan bo'lsa — «❌ Soxta».`;
  const kb = { inline_keyboard: [[{ text: "✅ Pul tushdi — ochish", callback_data: `rc:1:${inv.id}` }, { text: "❌ Soxta", callback_data: `rc:0:${inv.id}` }]] };
  let n = 0;
  for (const c of chatsA) {
    if (inv.tg_file_id) {
      await tg("sendPhoto", { chat_id: c.chat_id, photo: inv.tg_file_id, caption, parse_mode: "HTML", reply_markup: kb });
    } else if (inv.receipt) {
      const [head, b64] = String(inv.receipt).split(",");
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const fd = new FormData();
      fd.append("chat_id", String(c.chat_id)); fd.append("caption", caption); fd.append("parse_mode", "HTML");
      fd.append("reply_markup", JSON.stringify(kb));
      fd.append("photo", new Blob([bytes], { type: head.slice(5, head.indexOf(";")) }), "chek.jpg");
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: "POST", body: fd });
    }
    n++;
  }
  return { sent: n };
}

// chek qarori — o'yinchiga xabar
async function receiptNotify(x: { status?: string; player_chat?: number | null; paid_until?: string | null; lang?: string | null }) {
  if (!x?.player_chat) return false;
  if (x.status === "paid") return dm(x.player_chat, tr(x.lang, "✅ <b>To'lovingiz tasdiqlandi!</b>\nBosqichlar ochildi. Obuna: <b>{d}</b> gacha. Omad! 💪", { d: fmtD(x.paid_until ?? "") }), appBtn(tr(x.lang, "Ligani ochish")));
  if (x.status === "cancelled") return dm(x.player_chat, tr(x.lang, "❌ <b>To'lov chekingiz tasdiqlanmadi</b> — pul kartaga tushmagan.\nBosqichlar yopiq. Haqiqatan to'lagan bo'lsangiz, administratorga yozing: @murtozo_44"));
  return false;
}
async function onCallback(q: any) {
  const data = String(q.data ?? ""), chatId = q.message?.chat?.id;
  const ack = (text?: string) => tg("answerCallbackQuery", { callback_query_id: q.id, text });
  if (data.startsWith("dq:")) return groupDuelTake(q, data.slice(3));
  if (data === "nk") {
    const lang = await playerLang(q.from?.id);
    const u = q.from?.username || (q.from?.id ? await nickRefresh(q.from.id) : null);
    if (!u) return tg("answerCallbackQuery", { callback_query_id: q.id, show_alert: true,
      text: tr(lang, "Nik hali ko'rinmayapti. Sozlamalar → Foydalanuvchi nomi bo'limida nik yozib, ✓ ni bosing, keyin qayta tekshiring.") });
    await db.rpc("liga_tg_seen_sys", { p_tg: q.from.id, p_username: u });
    if (chatId && q.message?.message_id) await tg("editMessageText", { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML",
      text: tr(lang, "✅ <b>Rahmat! Nikingiz saqlandi: @{u}</b>\nEndi duel raqibingiz sizga Telegram'da yoza oladi.", { u: esc(u) }) });
    return ack(tr(lang, "Saqlandi"));
  }
  if (data.startsWith("m:")) {
    const months = Math.max(1, Math.min(12, Number(data.slice(2)) || 1));
    const { data: ses } = await db.from("liga_tg_sessions").select("player_id").eq("chat_id", chatId).maybeSingle();
    if (!ses) { await ack(); return askContact(chatId); }
    await setSession(chatId, ses.player_id, months);
    await ack(`${months} oy tanlandi`);
    return cardMessage(chatId, months, undefined, q.message.message_id);
  }
  if (data.startsWith("rc:")) {
    const [, ok, id] = data.split(":");
    const { data: r } = await db.rpc("liga_receipt_decide2_sys", { p_id: Number(id), p_ok: ok === "1", p_admin_chat: chatId });
    const x = r?.[0];
    if (!x?.done) return ack("Ruxsat yo'q");
    const mark = x.status === "paid" ? `\n\n✅ <b>Pul tushdi — tasdiqlandi.</b> Obuna ${fmtD(x.paid_until ?? "")} gacha ochildi.` : x.status === "cancelled" ? "\n\n❌ <b>Soxta — rad etildi.</b> Bosqichlar yopiq." : "";
    await tg("editMessageCaption", { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML",
      caption: esc(q.message.caption ?? "") + mark });
    await receiptNotify(x);
    return ack(x.status === "paid" ? "Tasdiqlandi" : "Rad etildi");
  }
  return ack();
}

// Telegram niki — duel raqibiga ko'rsatish uchun (har yozganda yangilanadi)
async function seen(from: any) {
  if (!from?.id || from.is_bot) return;
  try { await db.rpc("liga_tg_seen_sys", { p_tg: from.id, p_username: from.username ?? null }); } catch (_) { /* jim */ }
}
// eski o'yinchilar: niki noma'lum bo'lsa — getChat orqali bir martalik to'ldirish
async function fillNames(limit = 200) {
  const { data } = await db.rpc("liga_tg_unknown_sys", { p_limit: limit }); let n = 0, found = 0;
  for (const r of (data ?? []) as any[]) {
    const c = await tg("getChat", { chat_id: r.tg }); n++;
    const u = c?.ok ? (c.result?.username ?? null) : null; if (u) found++;
    await db.rpc("liga_tg_seen_sys", { p_tg: r.tg, p_username: u }); await pause(40);
  }
  return { checked: n, found };
}

// ---------------- Telegram niki (username) yo'qlardan nik qo'yishni so'rash ----------------
const NICK_TEXT = "👤 <b>{n}, Telegram'da nikingiz (username) yo'q.</b>\nKubok duelida raqibingiz sizga Telegram'da yoza olishi uchun nik kerak — hozir sizni topib bo'lmayapti.\n\n<b>Nik qo'yish (1 daqiqa):</b>\n1. Telegram → <b>Sozlamalar</b> (Settings / Настройки)\n2. <b>Foydalanuvchi nomi</b> (Username / Имя пользователя)\n3. Nik yozing, masalan: <code>{ex}</code> → ✓\n\nKeyin pastdagi tugmani bosing.";
const nickBtn = (lang: string | null | undefined) => ({ inline_keyboard: [[{ text: tr(lang, "✅ Nik qo'ydim — tekshirish"), callback_data: "nk" }]] });
const nickExample = (name?: string | null) => {
  const lat = String(name ?? "").toLowerCase().replace(/[ʻʼ'`‘’]/g, "").replace(/[^a-z0-9]/g, "");
  return (lat.length >= 3 ? lat.slice(0, 16) : "ism") + "_buxgalter";
};
async function nickRefresh(tgId: number): Promise<string | null> {
  const c = await tg("getChat", { chat_id: tgId });
  const u = c?.ok ? (c.result?.username ?? null) : null;
  await db.rpc("liga_tg_seen_sys", { p_tg: tgId, p_username: u });
  return u;
}
async function nickAsk(limit = 500) {
  const { data, error } = await db.rpc("liga_nick_ask_list_sys", { p_limit: limit }); if (error) return { ok: false, err: error.message };
  let checked = 0, already = 0, sent = 0, fail = 0;
  for (const p of (data ?? []) as any[]) {
    checked++;
    if (await nickRefresh(p.tg)) { already++; continue; }          // o'zi qo'yib bo'lgan — so'ramaymiz
    const ok = await dm(p.tg, tr(p.lang, NICK_TEXT, { n: esc(p.first_name ?? ""), ex: nickExample(p.first_name) }), nickBtn(p.lang));
    if (ok) { sent++; await db.rpc("liga_nick_asked_sys", { p_tg: p.tg }); } else fail++;
    await pause(45);
  }
  return { ok: true, checked, already, sent, fail };
}

// ---------------- muhokama guruhi: bot guruh ochmaydi/odam qo'sha olmaydi — shaxsan taklif havolasi yuboradi ----------------
async function discussCfg(): Promise<{ chat: number; link: string } | null> {
  const { data } = await db.from("liga_bot_config").select("key,value").in("key", ["discuss_chat", "discuss_link"]);
  const m: Record<string, string> = {}; for (const r of (data ?? []) as any[]) m[r.key] = r.value;
  return m.discuss_chat && m.discuss_link ? { chat: Number(m.discuss_chat), link: m.discuss_link } : null;
}
const inviteBtn = (lang: string | null | undefined, link: string) => ({ inline_keyboard: [[{ text: tr(lang, "💬 Guruhga qo'shilish"), url: link }]] });
// bitta odamga taklif (guruhda bo'lsa — yubormaydi)
async function inviteOne(cfg: { chat: number; link: string }, tgId: number, lang: string | null | undefined, name?: string | null) {
  const mem = await tg("getChatMember", { chat_id: cfg.chat, user_id: tgId });
  const st = mem?.result?.status;
  if (["member", "administrator", "creator", "restricted"].includes(st)) { await db.rpc("liga_discuss_mark2_sys", { p_tg: tgId, p_status: "in" }); return "in"; }
  if (st === "kicked") { await db.rpc("liga_discuss_mark2_sys", { p_tg: tgId, p_status: "kicked" }); return "kicked"; }
  const ok = await dm(tgId, tr(lang, "💬 <b>{n}, Hisobchi Liga ishtirokchilari guruhi ochildi!</b>\nSavollar, provodkalar va duellarni shu yerda muhokama qilamiz, raqibingiz bilan kelishib olasiz. Qo'shiling:", { n: esc(name || "") }).replace("<b>, ", "<b>"),
    inviteBtn(lang, cfg.link));
  await db.rpc("liga_discuss_mark2_sys", { p_tg: tgId, p_status: ok ? "sent" : "fail" });
  return ok ? "sent" : "fail";
}
async function inviteAll(limit = 500) {
  const cfg = await discussCfg(); if (!cfg) return { skip: "no_group" };
  const { data } = await db.rpc("liga_discuss_targets_sys", { p_limit: limit });
  const out: Record<string, number> = { sent: 0, in: 0, fail: 0, kicked: 0 };
  for (const p of (data ?? []) as any[]) out[await inviteOne(cfg, p.tg, p.lang, p.first_name)]++;
  return out;
}

// muhokama guruhida reklama: o'chirish, ogohlantirish, 3-martada 24 soat yozishdan cheklash (adminlarga tegmaydi)
const RK_WHY: Record<string, string> = { link: "begona havola", forward: "kanal yoki guruhdan forward", buttons: "tugmali xabar", inline_bot: "reklama boti", mention: "kanal/guruh/bot reklamasi" };
const bg = (p: Promise<unknown>) => { const ER = (globalThis as any).EdgeRuntime; if (ER?.waitUntil) ER.waitUntil(p.catch(() => null)); };
async function moderate(m: any): Promise<boolean> {
  if (!["group", "supergroup"].includes(m.chat?.type)) return false;
  const cfg = await discussCfg(); if (!cfg || m.chat.id !== cfg.chat) return false;
  if (m.sender_chat && m.sender_chat.id === m.chat.id) return false;            // anonim admin
  let why = m.sender_chat ? "forward" : adReason(m, BOT);                       // kanal nomidan yozish ham reklama
  if (!why) for (const u of mentionsOf(m).slice(0, 5)) {
    if (/bot$/i.test(u)) { why = "mention"; break; }
    const c = await tg("getChat", { chat_id: "@" + u });
    if (c?.ok && ["channel", "supergroup", "group"].includes(c.result?.type) && c.result?.id !== m.chat.id) { why = "mention"; break; }
  }
  if (!why) return false;
  if (m.from?.id && !m.sender_chat) {
    const mem = await tg("getChatMember", { chat_id: m.chat.id, user_id: m.from.id });
    if (["administrator", "creator"].includes(mem?.result?.status)) return false;
    if (m.from.is_bot && String(m.from.username ?? "").toLowerCase() === BOT.toLowerCase()) return false;
  }
  await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id });
  const who = m.from?.id && !m.sender_chat ? m.from : null;
  let n = 1;
  if (who) { const { data } = await db.rpc("liga_discuss_strike_sys", { p_tg: who.id }); n = Number(data) || 1; }
  const name = who ? `<a href="tg://user?id=${who.id}">${esc(who.first_name ?? "")}</a>` : "";
  let text = `🚫 ${name ? name + ", " : ""}guruhda reklama mumkin emas (${RK_WHY[why] ?? why}). Xabar o'chirildi.`;
  if (who && n >= 3) {
    await tg("restrictChatMember", { chat_id: m.chat.id, user_id: who.id, until_date: Math.floor(Date.now() / 1000) + 86400,
      permissions: { can_send_messages: false, can_send_audios: false, can_send_documents: false, can_send_photos: false, can_send_videos: false,
        can_send_video_notes: false, can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false } });
    text += "\n⛔ 3-marta takrorlandi — 24 soat yozish cheklandi.";
  } else if (who) text += `\n⚠️ Ogohlantirish ${n}/3. Savol, provodka, qonun havolalari (lex.uz, soliq.uz) — mumkin.`;
  else if (m.sender_chat?.type === "channel") await tg("banChatSenderChat", { chat_id: m.chat.id, sender_chat_id: m.sender_chat.id });
  const w = await tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", text, disable_notification: true });
  if (w?.result?.message_id) bg((async () => { await pause(20000); await tg("deleteMessage", { chat_id: m.chat.id, message_id: w.result.message_id }); })());
  return true;
}

// til: Telegram interfeysi tili emas, o'yinchining ilovadagi tili (ruscha Telegram — o'zbekcha o'yinchi bo'lishi mumkin)
async function playerLang(tgId: number | null | undefined): Promise<string> {
  if (!tgId) return "uz";
  const { data } = await db.from("safari_players").select("lang").eq("tg_user_id", tgId).order("last_active", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  return (data as any)?.lang || "uz";
}

// ---------------- guruhda jonli duelga chaqiruv: birinchi «Qabul qilish»ni bosgan o'ynaydi ----------------
const duelLink = (code: string) => `https://t.me/${BOT}?start=d_${code}`;
const TAKE_ERR: Record<string, string> = {
  self: "Bu o'zingizning chaqiruvingiz — raqib kutilmoqda.",
  no_player: "Avval Hisobchi Ligada ro'yxatdan o'ting va Telegram'ni ulang (botga /start yozing).",
  unpaid: "Obunangiz faol emas — duelga kira olmaysiz.",
  expired: "Chaqiruv muddati o'tgan.",
  not_found: "Duel topilmadi.",
};
async function groupDuelCmd(m: any) {
  const cfg = await discussCfg();
  const say = (t: string) => tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", text: t, reply_to_message_id: m.message_id });
  if (!cfg || m.chat.id !== cfg.chat) return say("⚔️ Duelga chaqiruv faqat liga muhokama guruhida ishlaydi.");
  if (!m.from?.id || m.sender_chat) return;
  const { data } = await db.rpc("liga_live_create_sys", { p_tg: m.from.id, p_lang: await playerLang(m.from.id) });
  const r = (data ?? {}) as any;
  if (r.err === "no_player") return say("❗ Avval ligada ro'yxatdan o'ting va Telegram'ni ulang: botga shaxsan /start yozing.");
  if (r.err === "unpaid") return say("❗ Obunangiz faol emas — duel ochib bo'lmaydi.");
  if (r.err === "open_exists") return say("⏳ Sizda hali qabul qilinmagan chaqiruv bor — kuting yoki 30 daqiqadan keyin qayta urinib ko'ring.");
  if (r.err === "too_many") return say("❗ Bugun juda ko'p duel ochdingiz — ertaga davom eting.");
  if (!r.code) return say("❌ Duel ochib bo'lmadi, birozdan keyin qayta urinib ko'ring.");
  const sent = await tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML",
    text: `⚔️ <b>${esc(r.name ?? "")}</b> jonli duelga chaqiryapti!\n10 ta savol: kim birinchi to'g'ri topsa — ochko o'shaniki.\n👉 <b>Birinchi «Qabul qilish»ni bosgan</b> o'ynaydi, qolganlarniki qabul qilinmaydi.\n⏳ Chaqiruv 30 daqiqa ochiq.`,
    reply_markup: { inline_keyboard: [[{ text: "⚔️ Qabul qilish", callback_data: "dq:" + r.code }]] } });
  if (sent?.result?.message_id) await db.rpc("liga_group_post_add_sys", { p_code: r.code, p_chat: m.chat.id, p_msg: sent.result.message_id });
}
async function groupDuelTake(q: any, code: string) {
  const ack = (text: string, alert = false) => tg("answerCallbackQuery", { callback_query_id: q.id, text, show_alert: alert });
  const { data } = await db.rpc("liga_live_take_sys", { p_code: code, p_tg: q.from.id });
  const r = (data ?? {}) as any;
  if (r.r === "taken") return ack(`Kechikdingiz — ${r.b ?? "boshqa ishtirokchi"} qabul qilib bo'ldi.`, true);
  if (r.r !== "ok") return ack(TAKE_ERR[r.r] ?? "Xatolik", true);
  if (!r.again) {
    await tg("editMessageText", { chat_id: q.message.chat.id, message_id: q.message.message_id, parse_mode: "HTML",
      text: `⚔️ <b>${esc(r.a ?? "")}</b> ⚡ <b>${esc(r.b ?? "")}</b> — jonli duel!\nIkkalangiz ham «Duelga kirish» tugmasini bosing — o'yin ikkalangiz kirgach boshlanadi.\nNatija shu yerga yoziladi.`,
      reply_markup: { inline_keyboard: [[{ text: "▶️ Duelga kirish", url: duelLink(code) }]] } });
    if (r.a_tg) await dm(r.a_tg, `⚔️ <b>${esc(r.b ?? "")}</b> chaqiruvingizni qabul qildi! Duelga kiring:`, appBtn("Duelga kirish", "?d=" + code));
  }
  return tg("answerCallbackQuery", { callback_query_id: q.id, url: duelLink(code) });
}
// guruhdagi jonli duel — tomoshabinlar uchun xabar (har savoldan keyin yangilanadi)
function revealText(l: any): string {
  if (!l) return "";
  if (l.t === "pv") return `Dt ${esc(String(l.dt ?? ""))} — Kt ${esc(String(l.kt ?? ""))}`;
  if (l.t === "mc") return esc(String((l.o ?? [])[l.a] ?? ""));
  return esc(String(l.a ?? "")).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
async function groupLive(code: string) {
  const { data } = await db.rpc("liga_group_live_sys", { p_code: code }); const v = data as any;
  if (!v) return { skip: true };
  if (v.status === "done") return await groupDue();
  if (v.status === "wait" && !v.b_name) return { skip: "no_opponent" };
  const a = esc(v.a_name ?? ""), b = esc(v.b_name ?? "");
  let text: string;
  if (v.status === "wait") text = `⚔️ <b>${a}</b> ⚡ <b>${b}</b> — jonli duel!\n⏳ Ikkalasi kirishi kutilmoqda. Kirgach o'yin shu yerda jonli ko'rinadi.`;
  else {
    const n = Number(v.n) || 10, cur = Math.min(Number(v.cur) + 1, n);
    text = `🔴 <b>JONLI DUEL</b> · savol ${cur}/${n}\n\n<b>${a}</b>   ${v.a_pts ?? 0} : ${v.b_pts ?? 0}   <b>${b}</b>`;
    const l = v.last;
    if (l) {
      const who = l.w === "a" ? `✅ ${a} birinchi topdi` : l.w === "b" ? `✅ ${b} birinchi topdi` : "❌ Hech kim topmadi";
      const q = String(l.q ?? ""); const qs = q.length > 160 ? q.slice(0, 157) + "…" : q;
      text += `\n\n${l.k + 1}-savol: ${who}\n❓ ${esc(qs)}\n💡 Javob: <b>${revealText(l)}</b>`;
    }
    text += "\n\n👀 Tomosha qilyapsiz — natija har savoldan keyin yangilanadi.";
  }
  await tg("editMessageText", { chat_id: v.chat_id, message_id: v.msg_id, parse_mode: "HTML", text,
    reply_markup: { inline_keyboard: [[{ text: "▶️ Duelga kirish (o'yinchilar)", url: duelLink(code) }]] } });
  return { ok: true };
}
// duel yakuni: ismlar, hisob va har savol bo'yicha kim to'g'ri / kim xato
const first = (n: string) => esc(String(n || "").split(/\s+/)[0] || n || "");
async function duelResultText(code: string, d: any): Promise<string> {
  const head = `🏁 <b>Duel yakunlandi</b>\n${d.winner === "a" ? "🏆 " : ""}<b>${esc(d.a_name ?? "")}</b>   ${d.a_pts} : ${d.b_pts}   <b>${esc(d.b_name ?? "")}</b>${d.winner === "b" ? " 🏆" : ""}` +
    (d.winner === "tie" ? "\n🤝 Durang!" : "") + (d.note === "idle" ? "\n⏱ Raqiblardan biri 7 daqiqa javob bermadi." : "");
  const { data } = await db.rpc("liga_live_detail_sys", { p_code: code }); const x = data as any;
  const items: any[] = x?.items ?? []; if (!items.length) return head;
  const an = first(x.a), bn = first(x.b);
  const sym = (it: any, side: "a" | "b") => it.w === side ? "✅" : (side === "a" ? it.al : it.bl) ? "❌" : "➖";
  const build = (withQ: boolean) => head + "\n\n<b>Savollar bo'yicha:</b>\n" + items.map((it, i) => {
    const q = String(it.q ?? ""), qs = q.length > 70 ? q.slice(0, 67) + "…" : q;
    return `${i + 1}. ${withQ ? esc(qs) + "\n    " : ""}${sym(it, "a")} ${an} · ${sym(it, "b")} ${bn} — 💡 ${revealText(it)}`;
  }).join("\n") + "\n\n✅ birinchi to'g'ri topdi · ❌ xato javob · ➖ javob bermadi yoki raqib oldin topdi";
  const full = build(true); return full.length <= 4000 ? full : build(false).slice(0, 4000);
}
// guruhga natijalar: chaqiruv duellari va kubok raundlari
async function groupDue() {
  let edited = 0, rounds = 0;
  const { data: due } = await db.rpc("liga_group_due_sys");
  for (const d of (due ?? []) as any[]) {
    const text = d.kind === "expired"
      ? `⌛ <b>${esc(d.a_name ?? "")}</b> chaqiruvini hech kim qabul qilmadi.`
      : d.note === "cancel" ? `⚔️ ${esc(d.a_name ?? "")} ⚡ ${esc(d.b_name ?? "")} — duel o'ynalmadi (ikkalasi bir vaqtda kirmadi).`
      : await duelResultText(d.code, d);
    // to'liq natija (savollar bo'yicha) guruh oxiriga yangi xabar bo'lib chiqadi — hamma ko'radi, bildirishnoma keladi;
    // yuqoridagi chaqiruv xabari esa qisqa yozuvga almashadi (tugmalar olinadi)
    if (d.kind === "done" && d.note !== "cancel") {
      const w = d.winner === "a" ? d.a_name : d.winner === "b" ? d.b_name : "";
      const sent = await tg("sendMessage", { chat_id: d.chat_id, parse_mode: "HTML", text, reply_to_message_id: d.msg_id, allow_sending_without_reply: true });
      if (!sent?.ok) await tg("sendMessage", { chat_id: d.chat_id, text: text.replace(/<[^>]+>/g, "") });
      await tg("editMessageText", { chat_id: d.chat_id, message_id: d.msg_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [] },
        text: `🏁 <b>Duel yakunlandi:</b> ${esc(d.a_name ?? "")} ${d.a_pts}:${d.b_pts} ${esc(d.b_name ?? "")}` + (w ? ` — 🏆 <b>${esc(w)}</b>` : " — 🤝 durang") + "\n👇 To'liq natija pastda." });
      edited++; continue;
    }
    const r = await tg("editMessageText", { chat_id: d.chat_id, message_id: d.msg_id, parse_mode: "HTML", text, reply_markup: { inline_keyboard: [] } });
    if (!r?.ok) await tg("sendMessage", { chat_id: d.chat_id, parse_mode: "HTML", text });
    edited++;
  }
  const cfg = await discussCfg();
  const { data: rs } = await db.rpc("liga_cup_rounds_due_sys");
  for (const x of (rs ?? []) as any[]) {
    const lines = ((x.lines ?? []) as any[]).map((l, i) => {
      const a = (l.w === "a" ? "✅ " : "") + esc(l.a ?? ""), b = esc(l.b ?? "") + (l.w === "b" ? " ✅" : "");
      const n = l.note === "forfeit" ? " · kelmadi" : l.note === "idle" ? " · javob bermadi" : l.note === "idle2" ? " · o'ynalmadi" : l.note === "cancel" ? " · qur'a" : "";
      return `${i + 1}. ${a} <b>${l.ap ?? 0}:${l.bp ?? 0}</b> ${b}${n}`;
    });
    const head = `🏆 <b>Kunlik duel kubogi — ${esc(stageName(x.stage ?? ""))}</b> natijalari:`;
    // keyingi raund qurasi (juftlar) — natija bilan birga
    const nb = ((await cupBoard())[x.group_code] ?? []).filter((r: any) => r.round === x.round + 1);
    const nbye = await db.from("liga_day_byes").select("player_id").eq("day", tzDate().toISOString().slice(0, 10)).eq("group_code", x.group_code).eq("round", x.round + 1);
    let next = "";
    if (nb.length) {
      next = `\n\n🎲 <b>Qura: ${esc(stageName(nb[0].stage ?? ""))}</b> · soat ${String(nb[0].slot).slice(0, 5)}\n` + nb.map((r: any, i: number) => `${i + 1}. ${esc(r.a_name ?? "")} ⚔️ ${esc(r.b_name ?? "")}`).join("\n");
      const bp = (nbye.data ?? [])[0]?.player_id;
      if (bp) { const { data: nm } = await db.rpc("liga_pname", { p: bp }); if (nm) next += `\n➡️ Avtomatik o'tdi: ${esc(String(nm))}`; }
    }
    // ochko bo'yicha chiqib qolgan g'oliblar
    const { data: cl } = await db.rpc("liga_cup_cut_list_sys", { p_group: x.group_code, p_round: x.round });
    const cutL = (cl ?? []) as any[];
    const cutT = cutL.length ? `\n\n⚖️ G'oliblar ${cutL[0].winners} ta — keyingi bosqichga ochkosi eng ko'p <b>${cutL[0].keep}</b> kishi o'tdi. Ochko bo'yicha chiqib qoldi (${cutL.length}): ${cutL.map((c) => esc(c.name ?? "") + " " + (c.pts ?? 0)).join(", ")}` : "";
    const full = head + "\n" + lines.join("\n") + cutT + next;
    if (cfg) for (const part of chunks(full)) await tg("sendMessage", { chat_id: cfg.chat, parse_mode: "HTML", text: part, disable_notification: true });
    await toChannels(full, openBot(x.group_code));
    rounds++;
  }
  return { edited, rounds };
}

// ilovadan guruhga tashlangan duel havolasi (…?start=d_LXXXXXX) — bot uni kuzatadi: jonli tablo va yakuniy natija
async function trackSharedDuel(m: any): Promise<boolean> {
  if (!["group", "supergroup"].includes(m.chat?.type)) return false;
  const parts: string[] = [m.text ?? "", m.caption ?? ""];
  for (const e of (m.entities ?? m.caption_entities ?? []) as any[]) if (e.url) parts.push(e.url);
  for (const row of (m.reply_markup?.inline_keyboard ?? []) as any[]) for (const b of row) if (b.url) parts.push(b.url);
  const mt = /start=d_(L[A-Za-z0-9]{6})\b/.exec(parts.join(" ")); if (!mt) return false;
  const cfg = await discussCfg(); if (!cfg || m.chat.id !== cfg.chat) return false;
  const code = mt[1].toUpperCase();
  const { data } = await db.rpc("liga_group_track_sys", { p_code: code, p_chat: m.chat.id, p_msg: 0 }); const r = (data ?? {}) as any;
  if (!r.ok) return false;
  const text = r.b
    ? `⚔️ <b>${esc(r.a ?? "")}</b> ⚡ <b>${esc(r.b ?? "")}</b> — jonli duel!\n⏳ Ikkalasi kirishi kutilmoqda. O'yin shu yerda jonli ko'rinadi, natija oxirida chiqadi.`
    : `⚔️ <b>${esc(r.a ?? "")}</b> jonli duelga chaqirdi!\n👉 <b>Birinchi kirgan</b> o'ynaydi, qolganlarga «band» deyiladi.\nO'yin shu yerda jonli ko'rinadi, natija oxirida chiqadi.`;
  const sent = await tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", text, reply_to_message_id: m.message_id, allow_sending_without_reply: true,
    reply_markup: { inline_keyboard: [[{ text: r.b ? "▶️ Duelga kirish (o'yinchilar)" : "⚔️ Qabul qilish", url: duelLink(code) }]] } });
  if (sent?.result?.message_id) await db.rpc("liga_group_post_add_sys", { p_code: code, p_chat: m.chat.id, p_msg: sent.result.message_id });
  return true;
}

async function onUpdate(u: any) {
  try { return await onUpdate0(u); }
  finally { await seen(u.message?.from ?? u.callback_query?.from); }
}
async function onUpdate0(u: any) {
  if (u.callback_query) return onCallback(u.callback_query);
  const cm = u.my_chat_member;
  if (cm && cm.chat.type === "channel") {
    const st = cm.new_chat_member?.status;
    if (st === "administrator") {
      await db.from("liga_channels").upsert({ chat_id: cm.chat.id, title: cm.chat.title, active: true });
      const t = await cupFullText();
      await tg("sendMessage", { chat_id: cm.chat.id, parse_mode: "HTML", reply_markup: openBot("ASOSIY"),
        text: "🏆 <b>Hisobchi Liga</b> kanali ulandi.\nBu yerga har kuni kunlik duel kubogi qurasi (juftlar), har raund natijalari va kubok g'olibi chiqadi." });
      if (t) await toChannels(t, openBot("ASOSIY"));
    } else if (["left", "kicked", "member", "restricted"].includes(st)) {
      await db.from("liga_channels").update({ active: false }).eq("chat_id", cm.chat.id);
    }
    return;
  }
  if (cm && ["group", "supergroup"].includes(cm.chat.type)) {
    const st = cm.new_chat_member?.status;
    if (st === "member" || st === "administrator") {
      const was = await linkedCode(cm.chat.id);
      await db.from("liga_bot_chats").upsert({ chat_id: cm.chat.id, title: cm.chat.title, active: true });
      if (was) return;   // allaqachon jamoaga ulangan guruh (masalan, bot qayta qo'shildi) — salom xabari va /ulash ko'rsatmasi kerak emas
      await tg("sendMessage", { chat_id: cm.chat.id, parse_mode: "HTML", reply_markup: openBot(await chatGroup(cm.chat.id)),
        text: "👋 Salom, buxgalterlar!\n\n<b>Hisobchi Liga</b> — haftalik musobaqa:\n• har ish kuni 09:00–17:00 da yangi bosqich (20 savol);\n• liga dushanbadan <b>juma 17:00</b> gacha;\n• hafta davomida natijangizni faqat o'zingiz ko'rasiz;\n• yakuniy jadval juma 17:00 da shu guruhga chiqadi.\n\n🔗 Jamoa administratori: guruhda <b>/ulash KOD</b> deb yozing (kod admin panelda).\nBoshlash uchun pastdagi tugmani bosing." });
    } else if (st === "left" || st === "kicked") {
      await db.from("liga_bot_chats").update({ active: false }).eq("chat_id", cm.chat.id);
      // muhokama guruhidan bot chiqarilsa — havola ishlamay qoladi; adminni darhol ogohlantirish
      const cfg = await discussCfg();
      if (cfg && cfg.chat === cm.chat.id) {
        const { data: adm } = await db.from("liga_admin_chats").select("chat_id");
        for (const a of (adm ?? []) as any[]) await dm(a.chat_id, `⚠️ <b>Bot «${esc(cm.chat.title ?? "")}» guruhidan chiqarildi</b>${cm.from?.first_name ? " (" + esc(cm.from.first_name) + " tomonidan)" : ""}.\nGuruh havolasi endi ishlamaydi. Botni qayta qo'shib, administrator qiling va guruhda /muhokama yozing.`);
      }
    }
    return;
  }
  if (u.edited_message) { await moderate(u.edited_message); return; }
  const m = u.message;
  if (!m) return;
  if (await moderate(m)) return;
  if (await trackSharedDuel(m)) return;
  if (m.migrate_to_chat_id) {
    const code = await chatGroup(m.chat.id);
    await db.from("liga_bot_chats").update({ active: false }).eq("chat_id", m.chat.id);
    await db.from("liga_bot_chats").upsert({ chat_id: m.migrate_to_chat_id, title: m.chat.title, active: true, group_code: code });
    const cfg = await discussCfg();
    if (cfg && cfg.chat === m.chat.id) {
      const inv = await tg("createChatInviteLink", { chat_id: m.migrate_to_chat_id, name: "Hisobchi Liga" });
      await db.rpc("liga_discuss_move_sys", { p_chat: m.migrate_to_chat_id, p_link: inv?.result?.invite_link ?? cfg.link });
    }
    return;
  }
  const text = (m.text ?? "").trim();
  const cmd = text.split(/[\s@]/)[0].toLowerCase();
  const arg = text.split(/\s+/)[1] ?? "";
  const priv = m.chat.type === "private";
  const reply = (t: string, kb?: unknown) => tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", text: t, reply_markup: kb });

  if (priv && m.contact) {
    if (m.contact.user_id !== m.from?.id) return reply("❗ O'zingizning raqamingizni yuboring (pastdagi tugma orqali).");
    let ph = String(m.contact.phone_number ?? "").replace(/\D/g, ""); if (ph.length === 9) ph = "998" + ph;
    const { data: pl } = await db.from("safari_players").select("id,first_name").eq("phone", "+" + ph).maybeSingle();
    if (!pl) return reply("❌ Bu raqam bilan ro'yxatdan o'tilmagan. Avval ilovada ro'yxatdan o'ting, keyin chekni yuboring.", openApp());
    await setSession(m.chat.id, pl.id, 1);
    await db.rpc("liga_tg_bind_sys", { p_player: pl.id, p_tg: m.from.id });
    await tg("sendMessage", { chat_id: m.chat.id, text: "✅ Topildi.", reply_markup: { remove_keyboard: true } });
    return cardMessage(m.chat.id, 1, pl.first_name);
  }
  if (priv && (m.photo || m.document)) return onReceipt(m);
  if (priv && cmd === "/start" && /^pay_[0-9a-f]+$/i.test(arg)) {
    const { data: l } = await db.from("liga_tg_links").select("player_id,created_at").eq("code", arg.slice(4)).eq("kind", "pay").maybeSingle();
    if (!l || Date.now() - new Date(l.created_at).getTime() > 7 * 864e5) return askContact(m.chat.id);
    await setSession(m.chat.id, l.player_id, 1);
    if (m.from?.id) await db.rpc("liga_tg_bind_sys", { p_player: l.player_id, p_tg: m.from.id });
    const p = await playerName(l.player_id);
    return cardMessage(m.chat.id, 1, p?.first_name);
  }
  if (priv && cmd === "/start" && /^adm_[0-9a-f]+$/i.test(arg)) {
    const { data: l } = await db.from("liga_tg_links").select("group_code,created_at,used_at").eq("code", arg.slice(4)).eq("kind", "adm").maybeSingle();
    if (!l || l.used_at || Date.now() - new Date(l.created_at).getTime() > 864e5) return reply("❌ Havola eskirgan. Admin paneldan qayta oling.");
    await db.from("liga_admin_chats").upsert({ chat_id: m.chat.id, group_code: l.group_code });
    await db.from("liga_tg_links").update({ used_at: new Date().toISOString() }).eq("code", arg.slice(4));
    return reply("✅ Ulandi! Endi yangi to'lov cheklari shu yerga keladi — «✅ Tasdiqlash» yoki «❌ Rad etish» tugmasini bosasiz.");
  }
  if (priv && cmd === "/start" && /^link_[0-9a-f]+$/i.test(arg)) {
    const { data } = await db.rpc("liga_tg_link_use_sys", { p_code: arg.slice(5), p_tg: m.from?.id });
    const x = (data ?? [])[0];
    if (!x) return reply("❌ Havola eskirgan. Ilovada «Telegram'ni ulash» tugmasini qayta bosing.", openApp());
    return reply(tr(x.lang, "✅ <b>Ulandi!</b>\nEndi har bosqichdan keyin natijangiz, ertalab bosqich eslatmasi va juma kuni o'rningiz shu yerga keladi."), appBtn(tr(x.lang, "Ligani ochish")));
  }
  if (priv && cmd === "/start" && /^login_[0-9a-f]+$/i.test(arg)) {
    const { data } = await db.rpc("liga_login_bind_sys", { p_code: arg.slice(6), p_tg: m.from?.id });
    if (data?.ok) return reply(tr(data.lang, "✅ <b>Kirish tasdiqlandi!</b>\nIlovaga qayting — avtomatik kirasiz."));
    if (data?.reason === "no_player") return reply("❌ Bu Telegram hisobi ligaga ulanmagan.\nAvval ilovada ro'yxatdan o'ting yoki to'lov chekini shu bot orqali yuboring — shunda hisobingiz Telegram'ga bog'lanadi.", openApp());
    return reply("❌ Kirish havolasi eskirgan. Ilovada «Telegram orqali kirish» tugmasini qayta bosing.");
  }
  if (priv && cmd === "/tolov") {
    const { data: ses } = await db.from("liga_tg_sessions").select("player_id,months").eq("chat_id", m.chat.id).maybeSingle();
    if (!ses) return askContact(m.chat.id);
    return cardMessage(m.chat.id, ses.months);
  }
  if (priv && cmd === "/start" && /^r_[A-Za-z0-9]+$/i.test(arg)) {
    const lang = await playerLang(m.from?.id);
    return reply(tr(lang, "👋 <b>Hisobchi Liga</b>ga xush kelibsiz!\nDo'stingiz sizni taklif qildi. Ro'yxatdan o'ting — haftalik ligada bellashamiz."), appBtn(tr(lang, "Ro'yxatdan o'tish"), "?r=" + arg.slice(2).toUpperCase()));
  }
  if (priv && cmd === "/start" && /^d_[A-Za-z0-9]+$/i.test(arg)) {
    const lang = await playerLang(m.from?.id);
    const live = /^L[A-Z0-9]{6}$/i.test(arg.slice(2));
    return reply(tr(lang, live ? "⚡ <b>Sizni jonli duelga chaqirishdi!</b>\n10 ta savol, ikkalangiz bir vaqtda o'ynaysiz: kim birinchi to'g'ri topsa — ochko o'shaniki." : "⚔️ <b>Sizni duelga chaqirishdi!</b>\n10 ta savol: kim ko'proq to'g'ri topsa — g'olib, teng bo'lsa tezrog'i."), appBtn(tr(lang, "Duelga kirish"), "?d=" + arg.slice(2).toUpperCase()));
  }
  if (cmd === "/start" || cmd === "/liga") {
    const code = priv && /^g_/i.test(arg) ? arg.slice(2).toUpperCase().replace(/[^A-Z0-9]/g, "") : (priv ? "" : await chatGroup(m.chat.id));
    let gname = "";
    if (code) { const { data } = await db.from("liga_groups").select("name").eq("code", code).maybeSingle(); gname = data?.name ?? ""; }
    const { data: freeN } = priv && (!code || code === "ASOSIY") ? await db.rpc("liga_free_days") : { data: 0 };
    const freeLine = Number(freeN) > 0 ? `🎁 <b>Yangi a'zolarga birinchi ${Number(freeN)} kun bepul!</b> Ro'yxatdan o'ting va darhol o'ynang.\n\n` : "";
    await reply(priv
      ? `🏆 <b>Hisobchi Liga</b>${gname ? ` — «${esc(gname)}»` : ""}\n\nProvodka, QQS, ish haqi, soliq va hisobotlar bo'yicha har kuni yangi bosqich. Har ish kuni (juma ham) 09:00–17:00.\n\n${freeLine}${code ? `Jamoa kodi: <b>${esc(code)}</b> — ro'yxatdan o'tishda avtomatik qo'yiladi.\n\n` : ""}Ilovani ochish uchun tugmani bosing:`
      : "🏆 Ligani ochish uchun tugmani bosing:", priv ? openApp(code) : openBot(code));
  } else if (cmd === "/ulash") {
    if (priv) return reply("Bu buyruq Telegram guruhda ishlaydi: botni guruhga qo'shing va guruhda <b>/ulash KOD</b> deb yozing.");
    const mem = await tg("getChatMember", { chat_id: m.chat.id, user_id: m.from?.id });
    const role = mem?.result?.status;
    // oddiy a'zo bossa — javob yozmaymiz (guruh to'lib ketmasin), buyruqni jimgina o'chiramiz
    if (role !== "administrator" && role !== "creator") { await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id }); return; }
    if (!arg && (await linkedCode(m.chat.id))) { await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id }); return; }
    const code = arg.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) return reply("Foydalanish: <b>/ulash KOD</b> (kod jamoa admin panelida).");
    const { data: g } = await db.from("liga_groups").select("code,name").eq("code", code).maybeSingle();
    if (!g) return reply("❌ Bunday jamoa kodi topilmadi.");
    await db.from("liga_bot_chats").upsert({ chat_id: m.chat.id, title: m.chat.title, active: true, group_code: g.code });
    await reply(`✅ Guruh «<b>${esc(g.name)}</b>» jamoasiga ulandi.\nBosqich xabarlari va juma kungi natijalar shu yerga chiqadi.`, openBot(g.code));
  } else if (cmd === "/duel" && !priv) {
    return groupDuelCmd(m);
  } else if ((cmd === "/sms" || cmd === "/sms_login") && priv) {
    // faqat liga administratori (to'lov cheklari keladigan shaxsiy chat egasi)
    const { data: adm } = await db.from("liga_admin_chats").select("group_code").eq("chat_id", m.from?.id ?? 0).maybeSingle();
    if (!adm) return reply("⛔ Bu buyruq faqat liga administratori uchun.");
    const args = String(m.text ?? "").trim().split(/\s+/).slice(1);
    if (cmd === "/sms_login") {
      await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id });   // parol chatda qolmasin
      if (args.length < 2) return reply("Yozing: <code>/sms_login email parol</code> (Eskiz.uz kabinetidagi). Xabaringiz darhol o'chiriladi.");
      await cfgSet("eskiz_email", args[0]); await cfgSet("eskiz_password", args.slice(1).join(" ")); await db.from("liga_bot_config").delete().eq("key", "eskiz_token");
      const t = await eskizToken(true);
      return reply(t ? "✅ Eskiz'ga ulandi. Endi <b>/sms test 99890XXXXXXX</b> bilan sinab ko'ring, keyin <b>/sms on</b>." : "❌ Eskiz login yoki parol noto'g'ri — qayta yuboring.");
    }
    if (args[0] === "on" || args[0] === "off") { await cfgSet("sms_mode", args[0]); return reply(await smsStatusText()); }
    if (args[0] === "cap" && Number(args[1]) > 0) { await cfgSet("sms_cap", String(Math.floor(Number(args[1])))); return reply(await smsStatusText()); }
    if (args[0] === "test") {
      const ph = String(args[1] ?? "").replace(/\D/g, "");
      if (!/^998\d{9}$/.test(ph)) return reply("Yozing: <code>/sms test 998901234567</code>");
      const r = await smsSend(ph, SMS_TEXT.stage.uz);
      return reply(r.ok ? "✅ SMS yuborildi (" + esc(r.id ?? "") + ")." : "❌ Yuborilmadi: " + esc(r.err ?? "") + "\n\nAgar «shablon» yoki «moderation» xatosi bo'lsa — matnni Eskiz kabinetida shablon sifatida tasdiqlatish kerak.");
    }
    return reply(await smsStatusText());
  } else if (cmd === "/muhokama") {
    // faqat liga administratori (to'lov cheklari keladigan shaxsiy chat egasi)
    const { data: adm } = await db.from("liga_admin_chats").select("group_code").eq("chat_id", m.from?.id ?? 0).maybeSingle();
    if (!adm) { if (!priv) await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id }); else await reply("⛔ Bu buyruq faqat liga administratori uchun."); return; }
    if (priv) return reply("Bu buyruqni muhokama guruhining o'zida yozing: guruh oching, botni administrator qiling (\"Foydalanuvchilarni taklif qilish\" huquqi bilan) va guruhda <b>/muhokama</b> deb yozing.");
    const me = await tg("getMe", {}), bm = await tg("getChatMember", { chat_id: m.chat.id, user_id: me?.result?.id });
    if (bm?.result?.status !== "administrator" || bm?.result?.can_invite_users === false)
      return reply("❗ Avval botni shu guruhda <b>administrator</b> qiling va «Foydalanuvchilarni taklif qilish» (Invite users) huquqini yoqing, keyin /muhokama ni qayta yozing.");
    const inv = await tg("createChatInviteLink", { chat_id: m.chat.id, name: "Hisobchi Liga" });
    const link = inv?.result?.invite_link; if (!link) return reply("❌ Taklif havolasini yaratib bo'lmadi: " + esc(String(inv?.description ?? "")));
    await db.rpc("liga_discuss_set_sys", { p_chat: m.chat.id, p_link: link });
    await db.from("liga_bot_chats").upsert({ chat_id: m.chat.id, title: m.chat.title, active: true, group_code: adm.group_code });
    await reply("✅ Bu guruh — <b>liga muhokama guruhi</b>.\nBarcha ishtirokchilarga shaxsan taklif yuborilmoqda...");
    // ko'p odamga yuborish vaqt oladi — Telegram webhook'ini kutdirmaslik uchun fonda
    const task = (async () => { await discussPin().catch(() => {}); const r: any = await inviteAll(1000); await reply(`📨 Taklif yuborildi: <b>${r.sent ?? 0}</b> kishiga\n✅ Guruhda allaqachon bor: ${r.in ?? 0}\n⚠️ Yetib bormadi (botni bloklagan): ${r.fail ?? 0}\n\nTelegram'i ulanmagan ishtirokchilar havolani ilovaning bosh sahifasida ko'radi. Yangi qo'shilganlarga bot har kuni ertalab yuboradi.\n\nHavola: ${link}`); })().catch((e) => console.error(e));
    const ER = (globalThis as any).EdgeRuntime; if (ER?.waitUntil) ER.waitUntil(task); else await task;
    return;
  } else if (cmd === "/natija") {
    const code = priv ? "ASOSIY" : await chatGroup(m.chat.id);
    await reply(await resultsText(code), priv ? openApp(code) : openBot(code));
  } else if (cmd === "/qoida") {
    await reply("📋 <b>Qoidalar</b>\n• Har ish kuni 09:00–17:00 da (juma ham) yangi bosqich: 15 ta provodka + 5 ta qonun, kodeks va qarorlar savoli (oyning boshidan oxirigacha — osondan qiyinga).\n• Har savolga 2 daqiqa — hamma uchun teng; har savolga faqat bir marta javob. Xatoning sababi darhol ko'rsatiladi.\n• Ligaga to'lov: kartaga o'tkazib, chekni yuborasiz; administrator pul tushganini tasdiqlagach bosqichlar ochiladi.\n• Liga bali faqat bosqichlardan; kunlik mashq va blits — alohida.\n• Liga — dushanbadan juma 17:00 gacha. Hafta davomida natijangizni faqat o'zingiz ko'rasiz.\n• Juma 17:00 da jadval e'lon qilinadi; kuchli uchlik nishon va sertifikat oladi.");
  }
}

const TITLES = ["Birinchi ish kuni","Firma tug'iladi","Tovar keldi","Birinchi savdo","Ish haqi kuni","Yangi uskuna",
  "Soliqlar xaritasi","Hisobotlar taqvimi","Imtiyozlar","Qonun va qarorlar","Yil yakuni","Boss: soliq tekshiruvi"];
// Toshkent sanasi (UTC+5)
function tzDate(d = new Date()) { const t = new Date(d.getTime() + 5 * 3600e3); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }
// jamoa uchun bugungi bosqich (start_date dan ish kunlari; 12 tadan keyin yangi mavsum) — ilovadagi bilan bir xil
function todayStage(startDate: string): number | null {
  const [y, mo, dd] = startDate.split("-").map(Number);
  const start = Date.UTC(y, mo - 1, dd), today = tzDate();
  const w0 = today.getUTCDay(); if (w0 < 1 || w0 > 5) return null;
  if (today.getTime() < start) return null;
  let n = 0; const d = new Date(start);
  while (d.getTime() < today.getTime()) { const w = d.getUTCDay(); if (w >= 1 && w <= 5) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n % TITLES.length;
}
// kunning darsi (ilovadagi bilan bir xil: 01.10.2026 dan beri kunlar)
let LESSONS: any[] | null = null;
async function lessonOfDay() {
  try { if (!LESSONS) LESSONS = await (await fetch(APP + "lessons.json")).json(); } catch { return null; }
  if (!LESSONS?.length) return null;
  const d = Math.round((tzDate().getTime() - Date.UTC(2026, 9, 1)) / 864e5);
  return LESSONS[((d % LESSONS.length) + LESSONS.length) % LESSONS.length];
}
const ANNOUNCE_OCT = "📢 <b>Hisobchi Liga — muhim yangiliklar!</b>\n\n1️⃣ <b>Ertadan (14-oktabr) yangi kunlik reja:</b> har kuni o'z mavzusi — 15 provodka + 5 qonun savoli (Soliq kodeksi, Prezident farmon va qarorlari). Oy oxirigacha osondan qiyinga.\n\n2️⃣ <b>Oktabr reytingi 12-oktabr (dushanba)dan hisoblanmoqda</b> — undan oldingi ballar kirmaydi. Har bir bosqich bali muhim!\n\n3️⃣ 🏆 <b>Katta final — 28-dekabr:</b> oktabr va noyabrning kuchli uchligi (6 kishi) bellashadi.\n\n4️⃣ ⚔️ <b>Kunlik duel kubogi</b> 09:00 dan boshlanadi, final — 17:00 da (13:00–14:00 — tanaffus).\n\n5️⃣ 🥇🥈🥉 Haftalik kuchli uchlikka o'ringa qarab <b>medal va QR kodli sertifikat</b> — juma kuni avtomatik beriladi.\n\n6️⃣ Endi «XP» o'rniga <b>ball</b> deymiz — har bir to'g'ri javob uchun beriladigan ochko. Reyting shu ball bo'yicha.\n\nErtaga soat 09:00 da — 1-kun: «Kassa va bank». Omad! 💪";
// ---------------- kunlik hisobot (adminlarga, 20:00) ----------------
const WD = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const nmList = (a: string[]) => a.map((x) => esc(x)).join(", ");
function reportText(r: any, g: Group) {
  const L: string[] = [];
  const st = todayStage(g.start_date);
  L.push(`📊 <b>Kunlik hisobot</b> · ${fmtD(r.day)}, ${WD[r.wd] ?? ""}`);
  if (g.code !== "ASOSIY") L.push(`Jamoa: «${esc(g.name ?? g.code)}»`);
  L.push("", "👥 <b>A'zolar</b>",
    `Jami: <b>${r.total}</b> kishi · Telegramga ulangan: ${r.tg}`,
    r.new.length ? `🆕 Bugun qo'shildi (${r.new.length}): <b>${nmList(r.new)}</b>` : "🆕 Bugun yangi a'zo yo'q",
    `Bugun ilovaga kirgan: <b>${r.active}</b> / ${r.total}`);
  L.push("", st !== null ? `🎯 <b>Bosqich: ${st + 1}. ${esc(r.plan_title || TITLES[st] || "")}</b>` : "🎯 <b>Bosqich</b>");
  if (r.wd > 5) L.push("Dam olish kuni — bosqich yo'q.");
  else if (!r.stage.length) L.push("Bugun hech kim bosqichni o'ynamadi.");
  else {
    L.push(`O'ynadi: <b>${r.stage.length}</b> / ${r.total}`);
    r.stage.forEach((s: any, i: number) => L.push(`${["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} ${esc(s.n)} — <b>${s.p ?? 0}</b> ball (${s.r ?? 0}/${s.d ?? 0} to'g'ri)${s.f ? "" : " · tugatmadi"}`));
  }
  if (r.idle.length) L.push(`😴 O'ynamadi: ${nmList(r.idle)}`);
  if (r.kinds) L.push(`🚪 Hali birorta bosqich o'ynamagan: <b>${r.kinds.never}</b> kishi` + (r.kinds.never_old ? ` (${r.kinds.never_old} tasi 2 kundan ko'p oldin qo'shilgan)` : "") + ` · 2+ ish kuni o'ynamay qo'ygan: <b>${r.kinds.away}</b>`);
  if (r.nick) L.push(`👤 Telegram niki yo'q: <b>${r.nick.no_nick}</b> kishi` + (r.nick.asked ? ` (so'ralgan: ${r.nick.asked})` : "") + (r.nick.set_after_ask ? ` · so'ralgach qo'ydi: ${r.nick.set_after_ask}` : ""));
  if (r.cup_n > 0 || r.duels > 0) {
    L.push("", "⚔️ <b>Duellar</b>");
    if (r.cup_n > 0) {
      L.push(`Kubok: ${r.cup_n} ta duel · o'ynaldi ${r.cup_played}` + (r.cup_forfeit ? ` · kelmaganlik ${r.cup_forfeit}` : "") + (r.cup_cancel ? ` · ikkalasi kelmadi ${r.cup_cancel}` : ""));
      L.push(r.champ ? `🏆 Kun chempioni: <b>${esc(r.champ)}</b>` : "🏆 Chempion hali aniqlanmadi");
    }
    if (r.duels > 0) L.push(`Erkin duellar: ${r.duels} ta`);
  }
  if (r.top.length) {
    L.push("", "📈 <b>Hafta reytingi</b>");
    r.top.forEach((t: any, i: number) => L.push(`${["🥇", "🥈", "🥉"][i]} ${esc(t.n)} — ${fmt(t.x)} ball`));
  }
  L.push("", "💳 <b>To'lovlar</b>");
  if (r.trial) L.push("Sinov rejimi yoqilgan — sotuv to'xtatilgan.");
  L.push(r.pay_n ? `Bugun chek: ${r.pay_n} ta · ${fmt(Number(r.pay_sum))} so'm` : "Bugun yangi chek yo'q");
  if (r.pay_wait) L.push(`⚠️ Tasdiq kutayotgan chek: <b>${r.pay_wait}</b> ta`);
  if (r.expiring.length) L.push(`⏳ Obunasi 3 kunda tugaydi: ${nmList(r.expiring)}`);
  L.push("", r.cron_bad || r.http_bad
    ? `🛠 <b>Tizim:</b> ⚠️ avtomatik ishlarda xato ${r.cron_bad} ta, bot so'rovlarida xato ${r.http_bad} ta`
    : `🛠 <b>Tizim:</b> ✅ hammasi joyida (${r.cron_ok} ta avtomatik ish xatosiz)`);
  return L.join("\n");
}
async function dailyReport() {
  const gm = await groupMap();
  const { data: adm } = await db.from("liga_admin_chats").select("chat_id,group_code");
  let sent = 0; const out: Record<string, unknown> = {};
  for (const code of [...new Set(((adm ?? []) as Chat[]).map((a) => a.group_code))]) {
    const g = gm[code]; if (!g || !g.active) continue;
    const { data: r, error } = await db.rpc("liga_daily_report_sys", { p_code: code });
    if (error || !r) { out[code] = error?.message ?? "no data"; continue; }
    const { data: ptd } = await db.rpc("liga_plan_today_sys"); if (ptd?.[0]) r.plan_title = ptd[0].title?.uz;
    const { data: kinds } = await db.rpc("liga_daily_report_kinds_sys", { p_code: code }); if (kinds) r.kinds = kinds;
    const { data: nick } = await db.rpc("liga_nick_stats_sys", { p_code: code }); if (nick) r.nick = nick;
    const text = reportText(r, g);
    // ishtirokchilar ko'payib, hisobot 4096 belgidan oshib ketdi — qismlarga bo'lib yuboriladi; xato bo'lsa sababini qaytaradi
    const parts = chunks(text), btn = appBtn("🏆 Ligani ochish", g.code !== "ASOSIY" ? `?g=${encodeURIComponent(g.code)}` : "");
    const errs: string[] = [];
    for (const a of (adm as Chat[]).filter((x) => x.group_code === code)) {
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const last = i === parts.length - 1;
        let res = await tg("sendMessage", { chat_id: a.chat_id, parse_mode: "HTML", text: parts[i], reply_markup: last ? btn : undefined });
        if (!res?.ok) res = await tg("sendMessage", { chat_id: a.chat_id, text: parts[i].replace(/<[^>]+>/g, ""), reply_markup: last ? btn : undefined });
        if (!res?.ok) { ok = false; errs.push(String(res?.description ?? "send_failed")); }
        await pause(60);
      }
      if (ok) sent++;
    }
    out[code] = errs.length ? errs.join("; ") : `ok (${parts.length} qism, ${text.length} belgi)`;
  }
  return { ok: true, sent, groups: out };
}
async function lastWeekId(): Promise<string> { const { data } = await db.rpc("liga_last_week_id"); return String(data ?? ""); }
// bir kunda bir xil xabar ikki marta ketmasin
async function once(tag: string) {
  const key = `sent_${tag}_${tzDate().toISOString().slice(0, 10)}`;
  const { error } = await db.from("liga_bot_config").insert({ key, value: new Date().toISOString() });
  return !error;
}

// hali birorta bosqich o'ynamagan (never) va 2+ ish kuni o'ynamay qo'ygan (away) o'yinchilar uchun alohida matn
function kindText(p: any, when: "morning" | "noon" | "remind", c: string): string | null {
  const n = esc(p.first_name ?? ""), s = (p.stage ?? 0) + 1;
  if (p.kind === "never") return {
    morning: tr(p.lang, "👋 <b>{n}, ligaga xush kelibsiz!</b>\nSiz ro'yxatdan o'tgansiz, lekin hali birorta bosqich o'ynamadingiz.\n\nBugun <b>{s}-bosqich</b> ochiq: 20 savol, taxminan 15 daqiqa. Natijangiz faqat sizga ko'rinadi — bemalol sinab ko'ring.\n⏰ Soat {c} gacha.", { n, s, c }),
    noon: tr(p.lang, "👋 <b>{n}, birinchi bosqichingizni boshlang!</b>\nBugungi {s}-bosqich soat {c} gacha ochiq. 15 daqiqa ajrating — xato qilsangiz, to'g'ri javob va tushuntirish ko'rsatiladi.", { n, s, c }),
    remind: tr(p.lang, "⏰ <b>{n}, bugungi bosqich yopilishiga 1 soat qoldi.</b>\nHali birorta bosqich o'ynamadingiz — hoziroq birinchisini boshlang, 15 daqiqa yetadi.", { n }),
  }[when];
  if (p.kind === "away") return {
    morning: tr(p.lang, "☀️ <b>{n}, sizni sog'indik!</b>\nBir necha kundan beri bosqich o'ynamadingiz. Bugun <b>{s}-bosqich</b> ochiq — haftalik ligaga qayting.\n⏰ Soat {c} gacha.", { n, s, c }),
    noon: tr(p.lang, "🕛 <b>{n}, bugun qaytasizmi?</b>\n{s}-bosqich soat {c} gacha ochiq. Har kuni bitta bosqich — haftalik ligada o'rningizni saqlaysiz.", { n, s, c }),
    remind: null,
  }[when];
  return null;
}

// Sovrinli musobaqa e'loni — Telegram'ga ulangan har bir ishtirokchiga shaxsan (o'z tilida)
async function pxAnnounce(limit = 80) {
  const { data: pb } = await db.rpc("liga_px_board_sys", { p_group: "ASOSIY" });
  const b: any = pb ?? {}; const fund = Number(b.fund || 0);
  const fmtS = (n: number) => Number(n || 0).toLocaleString("ru-RU").replace(/\s/g, " ");
  const pr = ((b.split ?? [50, 30, 20]) as number[]).map((x) => fmtS(Math.floor(fund * x / 100)));
  // navbat: tg_user_id bo'yicha tartib, oxirgi yuborilgani px_announce_last da saqlanadi (takror yubormaslik uchun)
  const day = tzDate().toISOString().slice(0, 10), lk = "px_announce_last_" + day;
  const last = Number((await cfgGet(lk)) || 0);
  const { data: ppl } = await db.from("safari_players").select("tg_user_id,first_name,lang").not("tg_user_id", "is", null)
    .gt("tg_user_id", last).order("tg_user_id").limit(limit);
  if (!ppl?.length) return { ok: true, done: true };
  await cfgSet(lk, String((ppl[ppl.length - 1] as any).tg_user_id));   // avval belgilaymiz — vaqt tugasa ham takrorlanmaydi
  let sent = 0, fail = 0;
  for (const p of (ppl ?? []) as any[]) {
    const text = tr("uz", "🏆 <b>{n}, «Sovrinli musobaqa» boshlandi!</b>\n\n💰 Sovrin jamg'armasi: <b>{f} so'm</b>\n🥇 {a} · 🥈 {b} · 🥉 {c} so'm\n\n❓ Faqat savollar: Debet ↔ Kredit, Schyotlar rejasi, Balans bo'limi — har o'yin 60 soniya.\n✅ To'g'ri javob — 10 ball, ketma-ket to'g'ri javoblar uchun +2 dan +10 gacha bonus. Xato — 0 ball.\n📅 G'oliblar 31-oktabr yakunida aniqlanadi — obunasi faol eng yaxshi 3 kishi.\n🎟 Ligaga kirish — har bir kishi uchun oyiga 30 000 so'm.\nBallar liga va kubokka ta'sir qilmaydi.\n\n👉 Ilovada: Asosiy → «Sovrinli musobaqa»",
      { n: esc(p.first_name ?? ""), f: fmtS(fund), a: pr[0] ?? "", b: pr[1] ?? "", c: pr[2] ?? "" });
    if (await dm(p.tg_user_id, text, appBtn("Musobaqaga kirish"))) sent++; else fail++;
  }
  return { ok: true, sent, fail, fund };
}
// 1 soat qoldi: guruhga (nechta kishi o'ynagani bilan) va bajarmaganlarga shaxsan
async function remindAll(w: number, groupText: string) {
  const cnt = await todayCounts();
  const sent = await toChats((g) => {
    if (todayStage(g.start_date) === null) return null;
    const c = cnt[g.code]; return groupText + (c && c.played > 0 ? `\n\n👥 Jamoangizdan <b>${c.played}</b> kishi bugungi bosqichni bajarib bo'ldi. Siz-chi?` : "");
  });
  const { data: list } = await db.rpc("liga_remind_list3"); let personal = 0;
  for (const p of (list ?? []) as any[]) {
    const c = cnt[p.group_code ?? ""];
    const extra = c && c.played > 0 ? "\n" + tr(p.lang, "Jamoangizdan {p} kishi bugungi bosqichni bajarib bo'ldi.", { p: c.played }) : "";
    const kt = kindText(p, "remind", closeStr(w));
    if (kt) { if (await dm(p.tg, kt + extra, appBtn(tr(p.lang, "Bosqichni ochish")))) personal++; continue; }
    if (await dm(p.tg, tr(p.lang, "⏰ <b>{n}, bugungi bosqich hali bajarilmagan!</b>\n{s}-bosqich soat {c} da yopiladi — 1 soat qoldi.", { n: esc(p.first_name ?? ""), s: (p.stage ?? 0) + 1, c: closeStr(w) }) + extra,
      appBtn(tr(p.lang, "Bosqichni ochish")))) personal++;
  }
  return { ok: true, sent, personal };
}

// 12:00 — bugungi bosqichni hali bajarmaganlarga shaxsan (guruhga emas)
async function remindNoon(w: number) {
  const cnt = await todayCounts();
  const { data: list } = await db.rpc("liga_remind_list3"); let personal = 0, total = 0;
  for (const p of (list ?? []) as any[]) {
    total++;
    const c = cnt[p.group_code ?? ""];
    const extra = c && c.played > 0 ? "\n" + tr(p.lang, "Jamoangizdan {p} kishi bugun bajarib bo'ldi.", { p: c.played }) : "";
    const kt = kindText(p, "noon", closeStr(w));
    if (kt) { if (await dm(p.tg, kt + extra, appBtn(tr(p.lang, "Bosqichni ochish")))) personal++; continue; }
    if (await dm(p.tg, tr(p.lang, "🕛 <b>{n}, bugungi {s}-bosqich hali bajarilmagan.</b>\nSoat {c} gacha vaqt bor — hozir 10–15 daqiqa ajrating, keyin unutib qo'yasiz.",
      { n: esc(p.first_name ?? ""), s: (p.stage ?? 0) + 1, c: closeStr(w) }).replace("<b>, ", "<b>") + extra, appBtn(tr(p.lang, "Bosqichni ochish")))) personal++;
  }
  return { ok: true, total, personal };
}

// muhokama guruhi: oddiy a'zolar xabar qadamasin (pin) — faqat adminlar. Boshqa ruxsatlar o'zgarmaydi.
async function discussPerms() {
  const cfg = await discussCfg(); if (!cfg) return { ok: false, why: "no_group" };
  const ch = await tg("getChat", { chat_id: cfg.chat });
  const cur = (ch?.result?.permissions ?? {}) as Record<string, boolean>;
  const perms = { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true,
    can_send_video_notes: true, can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true,
    can_invite_users: true, can_change_info: false, can_manage_topics: false, ...cur, can_pin_messages: false };
  const r = await tg("setChatPermissions", { chat_id: cfg.chat, permissions: perms, use_independent_chat_permissions: true });
  const after = await tg("getChat", { chat_id: cfg.chat });
  return { ok: !!r?.ok, err: r?.ok ? undefined : r?.description, can_pin_messages: after?.result?.permissions?.can_pin_messages };
}

// muhokama guruhi tepasida (qadalgan xabar) guruh havolasi; guruh tavsifiga ham yoziladi
async function discussPin() {
  const cfg = await discussCfg(); if (!cfg) return { ok: false, why: "no_group" };
  const share = "https://t.me/share/url?url=" + encodeURIComponent(cfg.link) + "&text=" + encodeURIComponent("Hisobchi Liga — buxgalterlar guruhi. Qo'shiling:");
  const text = "📌 <b>Hisobchi Liga — ishtirokchilar guruhi</b>\n\n" +
    "🔗 Guruh havolasi — hamkasbingizga yuboring:\n" + cfg.link + "\n\n" +
    "• Har ish kuni 09:00–17:00 — yangi bosqich (juma ham 17:00 gacha).\n" +
    "• Duelga chaqirish: guruhda /duel yozing — birinchi qabul qilgan o'ynaydi, natija shu yerga chiqadi.\n" +
    "• Savol, provodka, qonun — bemalol muhokama qiling. Reklama mumkin emas, bot o'chiradi.";
  const kb = { inline_keyboard: [[{ text: "📤 Havolani yuborish", url: share }], [{ text: "🏆 Ligani ochish", url: deep("ASOSIY") }]] };
  const old = (await db.from("liga_bot_config").select("value").eq("key", "discuss_pin_msg").maybeSingle()).data?.value;
  if (old) await tg("unpinChatMessage", { chat_id: cfg.chat, message_id: Number(old) });
  const sent = await tg("sendMessage", { chat_id: cfg.chat, text, parse_mode: "HTML", reply_markup: kb, disable_web_page_preview: true });
  const mid = sent?.result?.message_id; if (!mid) return { ok: false, why: sent?.description };
  const pin = await tg("pinChatMessage", { chat_id: cfg.chat, message_id: mid, disable_notification: true });
  await db.from("liga_bot_config").upsert({ key: "discuss_pin_msg", value: String(mid) });
  const desc = await tg("setChatDescription", { chat_id: cfg.chat, description: "Hisobchi Liga ishtirokchilari guruhi. Havola: " + cfg.link + " · Duel: /duel · Reklama mumkin emas." });
  return { ok: !!pin?.ok, pinned: !!pin?.ok, pin_err: pin?.ok ? undefined : pin?.description, desc: !!desc?.ok, desc_err: desc?.ok ? undefined : desc?.description, mid };
}

// Markaziy bank kurslari (cbu.uz) — bosh sahifadagi kurs kartasi uchun
async function fetchRates() {
  const r = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/", { headers: { "user-agent": "Mozilla/5.0 HisobchiLiga" } });
  if (!r.ok) return { ok: false, status: r.status };
  const list = (await r.json()) as any[];
  const want = new Set(["USD", "EUR", "RUB", "CNY", "KZT"]); const rows: any[] = [];
  for (const x of list ?? []) {
    if (!want.has(x.Ccy)) continue;
    const [d, m, y] = String(x.Date).split(".");
    rows.push({ ccy: x.Ccy, rate: Number(x.Rate), diff: Number(x.Diff), rate_date: `${y}-${m}-${d}`, updated_at: new Date().toISOString() });
  }
  if (!rows.length) return { ok: false, why: "empty" };
  const { error } = await db.from("liga_rates").upsert(rows);
  return { ok: !error, n: rows.length, date: rows[0]?.rate_date, err: error?.message };
}

// ---------------- SMS (Eskiz.uz): bosqichni bajarmaganlar va kubok dueliga kirmaganlar ----------------
// Login: edge secret ESKIZ_EMAIL / ESKIZ_PASSWORD yoki admin botda /sms_login email parol. Yoqish: /sms on.
// Matnlar o'zgarmas — Eskiz kabinetida shablon sifatida tasdiqlatiladi (o'zgaruvchisiz, shuning uchun moderatsiya oson).
const ESKIZ = "https://notify.eskiz.uz/api";
const SMS_TEXT: Record<string, Record<string, string>> = {
  stage: { uz: "Hisobchi Liga: bugungi bosqich hali bajarilmagan. Soat 17:00 gacha vaqt bor. Kirish: t.me/Buxgalterlar_Ligasi_bot",
           ru: "Hisobchi Liga: этап сегодня не пройден. Успейте до 17:00: t.me/Buxgalterlar_Ligasi_bot" },
  duel: { uz: "Hisobchi Liga: kubok duelingiz ochildi, raqibingiz kutmoqda. Vaqtida kirmasangiz yutqazasiz. Kirish: t.me/Buxgalterlar_Ligasi_bot",
          ru: "Hisobchi Liga: дуэль кубка открыта, соперник ждёт: t.me/Buxgalterlar_Ligasi_bot" },
};
async function cfgGet(key: string) { return (await db.from("liga_bot_config").select("value").eq("key", key).maybeSingle()).data?.value as string | undefined; }
async function cfgSet(key: string, value: string) { await db.from("liga_bot_config").upsert({ key, value }); }
async function eskizToken(fresh = false): Promise<string | null> {
  if (!fresh) { const t = await cfgGet("eskiz_token"); if (t) return t; }
  const email = Deno.env.get("ESKIZ_EMAIL") || (await cfgGet("eskiz_email")), password = Deno.env.get("ESKIZ_PASSWORD") || (await cfgGet("eskiz_password"));
  if (!email || !password) return null;
  const f = new FormData(); f.set("email", email); f.set("password", password);
  const r = await fetch(ESKIZ + "/auth/login", { method: "POST", body: f });
  const j: any = await r.json().catch(() => ({}));
  const t = j?.data?.token; if (!t) return null;
  await cfgSet("eskiz_token", t); return t;
}
async function smsSend(phone: string, text: string): Promise<{ ok: boolean; id?: string; err?: string }> {
  const from = (await cfgGet("sms_from")) || "4546";
  for (let i = 0; i < 2; i++) {
    const tok = await eskizToken(i > 0); if (!tok) return { ok: false, err: "no_login" };
    const f = new FormData(); f.set("mobile_phone", phone.replace(/\D/g, "")); f.set("message", text); f.set("from", from);
    const r = await fetch(ESKIZ + "/message/sms/send", { method: "POST", headers: { Authorization: "Bearer " + tok }, body: f });
    if (r.status === 401) continue;
    const j: any = await r.json().catch(() => ({}));
    if (r.ok && (j?.id || j?.status)) return { ok: true, id: String(j.id ?? "") };
    return { ok: false, err: `${r.status} ${JSON.stringify(j).slice(0, 200)}` };
  }
  return { ok: false, err: "auth_failed" };
}
async function smsTick() {
  const { data, error } = await db.rpc("liga_sms_due"); if (error) return { ok: false, err: error.message };
  let sent = 0, fail = 0;
  for (const x of (data ?? []) as any[]) {
    const r = await smsSend(x.phone, SMS_TEXT[x.kind]?.[x.lang === "ru" ? "ru" : "uz"] ?? SMS_TEXT.stage.uz);
    await db.rpc("liga_sms_mark", { p_id: x.id, p_status: r.ok ? "sent" : "fail", p_provider: r.id ?? null, p_err: r.err ?? null });
    if (r.ok) sent++; else { fail++; if (r.err === "no_login" || r.err === "auth_failed") break; }
  }
  return { ok: true, sent, fail };
}
async function smsStatusText() {
  const { data: p } = await db.rpc("liga_sms_preview");
  const login = !!(Deno.env.get("ESKIZ_EMAIL") || (await cfgGet("eskiz_email")));
  const x: any = p ?? {};
  return `📱 <b>SMS eslatma</b>: ${x.mode === "on" ? "✅ yoqilgan" : "⏸ o'chirilgan"}\n` +
    `Eskiz login: ${login ? "bor" : "<b>yo'q</b> — /sms_login email parol"}\n` +
    `Kunlik chegara: ${x.cap} ta\nBugun yuborildi: ${x.today_sent} · xato: ${x.today_fail}\n\n` +
    `Bugun bosqichni boshlamaganlar: ${x.stage_not_started} (15:00 da SMS)\nKubok dueliga kelmaganlar (5 kun o'rtachasi): ~${x.duel_noshow_5d_avg} ta duel\n\n` +
    `Buyruqlar: /sms on · /sms off · /sms test 998901234567 · /sms cap 400`;
}

async function onCron(action: string, body: any = {}) {
  if (action === "setup") {
    const url = `${SB_URL}/functions/v1/liga-bot`;
    return {
      webhook: await tg("setWebhook", { url, secret_token: await hookSecret(), allowed_updates: ["message", "edited_message", "my_chat_member", "callback_query"], drop_pending_updates: true }),
      // buyruqlar menyusi: oddiy a'zolarga faqat o'zlariga keraklilari, admin buyruqlari faqat guruh adminlariga ko'rinadi
      commands: await Promise.all([
        tg("deleteMyCommands", {}),
        tg("setMyCommands", { scope: { type: "all_private_chats" }, commands: [
          { command: "liga", description: "Ilovani ochish" },
          { command: "natija", description: "Oxirgi hafta natijalari" },
          { command: "tolov", description: "Obuna to'lovi (karta va chek)" },
          { command: "qoida", description: "Liga qoidalari" }] }),
        tg("setMyCommands", { scope: { type: "all_group_chats" }, commands: [
          { command: "duel", description: "Jonli duelga chaqirish" },
          { command: "natija", description: "Oxirgi hafta natijalari" },
          { command: "qoida", description: "Liga qoidalari" }] }),
        tg("setMyCommands", { scope: { type: "all_chat_administrators" }, commands: [
          { command: "duel", description: "Jonli duelga chaqirish" },
          { command: "natija", description: "Oxirgi hafta natijalari" },
          { command: "qoida", description: "Liga qoidalari" },
          { command: "ulash", description: "Guruhni jamoaga ulash (admin)" },
          { command: "muhokama", description: "Muhokama guruhini belgilash (liga admini)" }] }),
      ]),
      menu: await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Liga", web_app: { url: APP } } }),
      desc: await tg("setMyDescription", { description: "Hisobchi Liga — buxgalterlar uchun haftalik musobaqa: har kuni provodka, QQS, ish haqi, soliq va qonunchilik bo'yicha yangi bosqich." }),
      short: await tg("setMyShortDescription", { short_description: "Buxgalterlar uchun haftalik liga" }),
      me: await tg("getMe", {}),
    };
  }
  const w = tzDate().getUTCDay();
  if (action === "day_start") {
    if (w < 1 || w > 5) return { skip: "weekend" };
    if (!(await once("day_start"))) return { skip: "already" };
    const lesson = await lessonOfDay();
    const { data: ptd } = await db.rpc("liga_plan_today_sys"); const plan = (ptd ?? [])[0] as any;   // sanaga bog'langan kunlik reja
    const n = await toChats((g) => {
      const si = todayStage(g.start_date);
      if (si === null) return null;                       // jamoa hali boshlanmagan
      const head = w === 1
        ? "🚀 <b>Yangi liga haftasi boshlandi!</b>\n\nLiga bugundan <b>juma soat 17:00</b> gacha davom etadi."
        : "☀️ <b>Bugungi o'yin boshlandi!</b>";
      const topic = plan ? `${plan.icon ? plan.icon + " " : ""}${esc(plan.title?.uz ?? "")}` : TITLES[si];
      const what = plan ? "15 provodka + 5 qonun savoli, " + plan.level + "-daraja qiyinlik" : "20 savol";
      return `${head}\n📚 Bugun <b>${si + 1}-bosqich: ${topic}</b> ochildi (${what}).\n⏰ Bosqich <b>${closeStr(w)}</b> gacha ochiq, keyin yopiladi.\n⏱ Har savolga 2 daqiqa.${lesson ? `\n\n📘 <b>Bugungi dars:</b> ${esc(lesson.uz.title)}\n${esc(lesson.uz.body)}` : ""}\n\nOmad, buxgalterlar! 💪`;
    });
    // guruhlarga kunning savoli (so'rovnoma)
    let polls = 0; const gm = await groupMap();
    for (const c of await chats()) if (groupOk(gm[c.group_code]) && todayStage(gm[c.group_code].start_date) !== null && await sendDailyPoll(c.chat_id)) polls++;
    // har o'yinchiga shaxsan
    const { data: list } = await db.rpc("liga_morning_list3"); let personal = 0;
    for (const p of (list ?? []) as any[]) {
      const msg = kindText(p, "morning", closeStr(w)) ?? (plan
        ? tr(p.lang, "☀️ <b>Xayrli tong, {n}!</b>\nBugun <b>{s}-bosqich: «{t}»</b> ochildi — 15 provodka + 5 qonun savoli.\n⏰ Soat {c} gacha ochiq.", { n: esc(p.first_name ?? ""), s: (p.stage ?? 0) + 1, c: closeStr(w), t: esc((p.lang === "ru" ? plan.title?.ru : plan.title?.uz) ?? "") })
        : tr(p.lang, "☀️ <b>Xayrli tong, {n}!</b>\nBugun <b>{s}-bosqich</b> ochildi — 20 savol.\n⏰ Soat {c} gacha ochiq.", { n: esc(p.first_name ?? ""), s: (p.stage ?? 0) + 1, c: closeStr(w) }));
      if (await dm(p.tg, msg,
        appBtn(tr(p.lang, "Bosqichni boshlash")))) personal++;
    }
    // soliq taqvimi — shaxsan
    let tax = 0; const due = await taxDue();
    if (due.length) {
      const { data: tl } = await db.rpc("liga_tax_remind_list");
      for (const p of (tl ?? []) as any[]) {
        const lines = due.map((x) => "• <b>" + (x.n === 1 ? tr(p.lang, "{d} (ertaga)", { d: dayName(x.date, p.lang) }) : tr(p.lang, "{d} ({n} kun qoldi)", { d: dayName(x.date, p.lang), n: x.n })) + "</b>: " + esc(p.lang === "ru" ? (x.title_ru || x.title_uz) : tr(p.lang, x.title_uz)));
        if (await dm(p.tg, tr(p.lang, "📅 <b>Soliq taqvimi</b>") + "\n" + lines.join("\n") + "\n\n" + tr(p.lang, "Muddatni o'tkazib yubormang — jarima bo'lmasin!"),
          appBtn(tr(p.lang, "Mashq qilish"), due[0].topic ? "?tp=" + due[0].topic : ""))) tax++;
      }
    }
    // qonun yangiligi — guruhlarga (bir marta)
    let news = 0;
    const { data: nw } = await db.from("liga_news").select("id,title_uz,body_uz,url").eq("active", true).is("posted_at", null)
      .gte("created_at", new Date(Date.now() - 14 * 864e5).toISOString()).order("created_at").limit(1);
    if (nw?.[0]) {
      const x = nw[0], body = x.body_uz.length > 700 ? x.body_uz.slice(0, 700) + "…" : x.body_uz;
      news = await toChats(() => `⚖️ <b>Qonun yangiligi</b>\n<b>${esc(x.title_uz)}</b>\n\n${esc(body)}${x.url ? `\n\n🔗 Manba: ${esc(x.url)}` : ""}\n\nIlovada shu yangilik bo'yicha qisqa test bor 👇`);
      await db.from("liga_news").update({ posted_at: new Date().toISOString() }).eq("id", x.id);
    }
    // kunlik duel kubogi: tasodifiy juftlar 09:00 da (duellar 10:00 dan, 12:00–14:00 tanaffus, final 17:00), jadval — hammaga va guruhga
    let duels = 0;
    const { data: dp } = await db.rpc("liga_cup_start_sys");
    if (((dp ?? []) as any[]).some((x) => x.fresh)) duels = await cupBroadcast((dp ?? []) as any[]);
    // dushanba — jamoalar bellashuvi juftlari
    let pairs = 0;
    if (w === 1) {
      const { data: mp } = await db.rpc("liga_match_pair_sys"); const gm2 = await groupMap();
      for (const x of (mp ?? []) as any[]) for (const [me, op] of [[x.a_code, x.b_code], [x.b_code, x.a_code]]) {
        const o = gm2[op]; if (!o) continue;
        for (const c of await chatsOf(me)) {
          await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", reply_markup: openBot(me),
            text: `⚔️ <b>Jamoalar bellashuvi!</b>\n\nBu hafta raqibingiz: <b>«${esc(o.name)}»</b>.\nJamoa bali — eng yaxshi 3 kishining haftalik bali yig'indisi.\nG'olib juma 17:00 da e'lon qilinadi. Har kuni bosqichni bajaring — jamoangizni yutqazib qo'ymang! 💪` });
          pairs++;
        }
      }
    }
    const names = await fillNames(150).catch(() => null);
    const invites = await inviteAll(300).catch(() => null);
    const perms = await discussPerms().catch(() => null);   // guruhda pin — faqat adminlar
    return { ok: true, sent: n, polls, personal, tax, news, pairs, duels, names, invites, perms };
  }
  if (action === "duel_due") {
    // kubok: yangi bosqich jufti, 5 daqiqa qoldi, boshlandi, g'olib
    const { data } = await db.rpc("liga_cup_due_sys"); let sent = 0; const champG = new Set<string>();
    for (const x of (data ?? []) as any[]) {
      const st = x.stage ?? "", s5 = x.slot ? String(x.slot).slice(0, 5) : "";
      let text = "", btn: unknown = x.code ? appBtn(tr(x.lang, "Duelga kirish"), "?d=" + x.code) : appBtn(tr(x.lang, "Ligani ochish"));
      if (x.kind === "pair") text = tr(x.lang, "🎉 <b>Siz {st}ga chiqdingiz!</b>\nRaqib: <b>{o}</b>, soat <b>{s}</b>. Faqat provodka, 15 savol, har biriga 1,5 daqiqa. Duel 30 daqiqa ochiq.", { st: stageTo(st, x.lang), o: esc(x.opp_name ?? ""), s: s5 });
      else if (x.kind === "five") text = "<b>" + stageName(st, x.lang) + "</b>\n" + tr(x.lang, "⏳ <b>Duelga 5 daqiqa qoldi!</b>\nSoat {s} da raqibingiz <b>{o}</b> bilan bellashasiz. Ilovani oching.", { s: s5, o: esc(x.opp_name ?? "") });
      else if (x.kind === "start") {
        const [h, mi] = s5.split(":").map(Number), em = h * 60 + mi + 30, e = `${String(Math.floor(em / 60)).padStart(2, "0")}:${String(em % 60).padStart(2, "0")}`;
        text = "<b>" + stageName(st, x.lang) + "</b>\n" + tr(x.lang, "🔔 <b>Duel boshlandi!</b>\nRaqibingiz <b>{o}</b>. Soat {e} gacha kiring — kelmasangiz, duel raqibga beriladi.", { o: esc(x.opp_name ?? ""), e });
      } else if (x.kind === "champ") { text = tr(x.lang, "🏆 <b>Bugungi duel kubogi g'olibi — {n}!</b>\nTabriklaymiz! Keyingi kubok — keyingi ish kuni: juftlar 09:00 da, duellar 10:00 dan.", { n: esc(x.extra ?? "") }); champG.add(x.group_code + "|" + (x.extra ?? "")); }
      if (text && ["pair", "five", "start"].includes(x.kind)) text += await oppLine(x.code, x.tg, x.lang);
      if (text && await dm(x.tg, text, btn)) sent++;
    }
    // duelda yutgan, lekin ochko bo'yicha keyingi bosqichga kirmaganlar (g'oliblar soni 2 ning darajasiga qisqartiriladi)
    const { data: cut } = await db.rpc("liga_cup_cut_due_sys");
    for (const x of (cut ?? []) as any[]) {
      const text = tr(x.lang, "🏁 <b>{n}, siz duelda yutdingiz, lekin bugun keyingi bosqichga chiqa olmadingiz.</b>\nBu raundda {w} kishi yutdi — keyingi bosqichga ochkosi eng ko'p {k} kishi o'tadi (teng ochkoda — tezroq javob bergan). Sizning ochkongiz: {p}.\nErtaga yana kubok — omad!", { n: esc(x.name ?? ""), w: x.winners, k: x.keep, p: x.pts ?? 0 });
      if (await dm(x.tg, text, appBtn(tr(x.lang, "Ligani ochish")))) sent++;
    }
    for (const k of champG) { const [code, nm] = k.split("|"); const ct = tr("uz", "🏆 <b>Bugungi duel kubogi g'olibi — {n}!</b>\nTabriklaymiz! Keyingi kubok — keyingi ish kuni: juftlar 09:00 da, duellar 10:00 dan.", { n: esc(nm) });
      for (const c of await chatsOf(code)) await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", reply_markup: openBot(code), text: ct });
      if (code === "ASOSIY") await toChannels(ct, openBot(code)); }
    return { ok: true, sent };
  }
  if (action === "tg_names") return await fillNames(500);
  if (action === "nick_ask" || action === "nick_ask_now") {
    if (action === "nick_ask" && (w < 1 || w > 5 || !(await once("nick_ask")))) return { skip: true };
    return await nickAsk(Number(body.limit) || 500);
  }
  if (action === "discuss_invite") return await inviteAll(1000);
  if (action === "group_due") return await groupDue();
  if (action === "channel_cup") { const t = await cupFullText(); return { sent: t ? await toChannels(t, openBot("ASOSIY")) : 0, channels: (await channels()).length }; }
  // muhokama guruhi holati: guruh, botning huquqlari, havola; fix=true bo'lsa — yangi havola yaratib saqlaydi
  if (action === "discuss_diag") {
    const cfg = await discussCfg(); if (!cfg) return { skip: "no_group" };
    const me = await tg("getMe", {}), chat = await tg("getChat", { chat_id: cfg.chat });
    const bm = await tg("getChatMember", { chat_id: cfg.chat, user_id: me?.result?.id });
    const out: any = { cfg, chat: { ok: chat?.ok, type: chat?.result?.type, title: chat?.result?.title, err: chat?.description, migrated_to: chat?.parameters?.migrate_to_chat_id },
      bot: { status: bm?.result?.status, can_invite: bm?.result?.can_invite_users, can_delete: bm?.result?.can_delete_messages, can_restrict: bm?.result?.can_restrict_members, err: bm?.description } };
    const ad = await tg("getChatAdministrators", { chat_id: cfg.chat });
    out.admins = ((ad?.result ?? []) as any[]).map((a) => ({ name: [a.user?.first_name, a.user?.last_name].filter(Boolean).join(" "), username: a.user?.username, bot: a.user?.is_bot,
      status: a.status, can_restrict: a.can_restrict_members, can_promote: a.can_promote_members, can_change_info: a.can_change_info, custom_title: a.custom_title }));
    if (body.fix && chat?.ok) {
      const inv = await tg("createChatInviteLink", { chat_id: cfg.chat, name: "Hisobchi Liga " + new Date().toISOString().slice(0, 16) });
      out.new_link = inv?.result?.invite_link ?? null; out.link_err = inv?.description;
      if (out.new_link) await db.rpc("liga_discuss_move_sys", { p_chat: cfg.chat, p_link: out.new_link });
    }
    return out;
  }
  if (action === "group_live") return await groupLive(String(body.code ?? ""));
  // holatni tekshirish (hech narsa yubormaydi): kim guruhda, kimga yetgan, kimga yetmagan
  if (action === "discuss_check" || action === "discuss_resend") {
    const cfg = await discussCfg(); if (!cfg) return { skip: "no_group" };
    const { data } = await db.rpc("liga_discuss_all_sys"); const out: Record<string, number> = {};
    for (const p of (data ?? []) as any[]) {
      const mem = await tg("getChatMember", { chat_id: cfg.chat, user_id: p.tg }); const st = mem?.result?.status;
      let r: string;
      if (["member", "administrator", "creator", "restricted"].includes(st)) { r = "in"; await db.rpc("liga_discuss_mark2_sys", { p_tg: p.tg, p_status: "in" }); }
      else if (action === "discuss_resend" && st !== "kicked") r = await inviteOne(cfg, p.tg, p.lang, p.first_name);
      else r = "not_in:" + (p.status ?? "unknown");
      out[r] = (out[r] ?? 0) + 1; await pause(35);
    }
    return out;
  }
  if (action === "cup_schedule") {
    // kubok jadvalini hozir hammaga yuborish (o'zgartirishdan keyin)
    const { data: dp } = await db.rpc("liga_cup_start_sys");
    return { ok: true, sent: await cupBroadcast((dp ?? []) as any[]) };
  }
  // Sovrinli musobaqa (ilgari «Mashq zali»): bir martalik shaxsiy e'lon — liga_bot_config.px_announce_day kuni 09:05 da (cron liga-musobaqa-elon)
  if (action === "px_announce" || action === "px_announce_now") {
    // cron 09:05–09:20 har daqiqa chaqiradi — faqat belgilangan kuni (px_announce_day), har safar navbatdagi 80 kishiga; hammaga yetgach to'xtaydi
    if (action === "px_announce" && (await cfgGet("px_announce_day")) !== tzDate().toISOString().slice(0, 10)) return { skip: true };
    return await pxAnnounce(Number(body.limit) || 80);
  }
  // Sovrinli musobaqa: ish kunlari 18:30 da guruh(lar) va kanalga oylik jamg'arma va top-5 (ligadan alohida reyting)
  if (action === "px_board" || action === "px_board_now") {
    if (action === "px_board" && (w < 1 || w > 5 || !(await once("px_board")))) return { skip: true };
    const { data: pb } = await db.rpc("liga_px_board_sys", { p_group: "ASOSIY" });
    const b: any = pb ?? {}; const top = (b.top ?? []) as any[];
    const fmtS = (n: number) => Number(n || 0).toLocaleString("ru-RU").replace(/\s/g, " ");
    const md = ["🥇", "🥈", "🥉", "4.", "5."];
    const prizes = ((b.split ?? []) as number[]).map((x) => Math.floor((b.fund || 0) * x / 100));
    const text = `🏆 <b>Sovrinli musobaqa</b> — oylik reyting\n\n` +
      (b.fund > 0 ? `💰 Sovrin jamg'armasi: <b>${fmtS(b.fund)} so'm</b>\n${prizes.slice(0, 3).map((p, i) => `${md[i]} ${fmtS(p)}`).join(" · ")}\n\n` : "") +
      (top.length ? top.map((x, i) => `${md[i]} ${esc(x.name ?? "")} — ${fmtS(x.pts)} ball`).join("\n") : "Hali hech kim o'ynamagan — birinchi bo'ling!") +
      `\n\nBugun ${b.today_games ?? 0} ta o'yin o'ynaldi. Faqat savollar: Debet ↔ Kredit, Schyotlar rejasi, Balans bo'limi — har biri 60 soniya.\n` +
      `To'g'ri javob — 10 ball (+2…+10 seriya bonusi). Ballar liga baliga qo'shilmaydi. Sovrin — oy oxirida obunasi faol kuchli uchlikka. Ligaga kirish — oyiga 30 000 so'm.`;
    let n = 0;
    for (const c of await chatsOf("ASOSIY")) { const r = await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", text, reply_markup: openBot("ASOSIY") }); if (r?.ok) n++; await pause(60); }
    n += await toChannels(text, openBot("ASOSIY"));
    return { ok: true, sent: n };
  }
  if (action === "rates") return await fetchRates();
  if (action === "sms_tick") return await smsTick();
  if (action === "remind_noon") {
    if (w < 1 || w > 5 || !(await once("remind_noon"))) return { skip: true };
    return await remindNoon(w);
  }
  if (action === "discuss_pin") return await discussPin();
  if (action === "discuss_perms") return await discussPerms();
  if (action === "remind") {
    // juma kuni eslatma friday_warn (16:00) da ketadi — u liga yakunini ham eslatadi
    if (w < 1 || w > 4 || !(await once("remind"))) return { skip: true };
    return await remindAll(w, "⏰ <b>Eslatma:</b> bugungi bosqich yopilishiga <b>1 soat</b> qoldi — soat 17:00 gacha bajaring!");
  }
  if (action === "tiers") {
    if (!(await once("tiers"))) return { skip: "already" };
    const { data: n } = await db.rpc("liga_tiers_run");
    const { data: wk } = await db.rpc("liga_last_week_id");
    const { data: ch } = await db.from("liga_tier_log").select("player_id,before,after").eq("week_id", wk).neq("before", -1);
    let msg = 0;
    for (const c of (ch ?? []) as any[]) {
      if (c.before === c.after) continue;
      const { data: p } = await db.from("safari_players").select("tg_user_id,lang").eq("id", c.player_id).maybeSingle();
      if (!p?.tg_user_id) continue;
      const tn = (p.lang === "ru" ? TIER_RU : TIER_UZ)[c.after];
      const text = c.after > c.before ? tr(p.lang, "🏅 <b>Tabriklaymiz! Siz {t} ligaga ko'tarildingiz.</b>", { t: tn }) : tr(p.lang, "Siz {t} ligaga tushdingiz. Bu hafta ko'proq bosqich bajaring — qaytasiz!", { t: tn });
      await tg("sendMessage", { chat_id: p.tg_user_id, parse_mode: "HTML", text, reply_markup: appBtn("🏆 Hisobchi Liga") }); msg++;
    }
    return { ok: true, players: n, notified: msg };
  }
  if (action === "day_end") {
    // juma: bosqich 17:00 da yopiladi, o'sha paytda haftalik natijalar chiqadi (league_end) — alohida xabar kerak emas
    if (w < 1 || w > 4 || !(await once("day_end"))) return { skip: true };
    const tail = w === 4 ? "Ertaga — haftaning oxirgi kuni: bosqich <b>09:00–17:00</b>, liga <b>juma 17:00</b> da yakunlanadi va natijalar shu guruhga chiqadi." :
      "Ertaga soat 09:00 da yangi bosqich ochiladi. Liga natijalari <b>juma 17:00</b> da e'lon qilinadi.";
    const cnt = await todayCounts(); let winners = 0;
    const sent = await toChats(async (g) => {
      if (todayStage(g.start_date) === null) return null;
      const c = cnt[g.code], who = c && c.played > 0 ? `\n👥 Bugun <b>${c.played}</b> kishi bosqichni yakunladi.` : "";
      const top = await dayTop(g.code);
      return `🔔 <b>Bugungi o'yin tugadi!</b>\n\nBugungi bosqich yopildi.${who}${top.length ? "\n\n" + dayTopText(top, w) : ""}\n\n${tail}`;
    });
    const gm = await groupMap();
    for (const code of Object.keys(gm)) if (groupOk(gm[code])) winners += await dayTopDm(await dayTop(code), w);
    return { ok: true, sent, winners };
  }
  if (action === "friday_warn") {
    if (w !== 5 || !(await once("friday_warn"))) return { skip: true };
    return await remindAll(5, "⏳ <b>Liga tugashiga 1 soat qoldi!</b>\n\nSoat 17:00 da bugungi bosqich yopiladi va haftalik liga yakunlanadi. Oxirgi imkoniyat — ballaringizni oshiring! 🔥");
  }
  if (action === "results" || action === "league_end") {
    if (!(await once("league_end"))) return { skip: true };
    const gm = await groupMap();
    const sent = await toChats(async (g) => "🏁 <b>Haftalik liga tugadi!</b>\n\n" + (await resultsText(g.code)).replace(/^🏁 <b>[^<]*<\/b>\n\n/, ""));
    // guruh boti ulanmagan jamoalar ham natijani hisoblasin (liga_week_results)
    for (const code of Object.keys(gm)) if (groupOk(gm[code])) await db.rpc("liga_results_group", { p_code: code, p_id: null });
    const { data: list } = await db.rpc("liga_week_personal"); let personal = 0;
    for (const p of (list ?? []) as any[]) {
      const text = p.pos && p.week_xp > 0
        ? tr(p.lang, "🏁 <b>Hafta yakunlandi!</b>\n{m} Siz jamoada <b>{p}-o'rin</b>ni egalladingiz ({n} kishidan).\n💰 Haftalik ball: <b>{x}</b>\n\nDarajangiz 12:10 da yangilanadi. Yangi hafta dushanba 09:00 da.",
            { m: ["👑", "🥈", "🥉"][p.pos - 1] ?? "🏅", p: p.pos, n: p.n, x: p.week_xp })
        : tr(p.lang, "🏁 <b>Hafta yakunlandi.</b>\nBu hafta bosqich o'ynamadingiz. Dushanba 09:00 da yangi hafta — qaytib keling! 💪");
      if (await dm(p.tg, text, appBtn(tr(p.lang, "Natijalarni ko'rish")))) personal++;
    }
    // haftalik kuchli uchlikka medal va QR kodli sertifikat — avtomatik, g'olibga shaxsan havola
    let certs = 0;
    const { data: cl } = await db.rpc("liga_cert_issue_week_sys", { p_week: await lastWeekId() });
    for (const c of (cl ?? []) as any[]) {
      if (!c.tg) continue;
      if (await dm(c.tg, tr(c.lang, "{m} <b>Tabriklaymiz, {n}! Siz haftalik ligada {p}-o'rinni egalladingiz.</b>\nMedalingiz va QR kodli sertifikatingiz tayyor — uni ish beruvchingizga ham ko'rsatishingiz mumkin.", { m: ["🥇", "🥈", "🥉"][c.pos - 1] ?? "🏅", n: esc(c.name ?? ""), p: c.pos }),
        appBtn(tr(c.lang, "Sertifikatni ochish"), "?v=" + c.cert))) certs++;
    }
    // juma bosqichining kuchli uchligi (mukofot — dushanba)
    let winners = 0;
    if (w === 5) for (const code of Object.keys(gm)) {
      if (!groupOk(gm[code])) continue;
      const top = await dayTop(code); if (!top.length) continue;
      for (const c of await chatsOf(code)) await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", text: dayTopText(top, 5), reply_markup: openBot(code) });
      winners += await dayTopDm(top, 5);
    }
    // jamoalar bellashuvi natijasi
    let matches = 0;
    const { data: mc } = await db.rpc("liga_match_close_sys");
    for (const x of (mc ?? []) as any[]) {
      const A = gm[x.a_code]?.name ?? x.a_code, B = gm[x.b_code]?.name ?? x.b_code;
      const win = x.a_xp === x.b_xp ? "🤝 Durang!" : `🏆 G'olib: <b>«${esc(x.a_xp > x.b_xp ? A : B)}»</b>`;
      const text = `⚔️ <b>Jamoalar bellashuvi natijasi</b>\n\n«${esc(A)}» — <b>${x.a_xp}</b>\n«${esc(B)}» — <b>${x.b_xp}</b>\n\n${win}\nKeyingi raqib dushanba kuni e'lon qilinadi.`;
      for (const code of [x.a_code, x.b_code]) for (const c of await chatsOf(code)) { await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", text, reply_markup: openBot(code) }); matches++; }
    }
    return { ok: true, sent, personal, matches, winners, certs };
  }
  if (action === "daily_report" || action === "daily_report_now") {
    // har kuni 20:00 (Toshkent) — jamoa adminlariga kunlik hisobot; "_now" — sinov uchun takror yuborish
    if (action === "daily_report" && !(await once("daily_report"))) return { skip: "already" };
    return await dailyReport();
  }
  if (action === "announce_oct") {
    // 13.10.2026: oktyabr yangiliklari — hammaga bir marta (guruhlar + har o'yinchiga shaxsan)
    if (!(await once("announce_oct"))) return { skip: "already" };
    const sent = await toChats(() => tr("uz", ANNOUNCE_OCT));
    const { data: ppl } = await db.from("safari_players").select("tg_user_id,lang").not("tg_user_id", "is", null);
    let personal = 0;
    for (const p of (ppl ?? []) as any[]) if (await dm(p.tg_user_id, tr(p.lang, ANNOUNCE_OCT), appBtn(tr(p.lang, "Ligani ochish")))) personal++;
    return { ok: true, groups: sent, personal };
  }
  if (action.startsWith("receipt:")) return await notifyAdmins(Number(action.slice(8)));
  if (action.startsWith("receipt_done:")) {
    const { data: i } = await db.from("liga_invoices").select("status,tg_chat_id,player_id").eq("id", Number(action.slice(13))).maybeSingle();
    if (!i) return { error: "no invoice" };
    const { data: pl } = await db.from("safari_players").select("tg_user_id,paid_until,lang").eq("id", i.player_id).maybeSingle();
    return { sent: await receiptNotify({ status: i.status, player_chat: i.tg_chat_id ?? pl?.tg_user_id, paid_until: pl?.paid_until, lang: pl?.lang }) };
  }
  if (action === "status") {
    const gm = await groupMap();
    return { webhook: await tg("getWebhookInfo", {}), chats: await chats(),
      stages: Object.fromEntries(Object.values(gm).map((g) => [g.code, todayStage(g.start_date)])) };
  }
  return { error: "unknown action" };
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const jres = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...CORS } });
async function authOk(pid: string, token: string) { const { data } = await db.rpc("liga_auth", { p_id: pid, p_token: token }); return data === true; }
async function onApp(req: Request) {
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  if (action === "duel_done") {
    if (!b.p_id || !(await authOk(b.p_id, b.token))) return jres({ error: "bad_token" }, 403);
    const { data: d } = await db.from("liga_duels").select("*").eq("code", String(b.code || "").toUpperCase()).maybeSingle();
    if (!d) return jres({ error: "not_found" }, 404);
    const ids = [d.a_id, d.b_id].filter(Boolean);
    const { data: ps } = await db.from("safari_players").select("id,first_name,last_name,tg_user_id,lang").in("id", ids);
    const P = (id: string) => (ps ?? []).find((x: any) => x.id === id) as any;
    const A = P(d.a_id), B = d.b_id ? P(d.b_id) : null, nm = (x: any) => x ? esc(((x.first_name ?? "") + " " + (x.last_name ?? "").slice(0, 1) + ".").trim()) : "—";
    if (d.a_score != null && d.b_score != null) {
      const win = d.a_score !== d.b_score ? (d.a_score > d.b_score ? "a" : "b") : d.a_ms === d.b_ms ? "tie" : d.a_ms < d.b_ms ? "a" : "b";
      for (const [side, x] of [["a", A], ["b", B]] as [string, any][]) {
        if (!x?.tg_user_id) continue;
        const wtxt = win === "tie" ? tr(x.lang, "🤝 Durang!") : win === side ? tr(x.lang, "🏆 Siz yutdingiz!") : tr(x.lang, "Bu safar raqib kuchliroq. Yana chaqiring!");
        await tg("sendMessage", { chat_id: x.tg_user_id, parse_mode: "HTML", text: tr(x.lang, "⚔️ <b>Duel yakunlandi!</b>\n{a} — {as} · {b} — {bs}\n\n{w}", { a: nm(A), as: d.a_score, b: nm(B), bs: d.b_score, w: wtxt }), reply_markup: appBtn(tr(x.lang, "Duelni ochish"), "?d=" + d.code) });
      }
    } else if (d.b_score != null && A?.tg_user_id) {
      await tg("sendMessage", { chat_id: A.tg_user_id, parse_mode: "HTML", text: tr(A.lang, "⚔️ <b>{n} duelingizni qabul qildi va o'ynadi.</b>\nEndi navbat sizda!", { n: nm(B) }), reply_markup: appBtn(tr(A.lang, "Duelni ochish"), "?d=" + d.code) });
    }
    return jres({ ok: true });
  }
  if (action === "stage_done") {
    if (!b.p_id || !(await authOk(b.p_id, b.token))) return jres({ error: "bad_token" }, 403);
    const si = Math.max(0, Math.min(11, Number(b.si) || 0));
    const { data: p } = await db.from("safari_players").select("tg_user_id,lang,week_stages").eq("id", b.p_id).maybeSingle();
    if (!p?.tg_user_id) return jres({ ok: false, reason: "no_tg" });
    if (!(await once(`sd_${b.p_id}_${si}`))) return jres({ ok: true, dup: true });
    const ws = (p.week_stages ?? {}) as Record<string, number>, x = Number(ws[String(si)] ?? 0);
    const week = Object.values(ws).reduce((a, v) => a + (Number(v) || 0), 0), w = tzDate().getUTCDay();
    const next = w === 5 ? tr(p.lang, "Liga bugun 17:00 da yakunlanadi — natijalar shu yerga keladi.") : w === 4 ? tr(p.lang, "Ertaga 09:00 da yangi bosqich ochiladi.") + " " + tr(p.lang, "Natijalar juma 17:00 da shu yerga keladi.")
      : tr(p.lang, "Ertaga 09:00 da yangi bosqich ochiladi.");
    const total = Math.max(1, Math.min(20, Number(b.total) || 20)), right = Math.max(0, Math.min(total, Number(b.right) || 0));
    const ok = await dm(p.tg_user_id, tr(p.lang, "✅ <b>{s}-bosqich yakunlandi!</b>\n🎯 {r}/{t} to'g'ri {st}\n💰 Bosqich bali: <b>{x}</b>\n📊 Shu hafta jami: <b>{w} ball</b>\n\n{next}",
      { s: si + 1, r: right, t: total, st: stars(Number(b.stars) || 0), x, w: week, next }), appBtn(tr(p.lang, "Ligani ochish")));
    return jres({ ok });
  }
  // quyidagilar faqat Telegram ichidan (initData tekshiriladi)
  const user = await checkInit(String(b.initData || ""));
  if (!user) return jres({ error: "no_telegram" }, 403);
  await seen(user);
  // Telegram hisobi orqali kirish (telefon, kompyuter — qaysi qurilma bo'lmasin)
  if (action === "tg_login") {
    const { data } = await db.rpc("liga_tg_login_sys", { p_tg: user.id });
    return jres(data ? { found: true, ...data } : { found: false });
  }
  if (!b.p_id || !(await authOk(b.p_id, b.token))) return jres({ error: "bad_token" }, 403);
  if (action === "link") {
    const { data } = await db.rpc("liga_tg_link_sys", { p_id: b.p_id, p_token: b.token, p_tg: user.id });
    if (data === true) { await seen(user); const cfg = await discussCfg(); if (cfg) await inviteOne(cfg, user.id, await playerLang(user.id), user.first_name).catch(() => null); }
    return jres({ ok: data === true });
  }
  if (action === "card") {
    const img = String(b.image || ""); const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(img);
    if (!m || img.length > 3_000_000) return jres({ error: "bad_image" }, 400);
    const { data: pl } = await db.from("safari_players").select("ref_code,lang").eq("id", b.p_id).maybeSingle();
    const ref = `https://t.me/${BOT}?start=r_${pl?.ref_code ?? ""}`;
    const caption = tr(pl?.lang, "Mening natijam — Hisobchi Liga 🏆\nSiz ham qo'shiling:") + " " + ref;
    const fd = new FormData(); fd.append("chat_id", String(user.id)); fd.append("caption", tr(pl?.lang, "Kartochkangiz tayyor — endi uni istalgan chatga yuborishingiz mumkin."));
    fd.append("photo", new Blob([Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))], { type: "image/" + m[1] }), "liga.jpg");
    const sent = await (await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: "POST", body: fd })).json();
    const fid = sent?.result?.photo?.slice(-1)[0]?.file_id; if (!fid) return jres({ error: "send_failed" }, 500);
    const prep = await tg("savePreparedInlineMessage", { user_id: user.id, allow_user_chats: true, allow_group_chats: true, allow_channel_chats: true,
      result: { type: "photo", id: "c" + Date.now(), photo_file_id: fid, caption, reply_markup: { inline_keyboard: [[{ text: tr(pl?.lang, "Ligaga qo'shilish"), url: ref }]] } } });
    return jres({ id: prep?.result?.id ?? null });
  }
  return jres({ error: "unknown" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (new URL(req.url).pathname.endsWith("/app")) { try { return await onApp(req); } catch (e) { console.error(e); return jres({ error: "server" }, 500); } }
  if (req.method !== "POST" || !TOKEN) return new Response("ok");
  const tgSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (tgSecret) {
    if (tgSecret !== await hookSecret()) return new Response("forbidden", { status: 403 });
    try { await onUpdate(await req.json()); } catch (e) { console.error(e); }
    return new Response("ok");
  }
  const key = req.headers.get("x-cron-key");
  const { data } = await db.from("liga_bot_config").select("value").eq("key", "cron_key").single();
  if (!key || !data || key !== data.value) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  const out = await onCron(body.action ?? "", body);
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
});
