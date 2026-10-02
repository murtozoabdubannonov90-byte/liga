import { useState } from "react";
import { Copy, Bot, Upload, ShieldCheck, Check } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { tab, toast } from "../lib/nav";
import { PageTitle, Seg, copyText } from "../components/ui";
import { rpc, errMsg, joinServer, syncSoon } from "../engine/server";
import { fmt } from "../engine/data";
import { fmtD } from "../engine/time";
import { BOT_LINK, openTg, openUrl, APP_LINK } from "../lib/tg";
import { sfx, burst } from "../lib/fx";

export const price = () => S.payCfg?.price || S.me?.price || 30000;
const cardFmt = (c: string) => String(c || "").replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
function shrink(file: File): Promise<string> {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = () => rej(new Error("bad_image"));
    fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error("bad_image"));
      im.onload = () => { let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, 1200 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        let q = 0.75, d = c.toDataURL("image/jpeg", q); while (d.length > 1400000 && q > 0.3) { q -= 0.15; d = c.toDataURL("image/jpeg", q); } res(d); };
      im.src = fr.result as string; }; fr.readAsDataURL(file); });
}
function payLinks(cfg: any, inv: { id: number; amount: number }) {
  const L: [string, string][] = [];
  if (cfg?.payme_merchant_id) L.push(["Payme", "https://checkout.paycom.uz/" + btoa(`m=${cfg.payme_merchant_id};ac.invoice_id=${inv.id};a=${inv.amount * 100};c=${APP_LINK}`)]);
  if (cfg?.click_service_id && cfg?.click_merchant_id) L.push(["Click", `https://my.click.uz/services/pay?service_id=${cfg.click_service_id}&merchant_id=${cfg.click_merchant_id}&amount=${inv.amount}&transaction_param=${inv.id}&return_url=${encodeURIComponent(APP_LINK)}`]);
  return L;
}
export default function Pay() {
  const [m, setM] = useState("1"), [img, setImg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState<string | null>(null);
  const c = S.payCfg || {}, card = cardFmt(c.card), me = S.me || {};
  const need = async () => { if (!S.token) { const j = await joinServer(); if (!j.ok) { setErr(t(j.msg)); return false; } } return true; };
  const viaBot = async () => { setErr(""); if (!(await need())) return; try { const code = await rpc<string>("liga_tg_pay_link", { p_id: S.pid, p_token: S.token }); openTg(BOT_LINK + "?start=" + code); } catch (e) { setErr(errMsg(e)); } };
  const send = async () => {
    if (!img) return; setBusy(true); setErr(""); if (!(await need())) { setBusy(false); return; }
    try { const r = (await rpc<any[]>("liga_receipt_submit", { p_id: S.pid, p_token: S.token, p_months: +m, p_image: img }))[0];
      S.me = { ...(S.me || {}), ok: true, personal: true, paid_until: r?.paid_until, pending: true }; persist(); syncSoon(); setDone(r?.paid_until); sfx("win"); burst(true);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const online = async () => { try { const v = (await rpc<any[]>("liga_my_invoice", { p_id: S.pid, p_token: S.token, p_months: +m }))[0]; const L = payLinks(c, v); if (L[0]) openUrl(L[0][1]); } catch (e) { setErr(errMsg(e)); } };
  if (done !== null) return (
    <div className="shell bare"><div className="result"><Check size={72} color="var(--green)" style={{ margin: "0 auto" }} /><h2>{t("Ligaga qo'shildingiz!")}</h2>
      <span className="chip ok" style={{ justifySelf: "center" }}>{t("Obuna {d} gacha", { d: fmtD(done) })}</span>
      <p className="small muted">{t("Chekingiz administratorga yuborildi. Bosqichlar ochildi — har ish kuni 09:00–17:00, juma 09:00–12:00.")}</p></div>
      <div className="dock"><button className="btn" onClick={() => tab("home")}>{t("Boshlash")}</button></div></div>);
  return (
    <div className="shell bare">
      <PageTitle title={t("Ligaga qo'shilish")} />
      <div className="stack">
        <p style={{ fontWeight: 700 }}>{t("Ligada qatnashish: oyiga {p} so'm. To'lovdan keyin bosqichlar ochiladi.", { p: fmt(price()) })}</p>
        {me.ok && me.paid_until && <div className="note" style={{ background: "var(--green-soft)" }}><Check size={18} color="var(--green)" /><span>{t("Obunangiz {d} gacha faol. Quyida uzaytirishingiz mumkin.", { d: fmtD(me.paid_until) })}</span></div>}
        <Seg id="months" value={m} onChange={setM} items={[["1", t("1 oy")], ["3", t("3 oy")], ["6", t("6 oy")]]} />
        <div className="paycard">
          <span className="small" style={{ color: "var(--on-board-2)", fontWeight: 700 }}>{t("Kartaga o'tkazing")} · <span id="amt">{fmt(price() * +m)}</span> {t("so'm")}</span>
          {card ? <><b>{card}</b><span className="small" style={{ color: "var(--on-board-2)" }}>{c.card_name}</span>
            <button className="btn sm ghost" style={{ justifySelf: "start", marginTop: 6 }} onClick={() => copyText(String(c.card).replace(/\D/g, ""), () => toast(t("Nusxa olindi")))}><Copy size={16} />{t("Nusxa olish")}</button></>
            : <span>{t("Karta raqami tez orada qo'shiladi. Hozircha yozing: @murtozo_44")}</span>}
        </div>
        <button className="btn" id="tgpay" onClick={viaBot}><Bot size={18} />{t("Chekni botga yuborish")}</button>
        <p className="small muted" style={{ textAlign: "center", fontWeight: 600 }}>{t("yoki chekni shu yerda yuklang")}</p>
        <label className="btn ghost" htmlFor="rf" style={{ cursor: "pointer" }}><Upload size={18} />{img ? t("Boshqa rasm tanlash") : t("Chek rasmini tanlash")}</label>
        <input id="rf" type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setImg(await shrink(f)); } catch { setErr(t("Chek rasmini qayta tanlang (JPG yoki PNG)")); } }} />
        {img && <img id="rprev" src={img} alt={t("Chek")} style={{ maxHeight: 260, borderRadius: 14, justifySelf: "center" }} />}
        {(c.payme_merchant_id || (c.click_service_id && c.click_merchant_id)) && <button className="btn ghost" onClick={online}>{t("Payme / Click orqali to'lash")}</button>}
        <div className="note"><ShieldCheck size={18} /><span>{t("Chekni administrator tekshiradi. Chek soxta yoki summa kam bo'lsa, obuna bekor qilinadi.")}</span></div>
        <p className="err">{err}</p>
      </div>
      {img && <div className="dock"><button className="btn ok" id="go" disabled={busy} onClick={send}>{busy ? t("Yuborilmoqda...") : t("Chekni yuborish")}</button></div>}
    </div>
  );
}
