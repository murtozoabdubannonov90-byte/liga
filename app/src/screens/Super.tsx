import { useEffect, useState } from "react";
import { ShieldCheck, Plus, LogOut, CreditCard, Copy } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { go, replace, toast, tab } from "../lib/nav";
import { PageTitle, Card, Seg, Empty, copyText } from "../components/ui";
import { TaxCalEditor, NewsEditor } from "./Tools";
import { rpc, errMsg } from "../engine/server";
import { fmtD } from "../engine/time";
import { BOT_LINK } from "../lib/tg";
import { REGIONS } from "./Onboard";
import { QEditor } from "./Admin";

export function AdminLogin() {
  const [pin, setPin] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const go2 = async () => {
    if (!pin.trim()) return setErr(t("PIN kiriting")); setBusy(true); setErr("");
    try { const role = await rpc<string>("liga_pin_check", { p_pin: pin.trim() });
      if (role === "super") { S.superPin = pin.trim(); persist(); replace("super"); }
      else if (role === "admin") { S.adminPin = pin.trim(); S.adminGroup = null; persist(); replace("admin"); }
      else setErr(t("PIN noto'g'ri"));
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="shell bare"><PageTitle title={t("Admin kirish")} />
      <div className="stack">
        <div className="note"><ShieldCheck size={18} /><span>{t("Faqat liga administratori uchun. PIN kodni kiriting.")}</span></div>
        <div className="field"><label htmlFor="pin">{t("PIN kod")}</label><input id="pin" className="inp mono" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go2()} /></div>
        <p className="err" id="st">{err}</p>
      </div>
      <div className="dock"><button className="btn" id="go" disabled={busy} onClick={go2}>{t("Kirish")}</button></div>
    </div>);
}
function Groups() {
  const [rows, setRows] = useState<any[] | null>(null), [n, setN] = useState(""), [rg, setRg] = useState(""), [d, setD] = useState("30"), [res, setRes] = useState("");
  const load = () => rpc<any[]>("liga_super_groups", { p_pin: S.superPin }).then((r) => setRows(r || [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (n.trim().length < 2) return setRes(t("Nomini kiriting"));
    try { const g = (await rpc<any[]>("liga_super_create", { p_pin: S.superPin, p_name: n.trim(), p_days: +d, p_max: null, p_region: rg || null }))[0];
      if (!g) return setRes(t("PIN eskirgan — qayta kiring"));
      const txt = `Hisobchi Liga — «${n.trim()}»\n${t("Jamoa kodi")}: ${g.code}\n${t("Admin PIN")}: ${g.admin_pin}\n${t("Taklif havolasi")}: ${BOT_LINK}?start=g_${g.code}\n${t("Boshlanish")}: ${fmtD(g.start_date)}`;
      setRes(txt); copyText(txt, () => toast(t("Nusxa olindi"))); setN(""); load();
    } catch (e) { setRes(errMsg(e)); }
  };
  return (
    <div className="stack">
      <Card title={t("Yangi jamoa")}>
        <div className="stack" style={{ gap: 10 }}>
          <input className="inp" placeholder={t("Jamoa nomi")} value={n} onChange={(e) => setN(e.target.value)} aria-label={t("Jamoa nomi")} />
          <select className="inp" value={rg} onChange={(e) => setRg(e.target.value)} aria-label={t("Viloyat")}><option value="">{t("— viloyat —")}</option>{REGIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}</select>
          <Seg id="days" value={d} onChange={setD} items={[["30", t("30 kun")], ["90", t("90 kun")], ["0", t("To'lov kutilmoqda")], ["-1", t("Muddatsiz")]]} />
          <p className="small muted">{t("Sinov muddati yo'q. Jamoa keyingi dushanbadan boshlanadi.")}</p>
          <button className="btn" onClick={create}><Plus size={18} />{t("Jamoa yaratish")}</button>
          {res && <pre className="flat small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{res}</pre>}
        </div>
      </Card>
      <Card title={t("Jamoalar")} right={<span className="chip">{rows?.length || 0}</span>}>
        {!rows ? <Empty>{t("Yuklanmoqda...")}</Empty> : rows.map((g) => (
          <div key={g.code} className="flat" style={{ marginBottom: 8 }}>
            <div className="row"><b className="grow">{g.name} · <span className="mono">{g.code}</span></b><span className={"chip " + (g.ok ? "ok" : "bad")}>{!g.active ? t("to'xtatilgan") : g.ok ? t("faol") : t("to'lanmagan")}</span></div>
            <p className="small muted">{t("{n} ishtirokchi", { n: g.members })} · PIN <span className="mono">{g.admin_pin}</span> · {g.paid_until ? fmtD(g.paid_until) : t("muddatsiz")}{g.region ? " · " + t(g.region) : ""}</p>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm ghost" onClick={async () => { await rpc("liga_super_update", { p_pin: S.superPin, p_code: g.code, p_add_days: 30, p_active: null }); toast(t("Uzaytirildi")); load(); }}>+30 {t("kun")}</button>
              <button className="btn sm ghost" onClick={async () => { if (!confirm(t("Ishonchingiz komilmi?"))) return; await rpc("liga_super_update", { p_pin: S.superPin, p_code: g.code, p_add_days: 0, p_active: !g.active }); load(); }}>{g.active ? t("To'xtatish") : t("Yoqish")}</button>
              <button className="btn sm ghost" onClick={() => copyText(BOT_LINK + "?start=g_" + g.code, () => toast(t("Nusxa olindi")))}><Copy size={15} /></button></div>
          </div>))}
      </Card>
    </div>);
}
function CardSet() {
  const [c, setC] = useState(S.payCfg?.card || ""), [nm, setNm] = useState(S.payCfg?.card_name || ""), [st, setSt] = useState("");
  const save = async () => { if (c.replace(/\D/g, "").length < 16) return setSt(t("Karta raqami 16 xonali bo'lishi kerak"));
    try { await rpc("liga_super_set_card", { p_pin: S.superPin, p_card: c, p_name: nm }); S.payCfg = { ...(S.payCfg || {}), card: c, card_name: nm }; persist(); setSt("✅ " + t("Saqlandi")); } catch (e) { setSt(errMsg(e)); } };
  return (
    <Card title={t("To'lov kartasi")} right={<CreditCard size={20} />}>
      <div className="stack" style={{ gap: 10 }}>
        <input className="inp mono" inputMode="numeric" placeholder="8600 0000 0000 0000" value={c} onChange={(e) => setC(e.target.value)} aria-label={t("Karta raqami")} />
        <input className="inp" placeholder={t("Karta egasi")} value={nm} onChange={(e) => setNm(e.target.value)} aria-label={t("Karta egasi")} />
        <p className="small">{st}</p><button className="btn" onClick={save}>{t("Saqlash")}</button>
      </div>
    </Card>);
}
export function Super() {
  const [tb, setTb] = useState<"g" | "c" | "q" | "tc" | "nw">("g");
  return (
    <div className="shell bare"><PageTitle title={t("Superadmin")} />
      <div className="stack">
        <Seg id="sup" value={tb} onChange={setTb} items={[["g", t("Jamoalar")], ["c", t("Karta")], ["q", t("Savollar")], ["tc", t("Taqvim")], ["nw", t("Yangilik")]]} />
        {tb === "g" && <Groups />}{tb === "c" && <CardSet />}{tb === "q" && <QEditor pin={S.superPin!} />}{tb === "tc" && <TaxCalEditor />}{tb === "nw" && <NewsEditor />}
        <button className="btn ghost" onClick={() => { S.superPin = ""; persist(); tab("profile"); }}><LogOut size={18} />{t("Superadmin rejimidan chiqish")}</button>
      </div>
    </div>);
}
