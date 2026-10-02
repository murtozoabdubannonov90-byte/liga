/* Server (Supabase) bilan aloqa. Barcha yozuvlar shaxsiy kalit bilan. */
import { S, persist, bump } from "./state";
import { accStats } from "./score";
import { setLigaStart } from "./time";
import { tgUser, inTelegram, W } from "../lib/tg";
import { t } from "../lib/i18n";

export const SUPA_URL = "https://bopzjxboembvcqycfwin.supabase.co";
const head = () => ({ apikey: S.key, Authorization: "Bearer " + S.key, "Content-Type": "application/json" });
export async function rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const r = await fetch(SUPA_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: head(), body: JSON.stringify(args || {}) });
  const t = await r.text(); if (!r.ok) throw new Error(t); return (t ? JSON.parse(t) : null) as T;
}
export const ERR: Record<string, string> = {
  group_not_found: "Bunday jamoa kodi topilmadi yoki to'xtatilgan",
  phone_taken: "Bu raqam boshqa telefonda ro'yxatdan o'tgan. Jamoa administratori «Qurilmani almashtirish» tugmasini bossin — keyin qayta ulaning",
  bad_input: "Ma'lumotlarni tekshiring", too_many: "Juda ko'p urinish — birozdan keyin qayta urinib ko'ring",
  final_closed: "Final yopiq — faqat oyning oxirgi shanbasi 10:00–13:00", not_qualified: "Siz bu oy finalga saralanmagansiz",
  not_winner: "Taklif faqat o'tgan hafta g'olibi uchun", bad_image: "Chek rasmini qayta tanlang (JPG yoki PNG)",
  bad_token: "Hisobingiz bu telefonga ulanmagan — «Qayta ulanish» tugmasini bosing", duel_taken: "Bu duelni boshqa odam qabul qilgan",
  already_done: "Siz buni allaqachon bajargansiz", duel_expired: "Duel muddati tugagan", not_found: "Topilmadi",
  test_closed: "Test yopilgan", not_eligible: "Sertifikat uchun shart bajarilmagan", not_admin: "PIN noto'g'ri",
};
export function errKey(e: unknown): string { const m = String((e as any)?.message || e); return Object.keys(ERR).find((k) => m.includes(k)) || "net"; }
export function errMsg(e: unknown): string { const k = errKey(e); return t(k === "net" ? "Serverga ulanib bo'lmadi — internetni tekshiring" : ERR[k]); }

export async function joinServer(force = false): Promise<{ ok: boolean; msg: string }> {
  try {
    if (S.pid && !S.token && !S.tokenLost && !force) {
      try { S.token = await rpc<string>("liga_claim", { p_id: S.pid }); S.joinErr = ""; persist(); await pushMe(); return { ok: true, msg: "Hisobingiz himoyalandi" }; }
      catch (e) { if (!/already_claimed/.test(String((e as any).message))) throw e; }
    }
    const r = (await rpc<any[]>("liga_join3", { p_first: S.user.first, p_last: S.user.last, p_phone: S.user.phone, p_group: S.group?.code || "ASOSIY",
      p_region: S.user.region || null, p_ref: S.ref || null, p_lang: S.lang || "uz" }))[0];
    const had = S.pid; S.pid = r.id; S.token = r.token; S.tokenLost = false; S.joinErr = "";
    S.me = { ...(S.me || {}), ref_code: r.ref_code }; persist(); await pushMe(); linkTelegram();
    return { ok: true, msg: had === r.id ? "Hisobingiz tiklandi" : "Ligaga qo'shildingiz" };
  } catch (e) {
    const k = errKey(e); if (k === "phone_taken" || k === "group_not_found") { S.joinErr = ERR[k]; persist(); }
    return { ok: false, msg: errMsg(e) };
  }
}
export async function pushMe() {
  if (!S.pid || !S.token) return;
  const P = S.week.part, ac = accStats();
  try {
    await rpc("liga_save", { p_id: S.pid, p_token: S.token, p_xp: S.xp, p_stages: Object.keys(S.stars).length, p_streak: S.streak,
      p_first: S.user.first, p_last: S.user.last, p_week_daily: P.daily || 0, p_week_blitz: P.blitz || 0, p_week_bonus: P.bonus || 0,
      p_week_stages: S.week.stages || {}, p_region: S.user.region || null, p_acc_ok: ac.ok, p_acc_total: ac.n });
  } catch (e) { if (/bad_token/.test(String((e as any).message))) { S.token = ""; S.tokenLost = true; persist(); } }
}
let lastPull = 0, pulling = false;
export async function pull(force = false) {
  if (pulling || (!force && Date.now() - lastPull < 40000)) return;
  pulling = true; lastPull = Date.now();
  try {
    const p = S.pid || null;
    const [res, cnt, mem] = await Promise.all([
      rpc<any[]>("liga_results", { p_id: p }).catch(() => null), rpc<number>("liga_count", { p_id: p }).catch(() => null),
      rpc<any[]>("liga_members2", { p_id: p }).catch(() => null)]);
    if (res) S.lastRes = res.length ? { id: res[0].week_id, rows: res.map((x) => ({ n: x.name, x: x.week_xp, me: x.is_me, d: x.week_stages || {} })) } : null;
    if (cnt != null) S.pcount = cnt;
    if (mem) S.members = mem.map((x) => ({ n: x.name, me: x.is_me, m: x.medal || 0, tier: x.tier || 0 }));
    if (S.pid) {
      const r = await Promise.all([
        rpc<any[]>("liga_group_info", { p_id: S.pid }).catch(() => null), rpc<any[]>("liga_champions", { p_id: S.pid }).catch(() => null),
        rpc<any[]>("liga_wq_state", { p_id: S.pid }).catch(() => null), rpc<any[]>("liga_final_info", { p_id: S.pid }).catch(() => null),
        rpc<any[]>("liga_region_league", { p_id: S.pid }).catch(() => null), rpc<any[]>("liga_player_status2", { p_id: S.pid }).catch(() => null),
        rpc<any[]>("liga_cq_list", { p_id: S.pid }).catch(() => null), rpc<any[]>("liga_my_certs", { p_id: S.pid }).catch(() => null)]);
      const [gi, ch, wq, fin, reg, me, cq, certs] = r;
      if (gi && gi[0]) { S.group = { code: gi[0].code, name: gi[0].name, until: gi[0].paid_until, ok: gi[0].ok, members: gi[0].members, start: gi[0].start_date }; setLigaStart(S.group.start); }
      if (ch) S.champs = ch; if (wq) S.wq = wq[0] || null; if (fin) S.fin = fin[0] || null; if (reg) S.regL = reg;
      if (me && me[0]) { S.me = { ...me[0] }; S.tier = me[0].tier; }
      if (cq) S.customQ = cq; if (certs) S.certs = certs;
    }
    rpc<any[]>("liga_pay_config2").then((c) => { if (c && c[0]) { S.payCfg = c[0]; persist(); } }).catch(() => {});
    if (S.adminPin) rpc<any[]>("liga_admin_list2", { p_pin: S.adminPin }).then((x) => { S.adminRows = x; persist(); }).catch(() => {});
    persist();
  } finally { pulling = false; }
}
let tmr: any = null;
export const syncSoon = () => { clearTimeout(tmr); tmr = setTimeout(() => { pushMe().then(() => pull(true)); }, 2500); };
export const syncNow = async () => { await pushMe(); await pull(true); };

/* Telegram orqali ochilgan bo'lsa — shaxsiy eslatmalar uchun bog'lash (bot initData ni tekshiradi) */
export const BOT_API = SUPA_URL + "/functions/v1/liga-bot/app";
export async function botApp(action: string, extra: Record<string, unknown> = {}) {
  const r = await fetch(BOT_API, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, initData: inTelegram ? W.initData : "", p_id: S.pid, token: S.token, ...extra }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "net"); return j;
}
export async function linkTelegram() {
  if (!inTelegram || !S.pid || !S.token || !tgUser()) return;
  const uid = String(tgUser().id); if (S.tgLinked === uid as any) return;
  try { await botApp("link"); S.tgLinked = uid as any; persist(); } catch { /* keyinroq */ }
}
export function setLangServer() { if (S.pid && S.token) rpc("liga_set_lang", { p_id: S.pid, p_token: S.token, p_lang: S.lang }).catch(() => {}); }
export { bump };
