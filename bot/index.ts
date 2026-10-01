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

async function onUpdate(u: any) {
  const cm = u.my_chat_member;
  if (cm && ["group", "supergroup"].includes(cm.chat.type)) {
    const st = cm.new_chat_member?.status;
    if (st === "member" || st === "administrator") {
      await db.from("liga_bot_chats").upsert({ chat_id: cm.chat.id, title: cm.chat.title, active: true });
      await tg("sendMessage", { chat_id: cm.chat.id, parse_mode: "HTML", reply_markup: openBot(await chatGroup(cm.chat.id)),
        text: "👋 Salom, buxgalterlar!\n\n<b>Hisobchi Liga</b> — haftalik musobaqa:\n• har ish kuni 09:00–17:00 da yangi bosqich (20 savol);\n• liga dushanbadan <b>juma 12:00</b> gacha;\n• hafta davomida natijangizni faqat o'zingiz ko'rasiz;\n• yakuniy jadval juma 12:00 da shu guruhga chiqadi.\n\n🔗 Jamoa administratori: guruhda <b>/ulash KOD</b> deb yozing (kod admin panelda).\nBoshlash uchun pastdagi tugmani bosing." });
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

  if (cmd === "/start" || cmd === "/liga") {
    const code = priv && /^g_/i.test(arg) ? arg.slice(2).toUpperCase().replace(/[^A-Z0-9]/g, "") : (priv ? "" : await chatGroup(m.chat.id));
    let gname = "";
    if (code) { const { data } = await db.from("liga_groups").select("name").eq("code", code).maybeSingle(); gname = data?.name ?? ""; }
    await reply(priv
      ? `🏆 <b>Hisobchi Liga</b>${gname ? ` — «${esc(gname)}»` : ""}\n\nProvodka, QQS, ish haqi, soliq va hisobotlar bo'yicha har kuni yangi bosqich. Har ish kuni 09:00–17:00.\n\n${code ? `Jamoa kodi: <b>${esc(code)}</b> — ro'yxatdan o'tishda avtomatik qo'yiladi.\n\n` : ""}Ilovani ochish uchun tugmani bosing:`
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
    await reply("📋 <b>Qoidalar</b>\n• Har ish kuni 09:00–17:00 da yangi bosqich: 12 ta provodka + 8 ta qonun, kodeks va hisob savoli.\n• Har savolga 1 daqiqa, har savolga faqat bir marta javob. Xatoning sababi darhol ko'rsatiladi.\n• Liga bali faqat bosqichlardan; kunlik mashq va blits — alohida.\n• Liga — dushanbadan juma 12:00 gacha. Hafta davomida natijangizni faqat o'zingiz ko'rasiz.\n• Juma 12:00 da jadval e'lon qilinadi; kuchli uchlik nishon va sertifikat oladi.");
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
// bir kunda bir xil xabar ikki marta ketmasin
async function once(tag: string) {
  const key = `sent_${tag}_${tzDate().toISOString().slice(0, 10)}`;
  const { error } = await db.from("liga_bot_config").insert({ key, value: new Date().toISOString() });
  return !error;
}

async function onCron(action: string) {
  if (action === "setup") {
    const url = `${SB_URL}/functions/v1/liga-bot`;
    return {
      webhook: await tg("setWebhook", { url, secret_token: await hookSecret(), allowed_updates: ["message", "my_chat_member"], drop_pending_updates: true }),
      commands: await tg("setMyCommands", { commands: [
        { command: "liga", description: "Ilovani ochish" },
        { command: "natija", description: "Oxirgi hafta natijalari" },
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
    const n = await toChats((g) => {
      const si = todayStage(g.start_date);
      if (si === null) return null;                       // jamoa hali boshlanmagan
      const head = w === 1
        ? "🚀 <b>Yangi liga haftasi boshlandi!</b>\n\nLiga bugundan <b>juma soat 12:00</b> gacha davom etadi."
        : "☀️ <b>Bugungi o'yin boshlandi!</b>";
      return `${head}\n📚 Bugun <b>${si + 1}-bosqich: ${TITLES[si]}</b> ochildi (20 savol).\n⏰ Bosqich <b>17:00</b> gacha ochiq, keyin yopiladi.\n⏱ Har savolga 1 daqiqa.\n\nOmad, buxgalterlar! 💪`;
    });
    return { ok: true, sent: n };
  }
  if (action === "remind") {
    if (w < 1 || w > 5 || !(await once("remind"))) return { skip: true };
    return { ok: true, sent: await toChats((g) => todayStage(g.start_date) === null ? null : "⏰ <b>Eslatma:</b> bugungi bosqich yopilishiga <b>1 soat</b> qoldi — soat 17:00 gacha bajaring!") };
  }
  if (action === "day_end") {
    if (w < 1 || w > 5 || !(await once("day_end"))) return { skip: true };
    const tail = w === 5 ? "Yangi hafta dushanba soat 09:00 da boshlanadi." :
      w === 4 ? "Ertaga — haftaning oxirgi kuni. Liga <b>juma 12:00</b> da yakunlanadi va natijalar shu guruhga chiqadi." :
      "Ertaga soat 09:00 da yangi bosqich ochiladi. Liga natijalari <b>juma 12:00</b> da e'lon qilinadi.";
    return { ok: true, sent: await toChats((g) => todayStage(g.start_date) === null ? null : `🔔 <b>Bugungi o'yin tugadi!</b>\n\nBugungi bosqich yopildi.\n${tail}`) };
  }
  if (action === "friday_warn") {
    if (w !== 5 || !(await once("friday_warn"))) return { skip: true };
    return { ok: true, sent: await toChats(() => "⏳ <b>Liga tugashiga 1 soat qoldi!</b>\n\nSoat 12:00 da haftalik liga yakunlanadi. Oxirgi imkoniyat — ballaringizni oshiring! 🔥") };
  }
  if (action === "results" || action === "league_end") {
    if (!(await once("league_end"))) return { skip: true };
    return { ok: true, sent: await toChats(async (g) => "🏁 <b>Haftalik liga tugadi!</b>\n\n" + (await resultsText(g.code)).replace(/^🏁 <b>[^<]*<\/b>\n\n/, "")) };
  }
  if (action === "status") {
    const gm = await groupMap();
    return { webhook: await tg("getWebhookInfo", {}), chats: await chats(),
      stages: Object.fromEntries(Object.values(gm).map((g) => [g.code, todayStage(g.start_date)])) };
  }
  return { error: "unknown action" };
}

Deno.serve(async (req) => {
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
