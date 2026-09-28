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

async function resultsText() {
  const { data } = await db.rpc("liga_results", { p_id: null });
  if (!data?.length) return "🏁 <b>Hafta yakunlandi</b>\n\nBu hafta hech kim ball to'plamadi. Yangi haftada kuchliroq boshlaymiz!";
  const medal = ["🥇", "🥈", "🥉"];
  const rows = data.map((p: any, i: number) => {
    const st = p.week_stage ?? 0, dl = p.week_daily ?? 0, bl = p.week_blitz ?? 0, bo = Math.max(0, p.week_xp - st - dl);
    return `${medal[i] ?? `${i + 1}.`} ${esc(p.name ?? "")} — <b>${p.week_xp} XP</b>\n     🗺️ bosqich ${st} · 🎯 kunlik ${dl} · 🎁 bonus ${bo}\n     ⚡ blits ${bl} <i>(jamiga kirmaydi)</i>` +
      (Object.keys(p.week_stages ?? {}).length ? `\n     📅 ` + Object.keys(p.week_stages).map(Number).sort((a, b) => a - b).map((k) => `${k + 1}-bosqich: ${p.week_stages[k]}`).join(" · ") : "");
  });
  const win = data[0];
  return `🏁 <b>Haftalik liga natijalari</b>\n\n${rows.join("\n")}\n\n🏆 G'olib: <b>${esc(win.name ?? "")}</b> — tabriklaymiz!\nYangi hafta dushanba soat 09:00 da boshlanadi 👇`;
}

async function onUpdate(u: any) {
  const cm = u.my_chat_member;
  if (cm && ["group", "supergroup"].includes(cm.chat.type)) {
    const st = cm.new_chat_member?.status;
    if (st === "member" || st === "administrator") {
      await db.from("liga_bot_chats").upsert({ chat_id: cm.chat.id, title: cm.chat.title, active: true });
      await tg("sendMessage", { chat_id: cm.chat.id, parse_mode: "HTML", reply_markup: openBot,
        text: "👋 Salom, buxgalterlar!\n\n<b>Hisobchi Liga</b> — haftalik musobaqa:\n• har kuni soat <b>17:00</b> gacha kunlik mashq;\n• liga dushanbadan <b>juma 12:00</b> gacha;\n• hafta davomida natijangizni faqat o'zingiz ko'rasiz;\n• yakuniy jadval juma 12:00 da shu guruhga chiqadi;\n• shanba-yakshanba — faqat qo'shimcha mashq.\n\nBoshlash uchun pastdagi tugmani bosing." });
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
      text: "📋 <b>Qoidalar</b>\n• Kunlik mashq — har kuni soat 17:00 gacha, aks holda kun qoldirilgan hisoblanadi.\n• Liga — dushanbadan juma 12:00 gacha.\n• Har savolga 1 daqiqa. Xato bo'lsa, sababi va to'g'ri javob darhol ko'rsatiladi.\n• Shanba-yakshanba — faqat qo'shimcha mashq, ligaga XP qo'shilmaydi.\n• Hafta davomida natijangizni faqat o'zingiz ko'rasiz.\n• Yakuniy jadval juma 12:00 da hammaga e'lon qilinadi." });
  }
}

const TITLES = ["Birinchi ish kuni","Firma tug'iladi","Tovar keldi","Birinchi savdo","Ish haqi kuni","Yangi uskuna",
  "Soliqlar xaritasi","Hisobotlar taqvimi","Imtiyozlar","Qonun va qarorlar","Yil yakuni","Boss: soliq tekshiruvi"];
// Toshkent sanasi (UTC+5)
function tzDate(d = new Date()) { const t = new Date(d.getTime() + 5 * 3600e3); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }
// bugun ochiladigan bosqich (1-bosqich — 28.09.2026 dushanba, har ish kuni +1)
function todayStage(): number | null {
  const start = Date.UTC(2026, 8, 28), today = tzDate();
  if (today.getTime() < start) return null;
  let n = 0; const d = new Date(start);
  while (d.getTime() < today.getTime()) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w >= 1 && w <= 5) n++; }
  return n < TITLES.length ? n : null;
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
        { command: "qoida", description: "Liga qoidalari" }] }),
      menu: await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Liga", web_app: { url: APP } } }),
      desc: await tg("setMyDescription", { description: "Hisobchi Liga — buxgalterlar uchun haftalik musobaqa: provodka, QQS, ish haqi, soliq va hisobotlar bo'yicha kunlik mashqlar." }),
      short: await tg("setMyShortDescription", { short_description: "Buxgalterlar uchun haftalik liga" }),
      me: await tg("getMe", {}),
    };
  }
  const w = tzDate().getUTCDay();
  if (action === "day_start") {
    if (w < 1 || w > 5) return { skip: "weekend" };
    if (!(await once("day_start"))) return { skip: "already" };
    const si = todayStage();
    const stage = si === null ? "" : `\n📚 Bugun <b>${si + 1}-bosqich: ${TITLES[si]}</b> ochildi (20 savol).`;
    const head = w === 1
      ? "🚀 <b>Yangi liga haftasi boshlandi!</b>\n\nLiga bugundan <b>juma soat 12:00</b> gacha davom etadi."
      : "☀️ <b>Bugungi o'yin boshlandi!</b>";
    await toGroups(`${head}${stage}\n⏰ Kunlik mashqni <b>soat 17:00</b> gacha bajaring.\n⏱ Har savolga 1 daqiqa.\n\nOmad, buxgalterlar! 💪`);
    return { ok: true, stage: si };
  }
  if (action === "remind") {
    if (w < 1 || w > 5 || !(await once("remind"))) return { skip: true };
    await toGroups("⏰ <b>Eslatma:</b> bugungi o'yin tugashiga <b>1 soat</b> qoldi — soat 17:00 gacha bajaring, seriyangiz uzilmasin!");
    return { ok: true };
  }
  if (action === "day_end") {
    if (w < 1 || w > 5 || !(await once("day_end"))) return { skip: true };
    const tail = w === 5 ? "Haftalik liga natijalari yuqorida e'lon qilindi. Yangi hafta dushanba soat 09:00 da boshlanadi." :
      w === 4 ? "Ertaga — haftaning oxirgi kuni. Liga <b>juma 12:00</b> da yakunlanadi va natijalar shu guruhga chiqadi." :
      "Ertaga soat 09:00 da yangi bosqich ochiladi. Liga natijalari <b>juma 12:00</b> da e'lon qilinadi.";
    await toGroups(`🔔 <b>Bugungi o'yin tugadi!</b>\n\nSoat 17:00 dan keyin bajarilgan mashq kunlik seriyaga kirmaydi.\n${tail}`);
    return { ok: true };
  }
  if (action === "friday_warn") {
    if (w !== 5 || !(await once("friday_warn"))) return { skip: true };
    await toGroups("⏳ <b>Liga tugashiga 1 soat qoldi!</b>\n\nSoat 12:00 da haftalik liga yakunlanadi. Oxirgi imkoniyat — ballaringizni oshiring! 🔥");
    return { ok: true };
  }
  if (action === "results" || action === "league_end") {
    if (!(await once("league_end"))) return { skip: true };
    await toGroups("🏁 <b>Haftalik liga tugadi!</b>\n\n" + (await resultsText()).replace(/^🏁 <b>[^<]*<\/b>\n\n/, ""));
    return { ok: true };
  }
  if (action === "status") return { webhook: await tg("getWebhookInfo", {}), groups: await groups(), stage: todayStage() };
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
