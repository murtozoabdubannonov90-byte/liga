// Hisobchi Liga — Telegram bot (@Buxgalterlar_Ligasi_bot)
// Token Supabase Secrets'da: TELEGRAM_BOT_TOKEN. Kodda token yo'q.
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP = "https://murtozoabdubannonov90-byte.github.io/liga/";
const BOT = "Buxgalterlar_Ligasi_bot";
const DEEP = `https://t.me/${BOT}?start=liga`;

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
const openApp = { inline_keyboard: [[{ text: "🏆 Ligani ochish", web_app: { url: APP } }]] };
const openBot = { inline_keyboard: [[{ text: "🏆 Ligani ochish", url: DEEP }]] };

async function groups() {
  const { data } = await db.from("liga_bot_chats").select("chat_id").eq("active", true);
  return (data ?? []).map((r) => r.chat_id as number);
}
async function toGroups(text: string) {
  for (const id of await groups()) await tg("sendMessage", { chat_id: id, text, parse_mode: "HTML", reply_markup: openBot });
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Tugagan hafta id'si: shu juma 12:00 (Toshkent) = 07:00Z, app'dagi weekId() bilan bir xil
function lastWeekId(now = new Date()) {
  const t = new Date(now.getTime() + 5 * 3600e3); // Toshkent vaqti
  const back = (t.getUTCDay() - 5 + 7) % 7;
  const f = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - back, 7, 0));
  if (f.getTime() > now.getTime()) f.setUTCDate(f.getUTCDate() - 7);
  return f.toISOString().slice(0, 16);
}
async function resultsText() {
  const wid = lastWeekId();
  const { data } = await db.from("safari_players").select("first_name,last_name,week_xp")
    .eq("week_id", wid).gt("week_xp", 0).order("week_xp", { ascending: false });
  if (!data?.length) return "🏁 <b>Hafta yakunlandi</b>\n\nBu hafta hech kim ball to'plamadi. Yangi haftada kuchliroq boshlaymiz!";
  const medal = ["🥇", "🥈", "🥉"];
  const rows = data.map((p, i) =>
    `${medal[i] ?? `${i + 1}.`} ${esc(p.first_name ?? "")} ${esc((p.last_name ?? "").slice(0, 1))}. — <b>${p.week_xp} XP</b>`);
  return `🏁 <b>Haftalik liga natijalari</b>\n\n${rows.join("\n")}\n\nG'olibni tabriklaymiz! Yangi hafta boshlandi — ilovani oching 👇`;
}

async function onUpdate(u: any) {
  const cm = u.my_chat_member;
  if (cm && ["group", "supergroup"].includes(cm.chat.type)) {
    const st = cm.new_chat_member?.status;
    if (st === "member" || st === "administrator") {
      await db.from("liga_bot_chats").upsert({ chat_id: cm.chat.id, title: cm.chat.title, active: true });
      await tg("sendMessage", { chat_id: cm.chat.id, parse_mode: "HTML", reply_markup: openBot,
        text: "👋 Salom, buxgalterlar!\n\n<b>Hisobchi Liga</b> — haftalik musobaqa:\n• har kuni soat <b>17:00</b> gacha kunlik mashq;\n• liga dushanbadan <b>juma 12:00</b> gacha;\n• natijalar juma kuni shu guruhga chiqadi.\n\nBoshlash uchun pastdagi tugmani bosing." });
    } else if (st === "left" || st === "kicked") {
      await db.from("liga_bot_chats").update({ active: false }).eq("chat_id", cm.chat.id);
    }
    return;
  }
  const m = u.message;
  if (!m) return;
  if (m.migrate_to_chat_id) {
    await db.from("liga_bot_chats").update({ active: false }).eq("chat_id", m.chat.id);
    await db.from("liga_bot_chats").upsert({ chat_id: m.migrate_to_chat_id, title: m.chat.title, active: true });
    return;
  }
  const cmd = (m.text ?? "").split(/[\s@]/)[0].toLowerCase();
  const priv = m.chat.type === "private";
  if (cmd === "/start" || cmd === "/liga") {
    await tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", reply_markup: priv ? openApp : openBot,
      text: priv
        ? "🏆 <b>Hisobchi Liga</b>\n\nProvodka, QQS, ish haqi, soliq va hisobotlar bo'yicha kunlik mashq. Har kuni 17:00 gacha bajaring!\n\nIlovani ochish uchun tugmani bosing:"
        : "🏆 Ligani ochish uchun tugmani bosing:" });
  } else if (cmd === "/natija") {
    await tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", text: await resultsText(), reply_markup: priv ? openApp : openBot });
  } else if (cmd === "/qoida") {
    await tg("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML",
      text: "📋 <b>Qoidalar</b>\n• Kunlik mashq — har kuni soat 17:00 gacha, aks holda kun qoldirilgan hisoblanadi.\n• Liga — dushanbadan juma 12:00 gacha.\n• Kunlik natijangizni faqat o'zingiz ko'rasiz.\n• Hafta yakunidagi natija juma 12:00 da hammaga e'lon qilinadi." });
  }
}

async function onCron(action: string) {
  if (action === "setup") {
    const url = `${SB_URL}/functions/v1/liga-bot`;
    return {
      webhook: await tg("setWebhook", { url, secret_token: await hookSecret(), allowed_updates: ["message", "my_chat_member"], drop_pending_updates: true }),
      commands: await tg("setMyCommands", { commands: [
        { command: "liga", description: "Ilovani ochish" },
        { command: "natija", description: "Oxirgi hafta natijalari" },
        { command: "qoida", description: "Liga qoidalari" }] }),
      menu: await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Liga", web_app: { url: APP } } }),
      desc: await tg("setMyDescription", { description: "Hisobchi Liga — buxgalterlar uchun haftalik musobaqa: provodka, QQS, ish haqi, soliq va hisobotlar bo'yicha kunlik mashqlar." }),
      short: await tg("setMyShortDescription", { short_description: "Buxgalterlar uchun haftalik liga" }),
      me: await tg("getMe", {}),
    };
  }
  if (action === "monday") { await toGroups("🌅 <b>Yangi liga haftasi boshlandi!</b>\n\nJuma 12:00 gacha eng ko'p XP to'plagan g'olib bo'ladi. Bugungi mashqni 17:00 gacha bajaring 💪"); return { ok: true }; }
  if (action === "remind") { await toGroups("⏰ <b>Eslatma:</b> kunlik mashqqa <b>1 soat</b> qoldi — soat 17:00 gacha bajaring, seriyangiz uzilmasin!"); return { ok: true }; }
  if (action === "results") { await toGroups(await resultsText()); return { ok: true }; }
  if (action === "status") return { webhook: await tg("getWebhookInfo", {}), groups: await groups() };
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
