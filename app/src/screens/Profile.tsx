import { Award, ChevronRight, CreditCard, Globe2, Moon, ShieldCheck, Volume2, Users, Settings as SetI, Medal, Maximize, Smartphone, RotateCcw, Swords, Lock } from "lucide-react";
import { S, persist, resetAll } from "../engine/state";
import { t, LANGS, setLang, type Lang } from "../lib/i18n";
import { go, toast, refresh } from "../lib/nav";
import { Card, PageTitle, TierChip, Seg } from "../components/ui";
import { rankOf, ACH, accStats } from "../engine/score";
import { fmtD } from "../engine/time";
import { C } from "../engine/run";
import { setLangServer } from "../engine/server";
import { applyTheme } from "../boot";
import { setSound, sfx } from "../lib/fx";
import { canFullscreen, toggleFullscreen, canHomeScreen, addToHomeScreen } from "../lib/tg";
import { TopBar } from "./Home";
import { useState } from "react";

function Row({ icon: Ic, title, sub, onClick }: { icon: any; title: string; sub?: string; onClick: () => void }) {
  return <button className="row" style={{ width: "100%", textAlign: "left", padding: "12px 2px", borderBottom: "1px solid var(--rule)" }} onClick={onClick}>
    <Ic size={20} /><span className="grow"><b style={{ fontSize: 15 }}>{title}</b>{sub && <><br /><span className="small muted">{sub}</span></>}</span><ChevronRight size={18} color="var(--muted)" /></button>;
}
export default function Profile() {
  const rk = rankOf(S.xp), pct = rk.next ? Math.max(3, Math.round(((S.xp - rk.cur[0]) / (rk.next[0] - rk.cur[0])) * 100)) : 100;
  const ac = accStats(), me = S.me || {};
  const per: Record<number, { ok: number; n: number }> = {};
  Object.keys(S.sa || {}).forEach((k) => { const si = +k.split("|")[1]; Object.values(S.sa[k].m || {}).forEach((v) => { per[si] = per[si] || { ok: 0, n: 0 }; per[si].n++; if (v === "ok") per[si].ok++; }); });
  const weak = Object.keys(per).map(Number).filter((si) => per[si].n >= 5).sort((a, b) => per[a].ok / per[a].n - per[b].ok / per[b].n)[0];
  return (
    <div className="shell">
      <TopBar />
      <div className="stack">
        <section className="card">
          <div className="row"><div className="grow"><h3 style={{ fontSize: 20 }}>{S.user.first} {S.user.last}</h3>
            <p className="small muted" style={{ fontWeight: 600 }}>{S.user.phone} · {t(S.user.region || "")} <button className="chip blue" style={{ marginLeft: 4 }} onClick={() => go("region")}>{t("o'zgartirish")}</button></p></div></div>
          <div className="row" style={{ marginTop: 12 }}><TierChip tier={S.tier || 0} /><span className="grow" /><b className="small">{t(rk.cur[1])}</b></div>
          <div className="meter" style={{ marginTop: 10 }}><i style={{ width: pct + "%", background: "var(--stamp)" }} /></div>
          <p className="small muted" style={{ marginTop: 6, fontWeight: 600 }}>{rk.next ? t("«{r}» uchun yana {n} XP", { r: t(rk.next[1]), n: rk.next[0] - S.xp }) : t("Eng yuqori daraja!")}</p>
        </section>
        <div className="stat3">
          <div><b className="num">{ac.n ? Math.round((ac.ok / ac.n) * 100) + "%" : "—"}</b><i>{t("aniqlik")}</i></div>
          <div><b className="num">{S.streak}</b><i>{t("kunlik seriya")}</i></div>
          <div><b className="num">{Object.keys(S.stars).length}/12</b><i>{t("bosqich")}</i></div>
        </div>
        {weak != null && per[weak].ok < per[weak].n && <div className="note"><Lock size={18} /><span>{t("Zaif mavzu: «{s}». Xato daftarida mashq qiling.", { s: C().STAGES[weak].title })}</span></div>}
        {me.personal && <Card title={t("Obuna")} right={<CreditCard size={20} />}>
          <p className="small" style={{ fontWeight: 700 }}>{me.ok ? t("✅ {d} gacha faol", { d: fmtD(me.paid_until) }) + (me.pending ? " · " + t("chek tekshirilmoqda") : "") : t("⛔ To'lanmagan — bosqichlar yopiq")}</p>
          <button className={"btn sm " + (me.ok ? "ghost" : "")} style={{ marginTop: 10 }} onClick={() => go("pay")}>{me.ok ? t("Uzaytirish") : t("To'lov qilish")}</button></Card>}
        <section className="card" style={{ padding: "4px 16px" }}>
          <Row icon={Award} title={t("Sertifikatlar")} sub={t("QR kod bilan tekshiriladi")} onClick={() => go("cert")} />
          <Row icon={Medal} title={t("Yutuqlar")} sub={t("{n} / {m}", { n: S.ach.length, m: ACH.length })} onClick={() => go("ach")} />
          <Row icon={Swords} title={t("Duellar")} onClick={() => go("duel")} />
          <Row icon={Users} title={t("Jamoa")} sub={(S.group?.name || t("Buxgalterlar ligasi")) + " · " + (S.group?.code || "ASOSIY") + " · " + t("{n} ishtirokchi", { n: S.pcount || 1 })} onClick={() => go("share", { kind: "week" })} />
          <Row icon={SetI} title={t("Sozlamalar")} sub={t("Til, mavzu, ovoz")} onClick={() => go("settings")} />
          <Row icon={ShieldCheck} title={S.superPin ? t("Superadmin") : S.adminPin ? t("Admin panel") : t("Admin kirish")} onClick={() => go(S.superPin ? "super" : S.adminPin ? "admin" : "adminLogin")} />
        </section>
      </div>
    </div>
  );
}
export function Achievements() {
  return (
    <div className="shell bare"><PageTitle title={t("Yutuqlar")} />
      <div className="tiles">{ACH.map((a) => { const on = S.ach.includes(a.id); return (
        <div key={a.id} className="tile" style={{ opacity: on ? 1 : 0.5 }}><span className="ic" style={{ background: on ? "var(--gold-soft)" : undefined }}><Medal size={20} color={on ? "#9A6500" : "var(--muted)"} /></span><b>{t(a.n)}</b><i>{t(a.d)}</i></div>); })}</div>
    </div>);
}
export function Settings() {
  const [, setV] = useState(0); const re = () => { setV((x) => x + 1); refresh(); };
  const lang = (S.lang || "uz") as Lang;
  return (
    <div className="shell bare"><PageTitle title={t("Sozlamalar")} />
      <div className="stack">
        <Card title={t("Til")} right={<Globe2 size={20} />}>
          <Seg id="lang" value={lang} onChange={(l) => { S.lang = l; setLang(l); persist(); setLangServer(); sfx("tap"); re(); }} items={LANGS.map((l) => [l.id, l.name] as [Lang, string])} />
        </Card>
        <Card title={t("Ko'rinish")} right={<Moon size={20} />}>
          <Seg id="theme" value={S.theme || "auto"} onChange={(v) => { S.theme = v; persist(); applyTheme(); re(); }} items={[["auto", t("Avto")], ["light", t("Yorug'")], ["dark", t("Tungi")]]} />
        </Card>
        <Card title={t("Ovoz va tebranish")} right={<Volume2 size={20} />}>
          <Seg id="snd" value={S.sound === false ? "off" : "on"} onChange={(v) => { S.sound = v === "on"; setSound(S.sound); persist(); re(); }} items={[["on", t("Yoqilgan")], ["off", t("O'chirilgan")]]} />
        </Card>
        {(canFullscreen() || canHomeScreen()) && <section className="card" style={{ padding: "4px 16px" }}>
          {canFullscreen() && <Row icon={Maximize} title={t("Butun ekran")} onClick={toggleFullscreen} />}
          {canHomeScreen() && <Row icon={Smartphone} title={t("Telefon ekraniga qo'shish")} onClick={addToHomeScreen} />}
        </section>}
        <button className="btn ghost" onClick={() => { if (confirm(t("Barcha natijalar shu telefondan o'chiriladi. Davom etasizmi?"))) { resetAll(); toast(t("Tozalandi")); location.reload(); } }}><RotateCcw size={18} />{t("Shu telefondagi ma'lumotni tozalash")}</button>
        <p className="tiny muted" style={{ textAlign: "center" }}>Hisobchi Liga 2.0</p>
      </div>
    </div>);
}
