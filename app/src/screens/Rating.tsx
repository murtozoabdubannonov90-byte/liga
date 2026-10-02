import { useState } from "react";
import { Trophy, Lock, ChevronRight, Award } from "lucide-react";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { go } from "../lib/nav";
import { Card, Seg, TierBadge, TierChip, Empty } from "../components/ui";
import { TIERS } from "../engine/score";
import { fmtD } from "../engine/time";
import { TopBar } from "./Home";
import { FinalCard } from "./FinalLive";
import { MatchCard } from "./Tools";
import { DayTopCard } from "./Perks";

const medal = (k: number) => (k === 0 ? "1" : k === 1 ? "2" : k === 2 ? "3" : String(k + 1));
function WeekTab() {
  const L = S.lastRes, M = S.members || [];
  return (
    <div className="stack">
      <DayTopCard />
      <MatchCard />
      <Card title={t("O'tgan hafta natijalari")} right={L ? <span className="chip">{t("juma 12:00")}</span> : undefined}>
        {L && L.rows.length ? <div className="board">{L.rows.map((x: any, k: number) => (
          <div key={k} className={"r" + (k < 3 ? " top" + (k + 1) : "") + (x.me ? " me" : "")}><span className="p">{medal(k)}</span>
            <span className="n">{x.n}</span><span className="x">{x.x}</span></div>))}</div>
          : <Empty>{t("Birinchi jadval juma soat 12:00 da ochiladi.")}</Empty>}
      </Card>
      <Card title={t("Jamoa a'zolari")} right={<span className="chip">{M.length}</span>}>
        {M.length ? <div className="board">{M.map((x, k) => (
          <div key={k} className={"r" + (x.me ? " me" : "")}><span className="p"><TierBadge tier={x.tier || 0} size={22} /></span>
            <span className="n">{x.n}{x.m ? <small>{t("O'tgan hafta {n}-o'rin", { n: x.m })}</small> : null}</span>
            <span className="x">{x.me ? S.week.my : <Lock size={15} color="var(--muted)" />}</span></div>))}</div>
          : <Empty>{t("Hali a'zolar yo'q")}</Empty>}
        <p className="small muted" style={{ marginTop: 8, fontWeight: 600 }}>{t("Hafta davomida faqat o'z natijangizni ko'rasiz.")}</p>
      </Card>
    </div>
  );
}
function TiersTab() {
  const my = S.tier || 0;
  return (
    <div className="stack">
      <Card title={t("Liga darajalari")}>
        <div className="stack" style={{ gap: 8 }}>
          {[3, 2, 1, 0].map((k) => (
            <div key={k} className="row flat" style={{ border: k === my ? "2px solid var(--stamp)" : "2px solid transparent" }}>
              <TierBadge tier={k} size={34} /><div className="grow"><b>{t("{t} liga", { t: t(TIERS[k]) })}</b>{k === my && <div className="small" style={{ color: "var(--stamp)", fontWeight: 800 }}>{t("Siz shu yerdasiz")}</div>}</div>
            </div>))}
        </div>
      </Card>
      <Card title={t("Qanday ko'tariladi")}>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontWeight: 600 }}>
          <li>{t("Haftada jamoangiz kuchli uchligiga kirsangiz yoki 1600 XP to'plasangiz — bir daraja yuqoriga.")}</li>
          <li>{t("Haftada 400 XP dan kam to'plasangiz — bir daraja pastga.")}</li>
          <li>{t("Darajalar har juma 12:10 da yangilanadi.")}</li>
        </ul>
      </Card>
    </div>
  );
}
function RegionTab() {
  const L = S.regL || [], mine = L.find((x: any) => x.is_mine), reg = mine ? mine.region : S.user.region || "";
  const rows = L.filter((x: any) => x.region === reg), others = [...new Set(L.map((x: any) => x.region))].filter((r) => r !== reg) as string[];
  return (
    <div className="stack">
      <Card title={t("Viloyat ligasi")} right={reg ? <span className="chip">{t(reg)}</span> : undefined}>
        <p className="small muted" style={{ fontWeight: 600, marginBottom: 8 }}>{t("Har jamoaning eng yaxshi 3 nafari bali qo'shiladi · o'tgan hafta")}</p>
        {rows.length ? <div className="board">{rows.map((x: any, k: number) => (
          <div key={k} className={"r" + (x.rnk <= 3 ? " top" + x.rnk : "") + (x.is_mine ? " me" : "")}><span className="p">{x.rnk}</span>
            <span className="n">{x.name}<small>{x.top3}</small></span><span className="x">{x.team_xp}</span></div>))}</div>
          : <Empty>{t("Jadval juma 12:00 da shakllanadi.")}</Empty>}
      </Card>
      {others.length > 0 && <Card title={t("Boshqa viloyatlar")}>
        <div className="board">{others.map((r) => { const top = L.find((x: any) => x.region === r && x.rnk === 1); return (
          <div key={r} className="r"><span className="p"><Award size={18} /></span><span className="n">{t(r)}<small>{top?.name}</small></span><span className="x">{top?.team_xp}</span></div>); })}</div>
      </Card>}
    </div>
  );
}
function ChampsTab() {
  const C = S.champs || []; const weeks = [...new Set(C.map((x: any) => x.week_id))].slice(0, 10) as string[];
  return (
    <Card title={t("Chempionlar zali")}>
      {weeks.length ? <div className="stack" style={{ gap: 10 }}>{weeks.map((w) => (
        <div key={w} className="flat"><div className="small muted" style={{ fontWeight: 800 }}>{fmtD(w.slice(0, 10))}</div>
          {C.filter((x: any) => x.week_id === w).map((x: any) => (
            <div key={x.pos} className="row" style={{ marginTop: 4, fontWeight: 800 }}><span className="disp" style={{ width: 18, color: ["", "var(--goldt)", "var(--silver)", "var(--bronze)"][x.pos] }}>{x.pos}</span>
              <span className="grow" style={{ color: x.is_me ? "var(--stamp)" : undefined }}>{x.name}</span><span className="num">{x.week_xp}</span></div>))}
        </div>))}</div> : <Empty>{t("Birinchi chempion juma soat 12:00 da aniqlanadi.")}</Empty>}
    </Card>
  );
}
export default function Rating() {
  const [tb, setTb] = useState<"week" | "final" | "region" | "tiers" | "champ">("week");
  return (
    <div className="shell">
      <TopBar />
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}><TierChip tier={S.tier || 0} />
          <button className="chip blue" onClick={() => go("share", { kind: "week" })}><Trophy size={13} />{t("Natijani ulashish")}<ChevronRight size={13} /></button></div>
        <Seg id="rate" value={tb} onChange={setTb} items={[["week", t("Hafta")], ["final", t("Final")], ["region", t("Viloyat")], ["tiers", t("Daraja")], ["champ", t("Zal")]]} />
        {tb === "week" && <WeekTab />}{tb === "final" && <FinalCard />}{tb === "region" && <RegionTab />}{tb === "tiers" && <TiersTab />}{tb === "champ" && <ChampsTab />}
      </div>
    </div>
  );
}
