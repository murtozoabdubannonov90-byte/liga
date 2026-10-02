import { useEffect, useState } from "react";
import { Send, Download, Copy, Gift } from "lucide-react";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { toast } from "../lib/nav";
import { PageTitle, Card, copyText } from "../components/ui";
import { C } from "../engine/run";
import { TIERS, rankOf } from "../engine/score";
import { fmt } from "../engine/data";
import { BOT_LINK, canShareMessage, shareMessage, openTg } from "../lib/tg";
import { botApp, errMsg } from "../engine/server";
import { sfx } from "../lib/fx";

export const refLink = () => BOT_LINK + "?start=r_" + (S.me?.ref_code || "");
const TIER_HEX = ["#B87333", "#8E9AAB", "#D9A21B", "#2BB3D9"];

/* 1080×1350 natija kartochkasi */
async function draw(kind: "week" | "stage", si?: number, stars = 0): Promise<string> {
  await (document as any).fonts?.ready;
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#0F2A24"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(234,244,239,.06)"; g.lineWidth = 2; for (let y = 64; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = "#2446D8"; g.beginPath(); (g as any).roundRect(80, 80, 96, 96, 28); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(100, 113); g.lineTo(156, 113); g.moveTo(128, 113); g.lineTo(128, 156); g.stroke();
  g.fillStyle = "#EAF4EF"; g.font = "700 40px 'Unbounded Variable', sans-serif"; g.fillText("Hisobchi Liga", 200, 142);
  g.fillStyle = "#A9C4BA"; g.font = "600 34px 'Manrope Variable', sans-serif";
  const name = (S.user.first + " " + (S.user.last || "").slice(0, 1) + ".").trim();
  g.fillText(name + (S.group?.name ? " · " + S.group.name : ""), 80, 300);
  g.fillStyle = "#EAF4EF"; g.font = "800 220px 'Unbounded Variable', sans-serif";
  let big = "", sub = "";
  if (kind === "week") { big = fmt(S.week.my || S.lastWeekXp || 0); sub = t("XP bu hafta"); }
  else { big = (si! + 1) + ""; sub = t("bosqich") + " · " + (S.week.stages[si!] || 0) + " XP"; }
  g.fillText(big, 72, 560);
  g.fillStyle = "#F2B32A"; g.font = "700 52px 'Unbounded Variable', sans-serif"; g.fillText(sub, 80, 650);
  if (kind === "stage") { g.font = "120px sans-serif"; for (let k = 0; k < 3; k++) { g.fillStyle = k < stars ? "#F2B32A" : "rgba(234,244,239,.18)"; star(g, 140 + k * 150, 790, 60); } g.font = "600 40px 'Manrope Variable', sans-serif"; g.fillStyle = "#EAF4EF"; g.fillText(C().STAGES[si!].title, 80, 930); }
  else {
    const tier = S.tier || 0; g.fillStyle = TIER_HEX[tier]; shield(g, 80, 720, 120);
    g.fillStyle = "#EAF4EF"; g.font = "700 52px 'Unbounded Variable', sans-serif"; g.fillText(t("{t} liga", { t: t(TIERS[tier]) }), 230, 790);
    g.fillStyle = "#A9C4BA"; g.font = "600 38px 'Manrope Variable', sans-serif"; g.fillText(t(rankOf(S.xp).cur[1]) + " · " + fmt(S.xp) + " XP", 230, 845);
  }
  g.strokeStyle = "rgba(234,244,239,.25)"; g.setLineDash([16, 14]); g.lineWidth = 3; g.beginPath(); g.moveTo(60, 1080); g.lineTo(W - 60, 1080); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#EAF4EF"; g.font = "700 40px 'Manrope Variable', sans-serif"; g.fillText(t("Buxgalterlar uchun haftalik liga"), 80, 1160);
  g.fillStyle = "#F2B32A"; g.font = "600 36px 'JetBrains Mono', monospace"; g.fillText("@Buxgalterlar_Ligasi_bot", 80, 1230);
  if (S.me?.ref_code) { g.fillStyle = "#A9C4BA"; g.font = "600 32px 'Manrope Variable', sans-serif"; g.fillText(t("Taklif kodi") + ": " + S.me.ref_code, 80, 1285); }
  return cv.toDataURL("image/jpeg", 0.9);
}
function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); }
function shield(g: CanvasRenderingContext2D, x: number, y: number, s: number) { g.beginPath(); g.moveTo(x + s / 2, y); g.lineTo(x + s, y + s * 0.15); g.lineTo(x + s, y + s * 0.5); g.quadraticCurveTo(x + s, y + s * 0.85, x + s / 2, y + s); g.quadraticCurveTo(x, y + s * 0.85, x, y + s * 0.5); g.lineTo(x, y + s * 0.15); g.closePath(); g.fill(); }

export default function Share({ kind = "week", si, stars = 0 }: { kind?: "week" | "stage"; si?: number; stars?: number }) {
  const [img, setImg] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { draw(kind, si, stars).then(setImg); }, []);
  const send = async () => {
    setBusy(true);
    try {
      if (canShareMessage()) { const r = await botApp("card", { image: img, kind }); if (r.id) { const ok = await shareMessage(r.id); if (ok) { sfx("coin"); toast(t("Yuborildi")); } return; } }
      const blob = await (await fetch(img)).blob(), file = new File([blob], "hisobchi-liga.jpg", { type: "image/jpeg" });
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) { await (navigator as any).share({ files: [file], text: t("Hisobchi Liga natijam") + " " + refLink() }); return; }
      openTg("https://t.me/share/url?url=" + encodeURIComponent(refLink()) + "&text=" + encodeURIComponent(t("Hisobchi Liga natijam") + ": " + (kind === "week" ? S.week.my + " XP" : "")));
    } catch (e) { toast(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="shell bare">
      <PageTitle title={t("Natijani ulashish")} />
      <div className="stack">
        {img ? <img src={img} alt={t("Natija kartochkasi")} style={{ width: "100%", borderRadius: 18, boxShadow: "var(--lift)" }} /> : <div className="card" style={{ aspectRatio: "4/5" }} />}
        <Card title={t("Taklif qiling — +7 kun bepul")} right={<Gift size={20} color="var(--gold)" />}>
          <p className="small" style={{ fontWeight: 600 }}>{t("Do'stingiz havolangiz orqali qo'shilib, birinchi to'lovni qilsa, sizga obunaga 7 kun qo'shiladi.")}</p>
          <div className="row flat" style={{ marginTop: 10 }}><span className="mono grow" style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refLink()}</span>
            <button className="btn sm ghost" onClick={() => copyText(refLink(), () => toast(t("Nusxa olindi")))}><Copy size={16} /></button></div>
          {S.me?.refs ? <p className="small muted" style={{ marginTop: 8 }}>{t("Siz taklif qilganlar: {n}", { n: S.me.refs })}</p> : null}
        </Card>
      </div>
      <div className="dock"><div className="btn-row">
        <a className="btn ghost" href={img} download="hisobchi-liga.jpg" style={{ textDecoration: "none" }}><Download size={18} />{t("Saqlash")}</a>
        <button className="btn" id="send" disabled={!img || busy} onClick={send}><Send size={18} />{t("Ulashish")}</button></div></div>
    </div>
  );
}
