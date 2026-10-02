import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Award, Printer, ShieldCheck, ShieldX } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { toast } from "../lib/nav";
import { PageTitle, Card, Empty } from "../components/ui";
import { rpc, errMsg } from "../engine/server";
import { APP_LINK } from "../lib/tg";
import { fmtD } from "../engine/time";
import { Mark } from "./Onboard";
import { burst } from "../lib/fx";

export const verifyUrl = (id: string) => APP_LINK + "?v=" + id;
function certText(c: any) {
  if (c.kind === "week") { const [pos, xp, w] = String(c.detail || "").split("|"); return { head: t("Haftalik liga — {n}-o'rin", { n: pos }), body: t("{xp} XP · hafta yakuni {d}", { xp, d: fmtD((w || "").slice(0, 10)) }) }; }
  return { head: t("12 bosqichning barchasi yakunlandi"), body: t("Provodka, QQS, ish haqi, asosiy vositalar, soliqlar, hisobotlar va qonunchilik") };
}
function CertPaper({ c, name, team }: { c: any; name: string; team?: string }) {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(verifyUrl(c.id), { margin: 1, width: 240, color: { dark: "#0F2A24", light: "#ffffff" } }).then(setQr); }, [c.id]);
  const x = certText(c);
  return (
    <div className="certbox">
      <div style={{ display: "grid", placeItems: "center", gap: 8 }}><Mark size={52} /><span className="small muted" style={{ fontWeight: 800 }}>Hisobchi Liga</span></div>
      <h2 style={{ marginTop: 10 }}>{t("Sertifikat")}</h2>
      <div className="nm">{name}</div>
      <p style={{ fontWeight: 800 }}>{x.head}</p>
      <p className="small muted" style={{ marginTop: 4 }}>{x.body}</p>
      {team && <p className="small muted">{team}</p>}
      {qr && <img className="qr" src={qr} alt={t("Tekshirish QR kodi")} />}
      <p className="tiny muted mono" style={{ marginTop: 6 }}>№ {c.id} · {fmtD(String(c.issued_at).slice(0, 10))}</p>
      <p className="tiny muted">{t("QR kodni skanerlab haqiqiyligini tekshiring")}</p>
    </div>
  );
}
export function CertView() {
  const [sel, setSel] = useState<any>(null);
  const certs = S.certs || [];
  const medal = (S.champs || []).filter((x: any) => x.is_me).sort((a: any, b: any) => (a.week_id < b.week_id ? 1 : -1))[0];
  const issue = async (kind: "week" | "all12") => {
    try { const r = (await rpc<any[]>("liga_cert_issue", { p_id: S.pid, p_token: S.token, p_kind: kind }))[0];
      S.certs = [r, ...certs.filter((x: any) => x.id !== r.id)]; persist(); setSel(r); burst(); }
    catch (e) { toast(errMsg(e)); }
  };
  if (sel) return (
    <div className="shell bare"><PageTitle title={t("Sertifikat")} onBack={() => setSel(null)} />
      <CertPaper c={sel} name={S.user.first + " " + S.user.last} team={S.group?.name} />
      <div className="dock noprint"><button className="btn" onClick={() => window.print()}><Printer size={18} />{t("PDF saqlash / chop etish")}</button></div></div>);
  return (
    <div className="shell bare">
      <PageTitle title={t("Sertifikatlar")} />
      <div className="stack">
        {(medal || Object.keys(S.stars).length >= 12) && <Card title={t("Olish mumkin")}>
          <div className="stack" style={{ gap: 8 }}>
            {medal && <button className="btn gold" onClick={() => issue("week")}><Award size={18} />{t("Haftalik g'olib sertifikati")}</button>}
            {Object.keys(S.stars).length >= 12 && <button className="btn" onClick={() => issue("all12")}><Award size={18} />{t("12 bosqich sertifikati")}</button>}
          </div></Card>}
        <Card title={t("Mening sertifikatlarim")}>
          {certs.length ? <div className="board">{certs.map((c: any) => (
            <button key={c.id} className="r" style={{ textAlign: "left" }} onClick={() => setSel(c)}><span className="p"><Award size={18} color="var(--gold)" /></span>
              <span className="n">{certText(c).head}<small className="mono">№ {c.id}</small></span><span className="x tiny">{fmtD(String(c.issued_at).slice(0, 10))}</span></button>))}</div>
            : <Empty>{t("Kuchli uchlikka kiring yoki 12 bosqichni yakunlang — QR kodli sertifikat olasiz.")}</Empty>}
        </Card>
      </div>
    </div>
  );
}
/* ?v=ID — sertifikat haqiqiyligini tekshirish (ro'yxatdan o'tish shart emas) */
export function Verify({ id }: { id: string }) {
  const [c, setC] = useState<any>(undefined);
  useEffect(() => { rpc<any[]>("liga_cert_verify", { p_id: id }).then((r) => setC((r && r[0]) || null)).catch(() => setC(null)); }, [id]);
  return (
    <div className="shell bare">
      <div style={{ padding: "22px 0 14px", display: "grid", gap: 10 }}><Mark size={48} /><h1 className="disp" style={{ fontSize: 24 }}>{t("Sertifikatni tekshirish")}</h1></div>
      {c === undefined ? <Empty>{t("Tekshirilmoqda...")}</Empty> : c ? <div className="stack">
        <div className="note" style={{ background: "var(--green-soft)" }}><ShieldCheck size={20} color="var(--green)" /><b>{t("Sertifikat haqiqiy")}</b></div>
        <CertPaper c={c} name={c.name} team={c.team} /></div>
        : <div className="note" style={{ background: "var(--red-soft)" }}><ShieldX size={20} color="var(--red)" /><b>{t("Bunday sertifikat topilmadi")}</b></div>}
    </div>
  );
}
