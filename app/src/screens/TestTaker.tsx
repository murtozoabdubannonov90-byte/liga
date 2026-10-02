import { useEffect, useState } from "react";
import { ClipboardCheck, Clock3, ListChecks, ShieldAlert } from "lucide-react";
import { S } from "../engine/state";
import { t, setLang, getLang } from "../lib/i18n";
import { rpc, errMsg } from "../engine/server";
import { startTest, type Run } from "../engine/run";
import { Empty } from "../components/ui";
import { Mark } from "./Onboard";
import Quiz from "./Quiz";

/* ?t=KOD — xodim tanlash testi: ro'yxatdan o'tmasdan */
export default function TestTaker({ code }: { code: string }) {
  const [info, setInfo] = useState<any>(undefined), [name, setName] = useState(""), [phone, setPhone] = useState(""), [err, setErr] = useState(""), [run, setRun] = useState<Run | null>(null);
  useEffect(() => { rpc<any[]>("liga_test_open", { p_code: code }).then((r) => { const x = r && r[0]; if (x && !S.lang) { setLang(x.lang === "ru" ? "ru" : "uz"); S.lang = getLang(); } setInfo(x || null); }).catch(() => setInfo(null)); }, [code]);
  const start = async () => {
    let p = phone.replace(/[^\d+]/g, ""); if (/^\d{9}$/.test(p)) p = "+998" + p; if (/^998\d{9}$/.test(p)) p = "+" + p;
    if (name.trim().length < 3) return setErr(t("Ism va familiyani kiriting"));
    if (!/^\+998\d{9}$/.test(p)) return setErr(t("Telefon raqam: +998 XX XXX XX XX"));
    try { const r = (await rpc<any[]>("liga_test_start", { p_code: code, p_name: name.trim(), p_phone: p }))[0];
      const run = startTest(code, r.run_id, info.n, info.minutes); run.startedAt = new Date(r.started_at).getTime(); setRun(run); }
    catch (e) { setErr(errMsg(e)); }
  };
  if (run) return <Quiz run={run} />;
  if (info === undefined) return <div className="shell bare"><Empty>{t("Yuklanmoqda...")}</Empty></div>;
  if (!info || !info.active) return <div className="shell bare"><div style={{ padding: "30px 0" }}><Mark /></div><Empty>{t("Test topilmadi yoki yopilgan.")}</Empty></div>;
  return (
    <div className="shell bare">
      <div style={{ display: "grid", gap: 12, padding: "24px 0 16px" }}><Mark size={56} />
        <h1 className="disp" style={{ fontSize: 24, lineHeight: 1.15 }}>{info.title}</h1><p className="muted" style={{ fontWeight: 700 }}>{info.company}</p></div>
      <div className="stack">
        <div className="tiles">
          <div className="tile"><span className="ic"><ListChecks size={20} /></span><b>{t("{n} ta savol", { n: info.n })}</b><i>{t("provodka, hisob, test")}</i></div>
          <div className="tile"><span className="ic"><Clock3 size={20} /></span><b>{t("{m} daqiqa", { m: info.minutes })}</b><i>{t("har savolga 1 daqiqa")}</i></div>
        </div>
        <div className="note"><ShieldAlert size={18} /><span>{t("Test bir marta ishlanadi. Savol paytida ilovadan chiqsangiz, savol xato hisoblanadi. Natija kompaniyaga yuboriladi.")}</span></div>
        <div className="field"><label htmlFor="cn">{t("Ism va familiya")}</label><input id="cn" className="inp" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="cp">{t("Telefon raqam")}</label><input id="cp" className="inp" type="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <p className="err">{err}</p>
      </div>
      <div className="dock"><button className="btn" id="go" onClick={start}><ClipboardCheck size={18} />{t("Testni boshlash")}</button></div>
    </div>);
}
