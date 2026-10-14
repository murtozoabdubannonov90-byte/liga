/* Kunlik duel kubogi: raqib ismi ustiga bosilsa — telefon raqami va Telegram niki (qo'ng'iroq qilish / yozish uchun).
   Ma'lumot faqat shu duelning ishtirokchisiga, token bilan beriladi (liga_duel_opp_contact). */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, Send, Copy, X, UserRound } from "lucide-react";
import { S } from "../engine/state";
import { rpc, errMsg } from "../engine/server";
import { t } from "../lib/i18n";
import { toast } from "../lib/nav";
import { openTg, openUrl } from "../lib/tg";
import { copyText } from "./ui";

type Contact = { name?: string; phone?: string; tg?: string; tg_id?: number; region?: string };

/* +998901234567 → +998 90 123 45 67 */
export const fmtPhone = (p?: string) => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 12 && d.startsWith("998") ? `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : p || "";
};

export function OppName({ code, name, className, id }: { code?: string; name?: string; className?: string; id?: string }) {
  const [open, setOpen] = useState(false);
  if (!code || !name || !S.pid || !S.token) return <b className={className}>{name || t("Raqib")}</b>;
  return <>
    <button type="button" className={"opp-link " + (className || "")} id={id} onClick={() => setOpen(true)} aria-label={t("Raqib bilan bog'lanish")}>
      <span>{name}</span><Phone size={13} />
    </button>
    {open && <OppSheet code={code} name={name} onClose={() => setOpen(false)} />}
  </>;
}

function OppSheet({ code, name, onClose }: { code: string; name: string; onClose: () => void }) {
  const [c, setC] = useState<Contact | null>(null), [err, setErr] = useState("");
  useEffect(() => {
    let on = true;
    rpc<Contact | null>("liga_duel_opp_contact", { p_id: S.pid, p_token: S.token, p_code: code })
      .then((x) => on && (x ? setC(x) : setErr(t("Raqib hali aniqlanmagan")))).catch((e) => on && setErr(errMsg(e)));
    const esc = (e: KeyboardEvent) => e.keyCode === 27 && onClose();
    window.addEventListener("keydown", esc);
    return () => { on = false; window.removeEventListener("keydown", esc); };
  }, [code]);
  const tgUrl = c?.tg ? "https://t.me/" + c.tg : "";
  return createPortal(
    <div className="opp-wrap" onClick={onClose}>
      <section className="opp-sheet" id="opp-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="opp-h">
          <span className="opp-av"><UserRound size={22} /></span>
          <div className="grow"><p className="tiny muted" style={{ fontWeight: 800 }}>{t("Raqibingiz")}</p><h3>{c?.name || name}</h3>{c?.region && <small className="muted">{c.region}</small>}</div>
          <button className="opp-x" onClick={onClose} aria-label={t("Yopish")}><X size={20} /></button>
        </div>
        {!c && !err && <p className="small muted">{t("Yuklanmoqda...")}</p>}
        {err && <p className="small" style={{ color: "var(--red)", fontWeight: 700 }}>{err}</p>}
        {c && <>
          <div className="opp-row" id="opp-phone">
            <Phone size={18} /><div className="grow"><small>{t("Telefon")}</small><b className="num">{c.phone ? fmtPhone(c.phone) : t("ko'rsatilmagan")}</b></div>
            {c.phone && <button className="chip" onClick={() => copyText(c.phone!, () => toast(t("Nusxa olindi")))} aria-label={t("Nusxa")}><Copy size={14} /></button>}
          </div>
          <div className="opp-row" id="opp-tg">
            <Send size={18} /><div className="grow"><small>Telegram</small><b>{c.tg ? "@" + c.tg : c.tg_id ? t("nik qo'yilmagan") : t("bot ulanmagan")}</b></div>
            {c.tg && <button className="chip" onClick={() => copyText("@" + c.tg, () => toast(t("Nusxa olindi")))} aria-label={t("Nusxa")}><Copy size={14} /></button>}
          </div>
          <div className="btn-row">
            {c.phone && <a className="btn ghost" id="opp-call" href={"tel:" + c.phone.replace(/[^\d+]/g, "")}><Phone size={18} />{t("Qo'ng'iroq")}</a>}
            {tgUrl ? <button className="btn" id="opp-write" onClick={() => openTg(tgUrl)}><Send size={18} />{t("Yozish")}</button>
              : c.tg_id ? <button className="btn" id="opp-write" onClick={() => openUrl("tg://user?id=" + c.tg_id)}><Send size={18} />{t("Yozish")}</button> : null}
          </div>
          <p className="tiny muted">{t("Raqibingiz duelga kirmayotgan bo'lsa — qo'ng'iroq qiling yoki yozing. Raqam faqat duel raqibiga ko'rinadi.")}</p>
        </>}
      </section>
    </div>, document.body);
}
