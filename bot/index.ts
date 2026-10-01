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
    text: `✅ <b>Chek qabul qilindi!</b>\n\nSiz ligaga qo'shildingiz${p?.first_name ? `, ${esc(p.first_name)}` : ""}.\n💳 Obuna: <b>${fmtD(r.paid_until)}</b> gacha.\n\nBosqichlar har ish kuni 09:00–17:00. Omad! 💪` });
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

  if (priv && m.contact) {
    if (m.contact.user_id !== m.from?.id) return reply("❗ O'zingizning raqamingizni yuboring (pastdagi tugma orqali).");
    let ph = String(m.contact.phone_number ?? "").replace(/\D/g, ""); if (ph.length === 9) ph = "998" + ph;
    const { data: pl } = await db.from("safari_players").select("id,first_name").eq("phone", "+" + ph).maybeSingle();
    if (!pl) return reply("❌ Bu raqam bilan ro'yxatdan o'tilmagan. Avval ilovada ro'yxatdan o'ting, keyin chekni yuboring.", openApp());
    await setSession(m.chat.id, pl.id, 1);
    await tg("sendMessage", { chat_id: m.chat.id, text: "✅ Topildi.", reply_markup: { remove_keyboard: true } });
    return cardMessage(m.chat.id, 1, pl.first_name);
  }
  if (priv && (m.photo || m.document)) return onReceipt(m);
  if (priv && cmd === "/start" && /^pay_[0-9a-f]+$/i.test(arg)) {
    const { data: l } = await db.from("liga_tg_links").select("player_id,created_at").eq("code", arg.slice(4)).eq("kind", "pay").maybeSingle();
    if (!l || Date.now() - new Date(l.created_at).getTime() > 7 * 864e5) return askContact(m.chat.id);
    await setSession(m.chat.id, l.player_id, 1);
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
  if (priv && cmd === "/tolov") {
    const { data: ses } = await db.from("liga_tg_sessions").select("player_id,months").eq("chat_id", m.chat.id).maybeSingle();
    if (!ses) return askContact(m.chat.id);
    return cardMessage(m.chat.id, ses.months);
  }
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
  if (action.startsWith("receipt:")) return await notifyAdmins(Number(action.slice(8)));
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
