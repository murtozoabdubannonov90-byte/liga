// Muhokama guruhi: reklamani aniqlash (sof funksiyalar — bot/reklama_test.ts da sinovlari bor).
// Ruxsat: oddiy matn, savol-javob, rasm, fayl, qonunchilik va rasmiy saytlarga havolalar.
// Taqiqlangan: boshqa saytlarga havolalar, kanal/guruhdan forward, kanal/guruh/bot @mentionlari, tugmali xabarlar, begona inline-botlar.

// ruxsat etilgan domenlar (o'zi va pastki domenlari)
export const ALLOWED_DOMAINS = [
  "lex.uz", "soliq.uz", "my.soliq.uz", "norma.uz", "buxgalter.uz", "gov.uz", "mf.uz", "stat.uz", "cbu.uz",
  "didox.uz", "faktura.uz", "murtozoabdubannonov90-byte.github.io",
];
// ruxsat etilgan Telegram manzillari (bot va liga)
export const ALLOWED_TG = ["buxgalterlar_ligasi_bot"];

const hostOf = (raw: string): string => {
  let u = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "http://" + u;
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
};
const tgPath = (raw: string): string => {
  const m = /(?:^|\/\/)(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?([A-Za-z0-9_+]+)/i.exec(raw.trim());
  return m ? m[1].toLowerCase() : "";
};

// havola ruxsat etilganmi
export function linkAllowed(raw: string): boolean {
  if (/^(mailto|tel):/i.test(raw.trim())) return true;
  const t = tgPath(raw);
  if (t) return ALLOWED_TG.includes(t);
  if (/^tg:\/\//i.test(raw.trim())) return false;
  const h = hostOf(raw);
  if (!h) return false;
  if (h === "t.me" || h === "telegram.me") return false;
  return ALLOWED_DOMAINS.some((d) => h === d || h.endsWith("." + d));
}

type Ent = { type: string; offset: number; length: number; url?: string };
const sliceUtf16 = (s: string, e: Ent) => s.substr(e.offset, e.length);

// sinxron tekshiruv: sabab qaytaradi (bo'sh — reklama emas). Mentionlar alohida (mentionsOf) — ular getChat bilan tekshiriladi.
export function adReason(m: any, botUsername = "Buxgalterlar_Ligasi_bot"): string {
  const fo = m.forward_origin;
  if (fo && (fo.type === "channel" || fo.type === "chat")) return "forward";
  if (m.forward_from_chat) return "forward";
  if (m.via_bot && String(m.via_bot.username ?? "").toLowerCase() !== botUsername.toLowerCase()) return "inline_bot";
  if (m.reply_markup?.inline_keyboard?.length) return "buttons";
  if (m.story) return "forward";
  const text: string = m.text ?? m.caption ?? "";
  const ents: Ent[] = m.entities ?? m.caption_entities ?? [];
  for (const e of ents) {
    if (e.type === "url" && !linkAllowed(sliceUtf16(text, e))) return "link";
    if (e.type === "text_link" && e.url && !linkAllowed(e.url)) return "link";
  }
  // entity bo'lmasa ham yashirin t.me havolalar (masalan, "t . me/kanal" emas, oddiy "t.me/kanal")
  const raw = /(?:t\.me|telegram\.me)\/(?:\+|joinchat\/)?[A-Za-z0-9_]{3,}/i.exec(text);
  if (raw && !linkAllowed(raw[0])) return "link";
  return "";
}

// @mentionlar (ruxsat etilganlardan tashqari) — bot getChat bilan kanal/guruh/botligini tekshiradi
export function mentionsOf(m: any): string[] {
  const text: string = m.text ?? m.caption ?? "";
  const ents: Ent[] = m.entities ?? m.caption_entities ?? [];
  const out = new Set<string>();
  for (const e of ents) if (e.type === "mention") {
    const u = sliceUtf16(text, e).replace(/^@/, "");
    if (u && !ALLOWED_TG.includes(u.toLowerCase())) out.add(u);
  }
  return [...out];
}
