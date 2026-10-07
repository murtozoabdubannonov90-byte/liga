// Hisobchi Liga — Telegram bot (@Buxgalterlar_Ligasi_bot)
// Token Supabase Secrets'da: TELEGRAM_BOT_TOKEN. Kodda token yo'q.
// Jamoalar: har bir Telegram guruh /ulash KOD bilan bitta jamoaga bog'lanadi; natijalar va bosqich xabarlari jamoa bo'yicha.
import { createClient } from "npm:@supabase/supabase-js@2";

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
  "✅ <b>{s}-bosqich yakunlandi!</b>\n🎯 {r}/{t} to'g'ri {st}\n💰 Bosqich bali: <b>{x} XP</b>\n📊 Shu hafta jami: <b>{w} XP</b>\n\n{next}": "✅ <b>Этап {s} пройден!</b>\n🎯 Верно: {r}/{t} {st}\n💰 Баллы за этап: <b>{x} XP</b>\n📊 Всего за неделю: <b>{w} XP</b>\n\n{next}",
  "Ertaga 09:00 da yangi bosqich ochiladi.": "Завтра в 09:00 откроется новый этап.",
  "Dushanba 09:00 da yangi bosqich ochiladi.": "В понедельник в 09:00 откроется новый этап.",
  "Liga bugun 12:00 da yakunlanadi — natijalar shu yerga keladi.": "Лига завершится сегодня в 12:00 — результаты придут сюда.",
  "Natijalar juma 12:00 da shu yerga keladi.": "Результаты придут сюда в пятницу в 12:00.",
  "☀️ <b>Xayrli tong, {n}!</b>\nBugun <b>{s}-bosqich</b> ochildi — 20 savol.\n⏰ Soat {c} gacha ochiq.": "☀️ <b>Доброе утро, {n}!</b>\nСегодня открыт <b>этап {s}</b> — 20 вопросов.\n⏰ Открыт до {c}.",
  "Bosqichni boshlash": "Начать этап",
  "🏁 <b>Hafta yakunlandi!</b>\n{m} Siz jamoada <b>{p}-o'rin</b>ni egalladingiz ({n} kishidan).\n💰 Haftalik bal: <b>{x} XP</b>\n\nDarajangiz 12:10 da yangilanadi. Yangi hafta dushanba 09:00 da.": "🏁 <b>Неделя завершена!</b>\n{m} Ваше место в команде: <b>{p}</b> (из {n}).\n💰 Баллы за неделю: <b>{x} XP</b>\n\nУровень обновится в 12:10. Новая неделя — в понедельник в 09:00.",
  "🏁 <b>Hafta yakunlandi.</b>\nBu hafta bosqich o'ynamadingiz. Dushanba 09:00 da yangi hafta — qaytib keling! 💪": "🏁 <b>Неделя завершена.</b>\nНа этой неделе вы не проходили этапы. Новая неделя — в понедельник в 09:00, возвращайтесь! 💪",
  "Natijalarni ko'rish": "Посмотреть результаты",
  "✅ <b>Ulandi!</b>\nEndi har bosqichdan keyin natijangiz, ertalab bosqich eslatmasi va juma kuni o'rningiz shu yerga keladi.": "✅ <b>Подключено!</b>\nТеперь после каждого этапа сюда придёт ваш результат, утром — напоминание об этапе, а в пятницу — ваше место.",
  "Ligani ochish": "Открыть лигу",
  "📅 <b>Soliq taqvimi</b>": "📅 <b>Налоговый календарь</b>",
  "{d} ({n} kun qoldi)": "{d} (осталось дней: {n})",
  "{d} (ertaga)": "{d} (завтра)",
  "Muddatni o'tkazib yubormang — jarima bo'lmasin!": "Не пропустите срок — без штрафов!",
  "Mashq qilish": "Потренироваться",
  "{m} <b>Tabriklaymiz! Siz bugungi bosqichda {p}-o'rin oldingiz.</b>\nMukofot: {d} bosqichda har savolga <b>+{s} soniya</b> ({t} soniya).": "{m} <b>Поздравляем! Сегодня вы заняли {p}-е место в этапе.</b>\nНаграда: {d} на каждый вопрос этапа <b>+{s} сек.</b> ({t} сек.).",
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
  "🏆 <b>Bugungi duel kubogi</b>\nFaqat provodka · 10 savol · har biriga 1 daqiqa · har duel 1 soat ochiq. G'olib keyingi bosqichga o'tadi.": "🏆 <b>Кубок дуэлей дня</b>\nТолько проводки · 10 вопросов · по 1 минуте · каждая дуэль открыта 1 час. Победитель проходит дальше.",
  "👉 Sizning duelingiz ({st}): soat <b>{s}</b>, raqib — <b>{o}</b>.": "👉 Ваша дуэль ({st}): в <b>{s}</b>, соперник — <b>{o}</b>.",
  "🎉 <b>Siz {st}ga chiqdingiz!</b>\nRaqib: <b>{o}</b>, soat <b>{s}</b>. Faqat provodka, 10 savol. Duel 1 soat ochiq.": "🎉 <b>Вы вышли в {st}!</b>\nСоперник: <b>{o}</b>, в <b>{s}</b>. Только проводки, 10 вопросов. Дуэль открыта 1 час.",
  "🏆 <b>Bugungi duel kubogi g'olibi — {n}!</b>\nTabriklaymiz! Keyingi kubok — keyingi ish kuni 09:00 da.": "🏆 <b>Победитель кубка дуэлей дня — {n}!</b>\nПоздравляем! Следующий кубок — в следующий рабочий день в 09:00.",
  "{st} — {s} dan (g'oliblar)": "{st} — с {s} (победители)",
  "🔔 <b>Duel boshlandi!</b>\nRaqibingiz <b>{o}</b>. Soat {e} gacha kiring — kelmasangiz, duel raqibga beriladi.": "🔔 <b>Дуэль началась!</b>\nВаш соперник — <b>{o}</b>. Зайдите до {e} — иначе победа достанется сопернику.",
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
// juma — bosqich 12:00 gacha (liga juma 12:00 da tugaydi), boshqa ish kunlari — 17:00 gacha
const closeStr = (w: number) => (w === 5 ? "12:00" : "17:00");
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
  return `🏅 <b>Bugungi kuchli uchlik</b>\n${top.map((x) => `${MEDAL[x.pos - 1]} ${esc(x.name)} — <b>+${EXTRA[x.pos - 1]} soniya</b>`).join("\n")}\n\nMukofot: ${when} bosqichda har savolga qo'shimcha vaqt.`;
}
async function dayTopDm(top: any[], w: number) {
  let n = 0;
  for (const x of top) {
    if (!x.tg) continue;
    const when = tr(x.lang, w === 5 ? "dushanba kuni" : "ertaga");
    if (await dm(x.tg, tr(x.lang, "{m} <b>Tabriklaymiz! Siz bugungi bosqichda {p}-o'rin oldingiz.</b>\nMukofot: {d} bosqichda har savolga <b>+{s} soniya</b> ({t} soniya).",
      { m: MEDAL[x.pos - 1], p: x.pos, d: when, s: EXTRA[x.pos - 1], t: 60 + EXTRA[x.pos - 1] }), appBtn(tr(x.lang, "Ligani ochish")))) n++;
  }
  return n;
}
// duel kubogi: bosqich nomlari va jadval matni
const STAGE_UZ: Record<string, string> = { quarter: "Chorak final", semi: "Yarim final", final: "Final" };
const STAGE_RU: Record<string, string> = { quarter: "Четвертьфинал", semi: "Полуфинал", final: "Финал" };
const STAGE_RU_ACC: Record<string, string> = { quarter: "четвертьфинал", semi: "полуфинал", final: "финал" };
const stageName = (st: string, lang?: string | null) => { const ru = lang === "ru"; const m = (ru ? STAGE_RU : STAGE_UZ)[st]; return m ?? (ru ? `Раунд ${st.slice(1)}` : `${st.slice(1)}-bosqich`); };
const stageTo = (st: string, lang?: string | null) => (lang === "ru" ? STAGE_RU_ACC[st] ?? stageName(st, lang) : stageName(st, lang).toLowerCase());
async function cupBoard() {
  const { data } = await db.rpc("liga_cup_board_sys"); const by: Record<string, any[]> = {};
  for (const x of (data ?? []) as any[]) (by[x.group_code] ??= []).push(x);
  return by;
}
function cupText(rows: any[], lang?: string | null) {
  const out: string[] = [tr(lang, "🏆 <b>Bugungi duel kubogi</b>\nFaqat provodka · 10 savol · har biriga 1 daqiqa · har duel 1 soat ochiq. G'olib keyingi bosqichga o'tadi.")];
  const rounds = [...new Set(rows.map((r) => r.round))].sort((a, b) => a - b);
  for (const r of rounds) {
    const rr = rows.filter((x) => x.round === r);
    out.push("\n<b>" + tr(lang, stageName(rr[0].stage, lang)) + "</b>");
    for (const x of rr) out.push(`${String(x.slot).slice(0, 5)} — ${esc(x.a_name ?? "")} ⚔️ ${esc(x.b_name ?? "")}${x.winner_name ? " · ✅ " + esc(x.winner_name) : ""}`);
  }
  const last = rows.filter((x) => x.round === rounds[rounds.length - 1]).length;
  const next: [string, string][] = last >= 4 ? [["semi", "14:00"], ["final", "16:00"]] : last === 2 ? [["final", "16:00"]] : [];
  for (const [st, h] of next) out.push("\n" + tr(lang, "{st} — {s} dan (g'oliblar)", { st: "<b>" + stageName(st, lang) + "</b>", s: h }));
  return out.join("\n");
}
// jadvalni hammaga (shaxsan, o'z dueli bilan) va jamoa guruhlariga yuborish
async function cupBroadcast(rows: any[]) {
  const by = await cupBoard(); let n = 0;
  for (const code of Object.keys(by)) for (const c of await chatsOf(code)) await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", reply_markup: openBot(code), text: cupText(by[code]) });
  const mine: Record<string, any> = {}; for (const x of rows) mine[x.player] = x;
  const { data: ppl } = await db.rpc("liga_cup_people_sys");
  for (const p of (ppl ?? []) as any[]) {
    const m = mine[p.player], board = by[p.group_code]; if (!board) continue;
    const txt = cupText(board, p.lang) + (m ? "\n\n" + tr(p.lang, "👉 Sizning duelingiz ({st}): soat <b>{s}</b>, raqib — <b>{o}</b>.", { st: stageName(m.stage, p.lang), s: String(m.slot).slice(0, 5), o: esc(m.opp_name ?? "") }) : "");
    if (await dm(p.tg, txt, m ? appBtn(tr(p.lang, "Duelni ochish"), "?d=" + m.code) : appBtn(tr(p.lang, "Ligani ochish")))) n++;
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
  const rows = data.map((p: any, i: number) => `${medal[i] ?? `${i + 1}.`} ${esc(p.name ?? "")} — <b>${p.week_xp} XP</b>`);
  const win = data[0];
  return `🏁 <b>Haftalik liga natijalari</b>\n\n${rows.join("\n")}\n\n🏆 G'olib: <b>${esc(win.name ?? "")}</b> — tabriklaymiz!\n👑🥈🥉 Kuchli uchlik ilovada nishon va sertifikat oladi.\nYangi hafta dushanba soat 09:00 da boshlanadi 👇`;
}

async function chatGroup(chatId: number): Promise<string> {
  const { data } = await db.from("liga_bot_chats").select("group_code").eq("chat_id", chatId).maybeSingle();
  return (data?.group_code as string) || "ASOSIY";
}

// ---------------- obuna to'lovi: karta + chek ----------------
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fmtD = (d: string) => d ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "";
async function payCfg() {
  const { data } = await db.rpc("liga_pay_config2");
  return (data?.[0] ?? {}) as { card?: string; card_name?: string; price?: number };
}
async function cardMessage(chatId: number, months: number, name?: string, edit?: number) {
  const c = await payCfg(), price = c.price ?? 30000;
  const text = `💳 <b>Ligaga qo'shilish</b>${name ? ` — ${esc(name)}` : ""}\n\n` +
    `1️⃣ Kartaga <b>${fmt(price * months)} so'm</b> o'tkazing (${months} oy):\n<code>${esc(c.card || "—")}</code>\n${esc(c.card_name || "")}\n\n` +
    `2️⃣ To'lov chekining rasmini (skrinshot) <b>shu yerga yuboring</b>.\n\n` +
    `Bot chekni tekshiradi va sizni darhol ligaga qo'shadi. Muddatni o'zgartirish uchun tugmani bosing:`;
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
  const { data, error } = await db.rpc("liga_receipt_sys", { p_player: ses.player_id, p_months: ses.months, p_image: d.uri,
    p_uid: f.file_unique_id, p_file_id: photo ? f.file_id : null, p_chat: chatId });
  if (error) { console.error(error); return tg("sendMessage", { chat_id: chatId, text: "❗ Xatolik. Birozdan keyin qayta yuboring." }); }
  const r = data?.[0];
  if (r?.dup) return tg("sendMessage", { chat_id: chatId, text: "⚠️ Bu chek avval yuborilgan. Yangi to'lov chekini yuboring." });
  const p = await playerName(ses.player_id);
  await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", reply_markup: openApp(p?.group_code),
    text: `✅ <b>Chek qabul qilindi!</b>\n\nSiz ligaga qo'shildingiz${p?.first_name ? `, ${esc(p.first_name)}` : ""}.\n💳 Obuna: <b>${fmtD(r.paid_until)}</b> gacha.\n\nBosqichlar har ish kuni 09:00–17:00, juma 09:00–12:00. Omad! 💪` });
  await notifyAdmins(Number(r.id));
}

// yangi chek — jamoa adminlariga (rasm + tasdiqlash tugmalari)
async function notifyAdmins(invId: number) {
  const { data: inv } = await db.from("liga_invoices").select("id,group_code,player_id,months,amount,receipt,tg_file_id,provider,status").eq("id", invId).maybeSingle();
  if (!inv) return { error: "no invoice" };
  const { data: chatsA } = await db.from("liga_admin_chats").select("chat_id").eq("group_code", inv.group_code);
  if (!chatsA?.length) return { sent: 0 };
  const p = await playerName(inv.player_id) ?? {};
  const { data: pl } = await db.from("safari_players").select("paid_until").eq("id", inv.player_id).maybeSingle();
  const caption = `🧾 <b>Yangi to'lov cheki</b> №${inv.id}\n👤 ${esc(((p.first_name ?? "") + " " + (p.last_name ?? "")).trim())}\n📞 ${esc(p.phone ?? "")}` +
    `${p.region ? `\n📍 ${esc(p.region)}` : ""}\n💳 ${fmt(Number(inv.amount))} so'm · ${inv.months} oy · ${esc(inv.provider ?? "")}\n\n` +
    `✅ Ligaga qo'shildi (obuna ${fmtD(pl?.paid_until ?? "")} gacha).\nPul tushganini tekshiring. Chek soxta bo'lsa — «Rad etish».`;
  const kb = { inline_keyboard: [[{ text: "✅ Tasdiqlash", callback_data: `rc:1:${inv.id}` }, { text: "❌ Rad etish", callback_data: `rc:0:${inv.id}` }]] };
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

async function onCallback(q: any) {
  const data = String(q.data ?? ""), chatId = q.message?.chat?.id;
  const ack = (text?: string) => tg("answerCallbackQuery", { callback_query_id: q.id, text });
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
    const { data: r } = await db.rpc("liga_receipt_decide_sys", { p_id: Number(id), p_ok: ok === "1", p_admin_chat: chatId });
    const x = r?.[0];
    if (!x?.done) return ack("Ruxsat yo'q");
    const mark = x.status === "paid" ? "\n\n✅ <b>Tasdiqlandi</b>" : x.status === "cancelled" ? "\n\n❌ <b>Rad etildi — obuna bekor qilindi</b>" : "";
    await tg("editMessageCaption", { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML",
      caption: esc(q.message.caption ?? "") + mark });
    if (x.status === "cancelled" && x.player_chat) {
      await tg("sendMessage", { chat_id: x.player_chat, parse_mode: "HTML",
        text: "❌ <b>To'lov chekingiz tasdiqlanmadi.</b>\nObuna bekor qilindi. Savol bo'lsa: @murtozo_44" });
    }
    return ack(x.status === "paid" ? "Tasdiqlandi" : "Rad etildi");
  }
  return ack();
}

async function onUpdate(u: any) {
  if (u.callback_query) return onCallback(u.callback_query);
  const cm = u.my_chat_member;
  if (cm && ["group", "supergroup"].includes(cm.chat.type)) {
    const st = cm.new_chat_member?.status;
    if (st === "member" || st === "administrator") {
      await db.from("liga_bot_chats").upsert({ chat_id: cm.chat.id, title: cm.chat.title, active: true });
      await tg("sendMessage", { chat_id: cm.chat.id, parse_mode: "HTML", reply_markup: openBot(await chatGroup(cm.chat.id)),
        text: "👋 Salom, buxgalterlar!\n\n<b>Hisobchi Liga</b> — haftalik musobaqa:\n• har ish kuni 09:00–17:00 da (juma 12:00 gacha) yangi bosqich (20 savol);\n• liga dushanbadan <b>juma 12:00</b> gacha;\n• hafta davomida natijangizni faqat o'zingiz ko'rasiz;\n• yakuniy jadval juma 12:00 da shu guruhga chiqadi.\n\n🔗 Jamoa administratori: guruhda <b>/ulash KOD</b> deb yozing (kod admin panelda).\nBoshlash uchun pastdagi tugmani bosing." });
    } else if (st === "left" || st === "kicked") {
      await db.from("liga_bot_chats").update({ active: false }).eq("chat_id", cm.chat.id);
    }
    return;
  }
  const m = u.message;
  if (!m) return;
  if (m.migrate_to_chat_id) {
    const code = await chatGroup(m.chat.id);
    await db.from("liga_bot_chats").update({ active: false }).eq("chat_id", m.chat.id);
    await db.from("liga_bot_chats").upsert({ chat_id: m.migrate_to_chat_id, title: m.chat.title, active: true, group_code: code });
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
    const lang = m.from?.language_code === "ru" ? "ru" : "uz";
    return reply(tr(lang, "👋 <b>Hisobchi Liga</b>ga xush kelibsiz!\nDo'stingiz sizni taklif qildi. Ro'yxatdan o'ting — haftalik ligada bellashamiz."), appBtn(tr(lang, "Ro'yxatdan o'tish"), "?r=" + arg.slice(2).toUpperCase()));
  }
  if (priv && cmd === "/start" && /^d_[A-Za-z0-9]+$/i.test(arg)) {
    const lang = m.from?.language_code === "ru" ? "ru" : "uz";
    const live = /^L[A-Z0-9]{6}$/i.test(arg.slice(2));
    return reply(tr(lang, live ? "⚡ <b>Sizni jonli duelga chaqirishdi!</b>\n10 ta savol, ikkalangiz bir vaqtda o'ynaysiz: kim birinchi to'g'ri topsa — ochko o'shaniki." : "⚔️ <b>Sizni duelga chaqirishdi!</b>\n10 ta savol: kim ko'proq to'g'ri topsa — g'olib, teng bo'lsa tezrog'i."), appBtn(tr(lang, "Duelga kirish"), "?d=" + arg.slice(2).toUpperCase()));
  }
  if (cmd === "/start" || cmd === "/liga") {
    const code = priv && /^g_/i.test(arg) ? arg.slice(2).toUpperCase().replace(/[^A-Z0-9]/g, "") : (priv ? "" : await chatGroup(m.chat.id));
    let gname = "";
    if (code) { const { data } = await db.from("liga_groups").select("name").eq("code", code).maybeSingle(); gname = data?.name ?? ""; }
    await reply(priv
      ? `🏆 <b>Hisobchi Liga</b>${gname ? ` — «${esc(gname)}»` : ""}\n\nProvodka, QQS, ish haqi, soliq va hisobotlar bo'yicha har kuni yangi bosqich. Har ish kuni 09:00–17:00, juma 09:00–12:00.\n\n${code ? `Jamoa kodi: <b>${esc(code)}</b> — ro'yxatdan o'tishda avtomatik qo'yiladi.\n\n` : ""}Ilovani ochish uchun tugmani bosing:`
      : "🏆 Ligani ochish uchun tugmani bosing:", priv ? openApp(code) : openBot(code));
  } else if (cmd === "/ulash") {
    if (priv) return reply("Bu buyruq Telegram guruhda ishlaydi: botni guruhga qo'shing va guruhda <b>/ulash KOD</b> deb yozing.");
    const mem = await tg("getChatMember", { chat_id: m.chat.id, user_id: m.from?.id });
    const role = mem?.result?.status;
    if (role !== "administrator" && role !== "creator") return reply("⛔ Faqat guruh administratori jamoani ulay oladi.");
    const code = arg.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) return reply("Foydalanish: <b>/ulash KOD</b> (kod jamoa admin panelida).");
    const { data: g } = await db.from("liga_groups").select("code,name").eq("code", code).maybeSingle();
    if (!g) return reply("❌ Bunday jamoa kodi topilmadi.");
    await db.from("liga_bot_chats").upsert({ chat_id: m.chat.id, title: m.chat.title, active: true, group_code: g.code });
    await reply(`✅ Guruh «<b>${esc(g.name)}</b>» jamoasiga ulandi.\nBosqich xabarlari va juma kungi natijalar shu yerga chiqadi.`, openBot(g.code));
  } else if (cmd === "/natija") {
    const code = priv ? "ASOSIY" : await chatGroup(m.chat.id);
    await reply(await resultsText(code), priv ? openApp(code) : openBot(code));
  } else if (cmd === "/qoida") {
    await reply("📋 <b>Qoidalar</b>\n• Har ish kuni 09:00–17:00 da (juma — 12:00 gacha) yangi bosqich: 12 ta provodka + 8 ta qonun, kodeks va hisob savoli.\n• Har savolga 1 daqiqa, har savolga faqat bir marta javob. Xatoning sababi darhol ko'rsatiladi.\n• Kunlik kuchli uchlik keyingi ish kuni har savolga qo'shimcha vaqt oladi: 🥇 +10, 🥈 +7, 🥉 +4 soniya.\n• Liga bali faqat bosqichlardan; kunlik mashq va blits — alohida.\n• Liga — dushanbadan juma 12:00 gacha. Hafta davomida natijangizni faqat o'zingiz ko'rasiz.\n• Juma 12:00 da jadval e'lon qilinadi; kuchli uchlik nishon va sertifikat oladi.");
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
// bir kunda bir xil xabar ikki marta ketmasin
async function once(tag: string) {
  const key = `sent_${tag}_${tzDate().toISOString().slice(0, 10)}`;
  const { error } = await db.from("liga_bot_config").insert({ key, value: new Date().toISOString() });
  return !error;
}

// 1 soat qoldi: guruhga (nechta kishi o'ynagani bilan) va bajarmaganlarga shaxsan
async function remindAll(w: number, groupText: string) {
  const cnt = await todayCounts();
  const sent = await toChats((g) => {
    if (todayStage(g.start_date) === null) return null;
    const c = cnt[g.code]; return groupText + (c && c.played > 0 ? `\n\n👥 Jamoangizdan <b>${c.played}</b> kishi bugungi bosqichni bajarib bo'ldi. Siz-chi?` : "");
  });
  const { data: list } = await db.rpc("liga_remind_list2"); let personal = 0;
  for (const p of (list ?? []) as any[]) {
    const c = cnt[p.group_code ?? ""];
    const extra = c && c.played > 0 ? "\n" + tr(p.lang, "Jamoangizdan {p} kishi bugungi bosqichni bajarib bo'ldi.", { p: c.played }) : "";
    if (await dm(p.tg, tr(p.lang, "⏰ <b>{n}, bugungi bosqich hali bajarilmagan!</b>\n{s}-bosqich soat {c} da yopiladi — 1 soat qoldi.", { n: esc(p.first_name ?? ""), s: (p.stage ?? 0) + 1, c: closeStr(w) }) + extra,
      appBtn(tr(p.lang, "Bosqichni ochish")))) personal++;
  }
  return { ok: true, sent, personal };
}

async function onCron(action: string) {
  if (action === "setup") {
    const url = `${SB_URL}/functions/v1/liga-bot`;
    return {
      webhook: await tg("setWebhook", { url, secret_token: await hookSecret(), allowed_updates: ["message", "my_chat_member", "callback_query"], drop_pending_updates: true }),
      commands: await tg("setMyCommands", { commands: [
        { command: "liga", description: "Ilovani ochish" },
        { command: "natija", description: "Oxirgi hafta natijalari" },
        { command: "tolov", description: "Obuna to'lovi (karta va chek)" },
        { command: "qoida", description: "Liga qoidalari" },
        { command: "ulash", description: "Guruhni jamoaga ulash (admin)" }] }),
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
    const n = await toChats((g) => {
      const si = todayStage(g.start_date);
      if (si === null) return null;                       // jamoa hali boshlanmagan
      const head = w === 1
        ? "🚀 <b>Yangi liga haftasi boshlandi!</b>\n\nLiga bugundan <b>juma soat 12:00</b> gacha davom etadi."
        : "☀️ <b>Bugungi o'yin boshlandi!</b>";
      return `${head}\n📚 Bugun <b>${si + 1}-bosqich: ${TITLES[si]}</b> ochildi (20 savol).\n⏰ Bosqich <b>${closeStr(w)}</b> gacha ochiq, keyin yopiladi.\n⏱ Har savolga 1 daqiqa.${lesson ? `\n\n📘 <b>Bugungi dars:</b> ${esc(lesson.uz.title)}\n${esc(lesson.uz.body)}` : ""}\n\nOmad, buxgalterlar! 💪`;
    });
    // guruhlarga kunning savoli (so'rovnoma)
    let polls = 0; const gm = await groupMap();
    for (const c of await chats()) if (groupOk(gm[c.group_code]) && todayStage(gm[c.group_code].start_date) !== null && await sendDailyPoll(c.chat_id)) polls++;
    // har o'yinchiga shaxsan
    const { data: list } = await db.rpc("liga_morning_list"); let personal = 0;
    for (const p of (list ?? []) as any[]) {
      if (await dm(p.tg, tr(p.lang, "☀️ <b>Xayrli tong, {n}!</b>\nBugun <b>{s}-bosqich</b> ochildi — 20 savol.\n⏰ Soat {c} gacha ochiq.", { n: esc(p.first_name ?? ""), s: (p.stage ?? 0) + 1, c: closeStr(w) }),
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
    // kunlik duel kubogi: tasodifiy juftlar (10:30 dan), jadval — hammaga va guruhga
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
            text: `⚔️ <b>Jamoalar bellashuvi!</b>\n\nBu hafta raqibingiz: <b>«${esc(o.name)}»</b>.\nJamoa bali — eng yaxshi 3 kishining haftalik bali yig'indisi.\nG'olib juma 12:00 da e'lon qilinadi. Har kuni bosqichni bajaring — jamoangizni yutqazib qo'ymang! 💪` });
          pairs++;
        }
      }
    }
    return { ok: true, sent: n, polls, personal, tax, news, pairs, duels };
  }
  if (action === "duel_due") {
    // kubok: yangi bosqich jufti, 5 daqiqa qoldi, boshlandi, g'olib
    const { data } = await db.rpc("liga_cup_due_sys"); let sent = 0; const champG = new Set<string>();
    for (const x of (data ?? []) as any[]) {
      const st = x.stage ?? "", s5 = x.slot ? String(x.slot).slice(0, 5) : "";
      let text = "", btn: unknown = x.code ? appBtn(tr(x.lang, "Duelga kirish"), "?d=" + x.code) : appBtn(tr(x.lang, "Ligani ochish"));
      if (x.kind === "pair") text = tr(x.lang, "🎉 <b>Siz {st}ga chiqdingiz!</b>\nRaqib: <b>{o}</b>, soat <b>{s}</b>. Faqat provodka, 10 savol. Duel 1 soat ochiq.", { st: stageTo(st, x.lang), o: esc(x.opp_name ?? ""), s: s5 });
      else if (x.kind === "five") text = "<b>" + stageName(st, x.lang) + "</b>\n" + tr(x.lang, "⏳ <b>Duelga 5 daqiqa qoldi!</b>\nSoat {s} da raqibingiz <b>{o}</b> bilan bellashasiz. Ilovani oching.", { s: s5, o: esc(x.opp_name ?? "") });
      else if (x.kind === "start") {
        const [h, mi] = s5.split(":").map(Number), e = `${String(h + 1).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
        text = "<b>" + stageName(st, x.lang) + "</b>\n" + tr(x.lang, "🔔 <b>Duel boshlandi!</b>\nRaqibingiz <b>{o}</b>. Soat {e} gacha kiring — kelmasangiz, duel raqibga beriladi.", { o: esc(x.opp_name ?? ""), e });
      } else if (x.kind === "champ") { text = tr(x.lang, "🏆 <b>Bugungi duel kubogi g'olibi — {n}!</b>\nTabriklaymiz! Keyingi kubok — keyingi ish kuni 09:00 da.", { n: esc(x.extra ?? "") }); champG.add(x.group_code + "|" + (x.extra ?? "")); }
      if (text && await dm(x.tg, text, btn)) sent++;
    }
    for (const k of champG) { const [code, nm] = k.split("|"); for (const c of await chatsOf(code)) await tg("sendMessage", { chat_id: c.chat_id, parse_mode: "HTML", reply_markup: openBot(code), text: tr("uz", "🏆 <b>Bugungi duel kubogi g'olibi — {n}!</b>\nTabriklaymiz! Keyingi kubok — keyingi ish kuni 09:00 da.", { n: esc(nm) }) }); }
    return { ok: true, sent };
  }
  if (action === "cup_schedule") {
    // kubok jadvalini hozir hammaga yuborish (o'zgartirishdan keyin)
    const { data: dp } = await db.rpc("liga_cup_start_sys");
    return { ok: true, sent: await cupBroadcast((dp ?? []) as any[]) };
  }
  if (action === "remind") {
    // juma kuni bosqich 12:00 da yopiladi — eslatma friday_warn (11:00) da ketadi
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
    // juma: bosqich 12:00 da yopiladi, o'sha paytda haftalik natijalar chiqadi — alohida xabar kerak emas
    if (w < 1 || w > 4 || !(await once("day_end"))) return { skip: true };
    const tail = w === 4 ? "Ertaga — haftaning oxirgi kuni: bosqich <b>09:00–12:00</b>, liga <b>juma 12:00</b> da yakunlanadi va natijalar shu guruhga chiqadi." :
      "Ertaga soat 09:00 da yangi bosqich ochiladi. Liga natijalari <b>juma 12:00</b> da e'lon qilinadi.";
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
    return await remindAll(5, "⏳ <b>Liga tugashiga 1 soat qoldi!</b>\n\nSoat 12:00 da bugungi bosqich yopiladi va haftalik liga yakunlanadi. Oxirgi imkoniyat — ballaringizni oshiring! 🔥");
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
        ? tr(p.lang, "🏁 <b>Hafta yakunlandi!</b>\n{m} Siz jamoada <b>{p}-o'rin</b>ni egalladingiz ({n} kishidan).\n💰 Haftalik bal: <b>{x} XP</b>\n\nDarajangiz 12:10 da yangilanadi. Yangi hafta dushanba 09:00 da.",
            { m: ["👑", "🥈", "🥉"][p.pos - 1] ?? "🏅", p: p.pos, n: p.n, x: p.week_xp })
        : tr(p.lang, "🏁 <b>Hafta yakunlandi.</b>\nBu hafta bosqich o'ynamadingiz. Dushanba 09:00 da yangi hafta — qaytib keling! 💪");
      if (await dm(p.tg, text, appBtn(tr(p.lang, "Natijalarni ko'rish")))) personal++;
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
    return { ok: true, sent, personal, matches, winners };
  }
  if (action.startsWith("receipt:")) return await notifyAdmins(Number(action.slice(8)));
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
    const next = w === 5 ? tr(p.lang, "Liga bugun 12:00 da yakunlanadi — natijalar shu yerga keladi.") : w === 4 ? tr(p.lang, "Ertaga 09:00 da yangi bosqich ochiladi.") + " " + tr(p.lang, "Natijalar juma 12:00 da shu yerga keladi.")
      : tr(p.lang, "Ertaga 09:00 da yangi bosqich ochiladi.");
    const total = Math.max(1, Math.min(20, Number(b.total) || 20)), right = Math.max(0, Math.min(total, Number(b.right) || 0));
    const ok = await dm(p.tg_user_id, tr(p.lang, "✅ <b>{s}-bosqich yakunlandi!</b>\n🎯 {r}/{t} to'g'ri {st}\n💰 Bosqich bali: <b>{x} XP</b>\n📊 Shu hafta jami: <b>{w} XP</b>\n\n{next}",
      { s: si + 1, r: right, t: total, st: stars(Number(b.stars) || 0), x, w: week, next }), appBtn(tr(p.lang, "Ligani ochish")));
    return jres({ ok });
  }
  // quyidagilar faqat Telegram ichidan (initData tekshiriladi)
  const user = await checkInit(String(b.initData || ""));
  if (!user) return jres({ error: "no_telegram" }, 403);
  // Telegram hisobi orqali kirish (telefon, kompyuter — qaysi qurilma bo'lmasin)
  if (action === "tg_login") {
    const { data } = await db.rpc("liga_tg_login_sys", { p_tg: user.id });
    return jres(data ? { found: true, ...data } : { found: false });
  }
  if (!b.p_id || !(await authOk(b.p_id, b.token))) return jres({ error: "bad_token" }, 403);
  if (action === "link") {
    const { data } = await db.rpc("liga_tg_link_sys", { p_id: b.p_id, p_token: b.token, p_tg: user.id });
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
  const out = await onCron(body.action ?? "");
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
});
