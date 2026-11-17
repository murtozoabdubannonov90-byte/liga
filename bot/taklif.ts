// Hisobchi Liga — muhokama guruhiga qo'shilmaganlarga qayta taklif (Edge Function `liga-taklif`)
// Rejim (2026-11-17): har odamga kuniga 1 marta (Toshkent vaqti bo'yicha), dushanba–shanba, guruhga qo'shilguncha.
// Bitta chaqiruvda ko'pi 40 kishi. Cron `liga-guruh-qayta` (dushanba–shanba 10:00–18:50, har 10 daqiqada).
// Botni bloklaganlar (fail) va guruhdan chiqarilganlar (kicked) olinmaydi. O'chirish: liga_bot_config.discuss_resend_on = 'off'.
// Token: Supabase Secrets TELEGRAM_BOT_TOKEN (liga-bot bilan bir xil). Kirish: x-cron-key (liga_bot_config.cron_key).
// Manba: repo bot/taklif.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BATCH = 40;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function tg(method: string, body: Record<string, unknown>) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return null; }
}
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

// k — nechanchi qayta taklif (1, 2, 3, ...): matnlar navbatma-navbat almashadi; §1 — ism, §2 — guruhdagi a'zolar soni
const UZ = [
  "👋 <b>§1</b>, Hisobchi Liga guruhida allaqachon <b>§2</b> ta buxgalter bor!\nKunlik savollar, provodkalar va duellar shu yerda muhokama qilinadi. Qo'shiling 👇",
  "💬 <b>§1</b>, kubok juftliklari, kun natijalari va qonun yangiliklari guruhda birinchi chiqadi.\n<b>§2</b> ta hamkasbingiz allaqachon u yerda — sizni ham kutamiz 👇",
  "🤝 <b>§1</b>, guruhda duel raqibingiz bilan kelishib olasiz va liga yangiliklarini o'tkazib yubormaysiz.\nBitta tugma — va siz <b>§2</b> ta buxgalter qatoridasiz 👇",
  "📚 <b>§1</b>, qiyin provodka yoki soliq savoli bormi? Guruhda <b>§2</b> ta hamkasbingiz bor — birga tezroq javob topamiz.\nQo'shiling 👇",
];
const RU = [
  "👋 <b>§1</b>, в группе Hisobchi Liga уже <b>§2</b> бухгалтеров!\nЗдесь обсуждаем вопросы дня, проводки и дуэли. Присоединяйтесь 👇",
  "💬 <b>§1</b>, пары кубка, итоги дня и новости законодательства первыми появляются в группе.\nТам уже <b>§2</b> ваших коллег — ждём и вас 👇",
  "🤝 <b>§1</b>, в группе можно договориться с соперником по дуэли и не пропустить новости лиги.\nОдна кнопка — и вы среди <b>§2</b> бухгалтеров 👇",
  "📚 <b>§1</b>, есть сложная проводка или налоговый вопрос? В группе <b>§2</b> ваших коллег — вместе найдём ответ быстрее.\nПрисоединяйтесь 👇",
];
function text(lang: string, k: number, name: string, c: number) {
  const i = (Math.max(k, 1) - 1) % UZ.length;
  const s = lang === "ru" ? RU[i] : lang === "uzc" ? cyr(UZ[i]) : UZ[i];   // avval shablon, keyin ism (ism o'girilmaydi)
  const nm = name || (lang === "ru" ? "Уважаемый коллега" : lang === "uzc" ? cyr("Hurmatli hamkasb") : "Hurmatli hamkasb");
  return s.replace("§1", esc(nm)).replace("§2", String(c));
}
const btn = (lang: string, link: string) => ({ inline_keyboard: [[{ text: lang === "ru" ? "💬 Вступить в группу" : lang === "uzc" ? cyr("💬 Guruhga qo'shilish") : "💬 Guruhga qo'shilish", url: link }]] });

// Toshkent vaqti: yakshanba — dam olish kuni, yubormaymiz
const tashkentDow = () => new Date(Date.now() + 5 * 3600e3).getUTCDay();

async function run(dry = false) {
  const { data: cfgRows } = await db.from("liga_bot_config").select("key,value").in("key", ["discuss_chat", "discuss_link", "discuss_resend_on"]);
  const m: Record<string, string> = {}; for (const r of (cfgRows ?? []) as any[]) m[r.key] = r.value;
  if (m.discuss_resend_on === "off") return { skip: "off" };
  if (!m.discuss_chat || !m.discuss_link) return { skip: "no_group" };
  if (tashkentDow() === 0) return { skip: "sunday" };
  const chat = Number(m.discuss_chat), link = m.discuss_link;
  if (dry) {   // sinov: hech kimga yubormaydi
    const { data: n } = await db.rpc("liga_discuss_resend_count_sys");
    const mem = await tg("getChatMemberCount", { chat_id: chat });
    return { dry: true, eligible: n, members: mem?.result ?? null, tg_ok: !!mem?.ok };
  }
  const { data: list, error } = await db.rpc("liga_discuss_resend_pick_sys", { p_limit: BATCH });
  if (error) return { error: error.message };
  const out: Record<string, number> = { picked: (list ?? []).length, sent: 0, in: 0, fail: 0, kicked: 0 };
  if (!out.picked) return out;
  const cnt = Number((await tg("getChatMemberCount", { chat_id: chat }))?.result) || 0;
  const shown = cnt > 3 ? cnt - 2 : cnt;   // bot va egasini hisobga olmaymiz
  for (const p of (list ?? []) as any[]) {
    const mem = await tg("getChatMember", { chat_id: chat, user_id: p.tg }); const st = mem?.result?.status;
    let r: string;
    if (["member", "administrator", "creator", "restricted"].includes(st)) r = "in";
    else if (st === "kicked") r = "kicked";
    else {
      const res = await tg("sendMessage", { chat_id: p.tg, parse_mode: "HTML", text: text(p.lang, p.n, (p.first_name ?? "").trim(), shown), reply_markup: btn(p.lang, link) });
      r = res?.ok ? "sent" : "fail";
      if (res?.parameters?.retry_after) await pause(1000 * Number(res.parameters.retry_after));
    }
    await db.rpc("liga_discuss_mark2_sys", { p_tg: p.tg, p_status: r });
    out[r]++; await pause(60);
  }
  await db.from("liga_bot_config").upsert({ key: "discuss_resend_last", value: JSON.stringify({ at: new Date().toISOString(), ...out }) });
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" || !TOKEN) return new Response("ok");
  const key = req.headers.get("x-cron-key");
  const { data } = await db.from("liga_bot_config").select("value").eq("key", "cron_key").single();
  if (!key || !data || key !== data.value) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  const out = await run(body?.dry === true).catch((e) => ({ error: String(e) }));
  console.log("liga-taklif", JSON.stringify(out));
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
});
