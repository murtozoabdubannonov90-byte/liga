/* «Faktura detektivi» (2026-11-02): har kuni 5 ta hujjat — hisob-faktura, kassa orderi, ish haqi varaqasi, ishonchnoma.
   Har birida 0–3 ta xato qator; o'yinchi ularni belgilaydi. Hujjatlar va javob kalitlari serverda (liga_doc_*),
   natija faqat o'yinchiga ko'rinadi va liga jamiga qo'shilmaydi. */
import { useEffect, useState } from "react";
import { SearchCheck, ChevronRight, FileText, Clock3, ShieldCheck, FlaskConical } from "lucide-react";
import { S, useStore } from "../engine/state";
import { t } from "../lib/i18n";
import { go, toast } from "../lib/nav";
import { PageTitle } from "../components/ui";
import { startDocR, pullExtras } from "../engine/remote";
import { sfx } from "../lib/fx";

export interface DocMe { on?: boolean; owner?: boolean; today?: { n: number; done_n: number; right_n: number; finished: boolean } | null; week_right?: number; week_days?: number; total_right?: number; total_n?: number; days?: number }
const me = (): DocMe => S.docMe || {};

async function openDoc() {
  const r = await startDocR();
  if (typeof r === "string") { toast(t(r)); pullExtras(); return; }
  sfx("tap"); go("quiz", { run: r });
}
export function docStatus(): { line: string; done: boolean; started: boolean } {
  const d = me().today;
  if (!d) return { line: t("Bugun: 5 ta yangi hujjat"), done: false, started: false };
  if (d.finished) return { line: t("✅ Bugun {r}/{n} to'g'ri · ertaga yangi hujjatlar", { r: d.right_n, n: d.n }), done: true, started: true };
  return { line: t("{d}/{n} hujjat tekshirildi — davom eting", { d: d.done_n, n: d.n }), done: false, started: true };
}

/* Asosiy oynadagi karta */
export function DocCard() {
  useStore();
  if (!S.pid || me().on === false) return null;
  const st = docStatus();
  return (
    <button className="card row" id="doc-card" style={{ textAlign: "left", borderColor: st.done ? "var(--rule)" : "var(--stamp)" }} onClick={() => go("detective")}>
      <span className="ic" style={{ background: "var(--stamp-soft)", color: "var(--stamp)", borderRadius: 12, padding: 8, display: "grid" }}><SearchCheck size={22} /></span>
      <span className="grow"><b>{t("Faktura detektivi")}</b> <span className="chip blue" style={{ marginLeft: 4 }}>{t("Yangi")}</span><br />
        <span className="small muted" style={{ fontWeight: 700 }}>{st.line}</span></span>
      <ChevronRight size={18} color="var(--muted)" />
    </button>);
}

/* Faqat liga egasiga: simulyator sinovi */
export function SimCard() {
  useStore();
  if (!me().owner) return null;
  return (
    <button className="card row" id="sim-card" style={{ textAlign: "left", borderStyle: "dashed" }} onClick={() => go("sim")}>
      <span className="ic"><FlaskConical size={22} /></span>
      <span className="grow"><b>{t("Simulyator: firmani 1 hafta yurit")}</b><br />
        <span className="small muted" style={{ fontWeight: 700 }}>{t("Sinov — faqat sizga ko'rinadi")}</span></span>
      <ChevronRight size={18} color="var(--muted)" />
    </button>);
}

export default function Detective() {
  useStore();
  const [busy, setBusy] = useState(false);
  useEffect(() => { pullExtras(); }, []);
  const m = me(), st = docStatus();
  const start = async () => { if (busy) return; setBusy(true); try { await openDoc(); } finally { setBusy(false); } };
  return (
    <div className="shell bare">
      <PageTitle title={t("Faktura detektivi")} />
      <div className="stack">
        <section className="card">
          <p style={{ fontWeight: 600, lineHeight: 1.5 }}>{t("Har kuni 5 ta yangi hujjat: hisob-faktura, kassa kirim orderi, ish haqi varaqasi, ishonchnoma. Har birida 0 tadan 3 tagacha xato bor — hisob-kitob, rekvizit, stavka, sana yoki imzo. Xato qatorlarni toping.")}</p>
          <div className="det-stats" id="det-stats">
            <div><b className="num">{m.today ? `${m.today.right_n}/${m.today.n}` : "0/5"}</b><i>{t("bugun")}</i></div>
            <div><b className="num">{m.week_right || 0}</b><i>{t("bu hafta to'g'ri")}</i></div>
            <div><b className="num">{m.total_right || 0}</b><i>{t("jami to'g'ri")}</i></div>
          </div>
          <ul className="small" style={{ paddingLeft: 18, display: "grid", gap: 6, fontWeight: 600 }}>
            <li><FileText size={13} style={{ verticalAlign: -2 }} /> {t("Hujjatlar osondan qiyinga: 1 ta oson, 2 ta o'rta, 2 ta qiyin.")}</li>
            <li><Clock3 size={13} style={{ verticalAlign: -2 }} /> {t("Har hujjatga 2,5 daqiqa. Chiqib ketsangiz — keyin davom ettirasiz.")}</li>
            <li><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> {t("Javob serverda tekshiriladi; har xatoning tushuntirishi ko'rsatiladi.")}</li>
          </ul>
          <p className="tiny muted" style={{ marginTop: 10, fontWeight: 700 }}>{t("Natija faqat sizga ko'rinadi va liga jamiga qo'shilmaydi.")}</p>
        </section>
      </div>
      <div className="dock">
        <button className="btn" id="doc-go" disabled={st.done || busy} onClick={start}>
          {st.done ? t("Bugungi hujjatlar tekshirildi — ertaga yangilari") : st.started ? t("Davom etish") : t("Tekshirishni boshlash")}
        </button>
      </div>
    </div>);
}
