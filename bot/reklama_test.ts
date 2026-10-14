// Ishga tushirish: deno test bot/reklama_test.ts
import { adReason, linkAllowed, mentionsOf } from "./reklama.ts";

function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: kutilgan ${JSON.stringify(b)}, chiqdi ${JSON.stringify(a)}`);
}
const url = (text: string, sub: string) => ({ type: "url", offset: text.indexOf(sub), length: sub.length });

Deno.test("oddiy savol — reklama emas", () => {
  eq(adReason({ text: "5010 ga kirim qaysi hisobvaraqdan?" }), "", "oddiy matn");
});
Deno.test("rasmiy saytlar havolasi ruxsat", () => {
  const t = "Mana: https://lex.uz/docs/6022012 va www.soliq.uz";
  eq(adReason({ text: t, entities: [url(t, "https://lex.uz/docs/6022012"), url(t, "www.soliq.uz")] }), "", "lex/soliq");
  eq(linkAllowed("https://my.soliq.uz/main"), true, "pastki domen");
  eq(linkAllowed("https://murtozoabdubannonov90-byte.github.io/liga/"), true, "liga ilovasi");
  eq(linkAllowed("https://t.me/Buxgalterlar_Ligasi_bot?start=x"), true, "liga boti");
});
Deno.test("begona sayt va kanal havolasi — reklama", () => {
  const t = "Kursimizga yoziling https://kurs-buxgalter.com";
  eq(adReason({ text: t, entities: [url(t, "https://kurs-buxgalter.com")] }), "link", "begona sayt");
  eq(adReason({ text: "kanalimiz t.me/mening_kanalim ga obuna" }), "link", "entitysiz t.me");
  eq(adReason({ text: "bu yerga", entities: [{ type: "text_link", offset: 0, length: 3, url: "https://t.me/+AbCdEf" }] }), "link", "yashirin havola");
  eq(linkAllowed("lex.uz.phish.com"), false, "soxta domen");
  eq(linkAllowed("https://notlex.uz"), false, "o'xshash domen");
});
Deno.test("kanal/guruhdan forward, tugmalar, begona inline-bot — reklama", () => {
  eq(adReason({ text: "x", forward_origin: { type: "channel" } }), "forward", "kanaldan forward");
  eq(adReason({ text: "x", forward_origin: { type: "user" } }), "", "odamdan forward ruxsat");
  eq(adReason({ text: "x", reply_markup: { inline_keyboard: [[{ text: "Obuna", url: "https://t.me/x" }]] } }), "buttons", "tugmali");
  eq(adReason({ text: "x", via_bot: { username: "SomeAdsBot" } }), "inline_bot", "begona inline bot");
  eq(adReason({ text: "x", via_bot: { username: "Buxgalterlar_Ligasi_bot" } }), "", "o'z botimiz");
});
Deno.test("mentionlar ajratiladi, liga boti chiqarib tashlanadi", () => {
  const t = "@kanal_nomi va @Buxgalterlar_Ligasi_bot hamda @aziz";
  const ents = ["@kanal_nomi", "@Buxgalterlar_Ligasi_bot", "@aziz"].map((s) => ({ type: "mention", offset: t.indexOf(s), length: s.length }));
  eq(mentionsOf({ text: t, entities: ents }), ["kanal_nomi", "aziz"], "mentionlar");
});
Deno.test("rasm izohidagi havola ham tekshiriladi", () => {
  const c = "Chegirma! https://shop.uz";
  eq(adReason({ caption: c, caption_entities: [url(c, "https://shop.uz")] }), "link", "caption");
});
