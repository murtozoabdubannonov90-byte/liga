/* «Firmani 1 hafta yurit» simulyatori — SINOV (2026-11-02), faqat liga egasiga ko'rinadi (liga_doc_me.owner).
   «Ipak Savdo» MChJ: boshlang'ich balans, 5 kun × 3 hujjat. O'yinchi har hujjatga provodka(lar)ni o'zi yozadi (Dt, Kt, summa);
   xato darhol aytilmaydi. Hafta oxirida o'yinchi provodkalaridan qoldiqlar, balans, 2-shakl va QQS tuziladi va to'g'risi bilan solishtiriladi.
   Hammasi telefonda (serverga yozilmaydi) — sinovdan o'tsa server versiyasi qilinadi. */
import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { S, persist, useStore } from "../engine/state";
import { t } from "../lib/i18n";
import { PageTitle, Empty } from "../components/ui";
import { C } from "../engine/run";
import { fmt } from "../engine/data";
import { sfx, burst } from "../lib/fx";

type E = { dt: string; kt: string; s: number };
interface SimDoc { day: number; title: string; text: string; sums: number[]; ok: E[] }
export const SIM_OPEN: Record<string, number> = { "5010": 2_000_000, "5110": 50_000_000, "2910": 20_000_000, "8330": -60_000_000, "8710": -12_000_000 };
export const SIM_DOCS: SimDoc[] = [
  { day: 1, title: "Hisob-faktura № 118 (kirim)", text: "«Farg'ona Metall» MChJdan tovar keldi: 30 000 000 so'm + QQS 12% 3 600 000 = 33 600 000 so'm. To'lov keyin.", sums: [30_000_000, 3_600_000, 33_600_000],
    ok: [{ dt: "2910", kt: "6010", s: 30_000_000 }, { dt: "4410", kt: "6010", s: 3_600_000 }] },
  { day: 1, title: "Bank ko'chirmasi", text: "«Farg'ona Metall» MChJga tovar uchun 33 600 000 so'm to'landi.", sums: [33_600_000], ok: [{ dt: "6010", kt: "5110", s: 33_600_000 }] },
  { day: 1, title: "Kassa kirim orderi № 41", text: "Bankdan kassaga naqd pul olindi: 5 000 000 so'm.", sums: [5_000_000], ok: [{ dt: "5010", kt: "5110", s: 5_000_000 }] },
  { day: 2, title: "Hisob-faktura № 57 (chiqim)", text: "«Mezon Ofis» MChJga tovar sotildi: 45 000 000 so'm + QQS 12% 5 400 000 = 50 400 000 so'm. Sotilgan tovar tannarxi — 25 000 000 so'm.", sums: [45_000_000, 5_400_000, 50_400_000, 25_000_000],
    ok: [{ dt: "4010", kt: "9020", s: 45_000_000 }, { dt: "4010", kt: "6410", s: 5_400_000 }, { dt: "9120", kt: "2910", s: 25_000_000 }] },
  { day: 2, title: "Bank ko'chirmasi", text: "«Mezon Ofis» MChJdan 50 400 000 so'm tushdi.", sums: [50_400_000], ok: [{ dt: "5110", kt: "4010", s: 50_400_000 }] },
  { day: 2, title: "Kassa chiqim orderi № 17", text: "Xodimga xizmat safari uchun avans berildi: 1 000 000 so'm.", sums: [1_000_000], ok: [{ dt: "4220", kt: "5010", s: 1_000_000 }] },
  { day: 3, title: "Ish haqi hisob-kitobi", text: "Ma'muriyat xodimlariga ish haqi hisoblandi: 10 000 000 so'm.", sums: [10_000_000], ok: [{ dt: "9420", kt: "6710", s: 10_000_000 }] },
  { day: 3, title: "Ish haqi hisob-kitobi", text: "Ish haqidan JShDS ushlandi (12%): 1 200 000 so'm.", sums: [1_200_000], ok: [{ dt: "6710", kt: "6410", s: 1_200_000 }] },
  { day: 3, title: "Ish haqi hisob-kitobi", text: "Ijtimoiy soliq hisoblandi (12%, ish beruvchi hisobidan): 1 200 000 so'm.", sums: [1_200_000], ok: [{ dt: "9420", kt: "6520", s: 1_200_000 }] },
  { day: 4, title: "Bank ko'chirmasi", text: "Ish haqi xodimlar kartasiga o'tkazildi: 8 800 000 so'm.", sums: [8_800_000], ok: [{ dt: "6710", kt: "5110", s: 8_800_000 }] },
  { day: 4, title: "Bank ko'chirmasi", text: "Budjetga to'landi: JShDS 1 200 000 so'm va ijtimoiy soliq 1 200 000 so'm (ikki to'lov).", sums: [1_200_000],
    ok: [{ dt: "6410", kt: "5110", s: 1_200_000 }, { dt: "6520", kt: "5110", s: 1_200_000 }] },
  { day: 4, title: "Avans hisoboti", text: "Xodim safar xarajatlari bo'yicha hisobot topshirdi: 800 000 so'm sarflandi, 200 000 so'm kassaga qaytarildi.", sums: [800_000, 200_000],
    ok: [{ dt: "9420", kt: "4220", s: 800_000 }, { dt: "5010", kt: "4220", s: 200_000 }] },
  { day: 5, title: "Hisob-faktura № 9 (ijara)", text: "Ofis ijarasi uchun faktura: 3 000 000 so'm + QQS 12% 360 000 = 3 360 000 so'm. To'lov keyingi oyda.", sums: [3_000_000, 360_000, 3_360_000],
    ok: [{ dt: "9420", kt: "6010", s: 3_000_000 }, { dt: "4410", kt: "6010", s: 360_000 }] },
  { day: 5, title: "Kassa chiqim orderi № 18", text: "Kassadagi naqd pul bankka topshirildi: 3 000 000 so'm.", sums: [3_000_000], ok: [{ dt: "5110", kt: "5010", s: 3_000_000 }] },
  { day: 5, title: "Buxgalteriya ma'lumotnomasi", text: "Hafta yakuni: kirim QQS (3 600 000 + 360 000) budjetga to'lanadigan QQS hisobiga o'tkazildi.", sums: [3_960_000], ok: [{ dt: "6410", kt: "4410", s: 3_960_000 }] },
];
const ASSET = (c: string) => /^[0-5]/.test(c);
export function balances(entries: E[][]): Record<string, number> {
  const b: Record<string, number> = { ...SIM_OPEN };
  for (const L of entries) for (const e of L || []) { if (!e.dt || !e.kt || !e.s) continue; b[e.dt] = (b[e.dt] || 0) + e.s; b[e.kt] = (b[e.kt] || 0) - e.s; }
  return b;
}
export function report(entries: E[][]) {
  const mine = balances(entries), ok = balances(SIM_DOCS.map((d) => d.ok));
  const codes = [...new Set([...Object.keys(mine), ...Object.keys(ok)])].filter((c) => (mine[c] || 0) !== 0 || (ok[c] || 0) !== 0).sort();
  const f2 = (b: Record<string, number>) => { const rev = -(b["9020"] || 0), cogs = b["9120"] || 0, adm = b["9420"] || 0; return { rev, cogs, gross: rev - cogs, adm, profit: rev - cogs - adm }; };
  const bal = (b: Record<string, number>) => { let a = 0, l = 0, eq = 0; for (const [c, v] of Object.entries(b)) { if (/^9/.test(c)) continue; if (ASSET(c)) a += v; else if (/^8/.test(c)) eq -= v; else l -= v; }
    const p = f2(b).profit; return { a, l, eq: eq + p }; };
  const vat = (b: Record<string, number>) => -(b["6410"] || 0);
  const key = (L: E[]) => L.filter((e) => e.dt && e.kt && e.s).map((e) => `${e.dt}-${e.kt}-${e.s}`).sort().join("|");
  const docs = SIM_DOCS.map((d, i) => ({ i, ok: key(entries[i] || []) === key(d.ok) }));
  return { codes, mine, ok, f2m: f2(mine), f2o: f2(ok), bm: bal(mine), bo: bal(ok), vm: vat(mine), vo: vat(ok), docs };
}

const blank = (): E => ({ dt: "", kt: "", s: 0 });
export default function Sim() {
  useStore();
  const c = C();
  const st = (S.sim = S.sim || { day: 1, entries: SIM_DOCS.map(() => [blank()]), done: false });
  const [, force] = useState(0);
  const save = () => { persist(); force((x) => x + 1); };
  const rep = useMemo(() => (st.done ? report(st.entries) : null), [st.done, st.entries]);
  if (!S.docMe?.owner) return <div className="shell bare"><PageTitle title={t("Simulyator")} /><Empty>{t("Bu sinov faqat liga egasiga ochiq.")}</Empty></div>;
  const reset = () => { S.sim = { day: 1, entries: SIM_DOCS.map(() => [blank()]), done: false }; save(); };
  const setE = (i: number, j: number, p: Partial<E>) => { st.entries[i][j] = { ...st.entries[i][j], ...p }; save(); };
  const accName = (code: string) => (code && c.A[code]) || "";
  if (st.done && rep) {
    const right = rep.docs.filter((d) => d.ok).length;
    return (
      <div className="shell bare" id="sim-report">
        <PageTitle title={t("Hafta yakuni")} right={<button className="back" aria-label={t("Qaytadan")} onClick={reset}><RotateCcw size={18} /></button>} />
        <div className="stack">
          <section className="card"><h3>{t("Hujjatlar: {r}/{n} to'g'ri", { r: right, n: SIM_DOCS.length })}</h3>
            <p className="small muted" style={{ fontWeight: 600 }}>{t("Quyida sizning provodkalaringizdan tuzilgan hisobot va to'g'ri hisobot yonma-yon.")}</p></section>
          <section className="card"><h3>{t("Hisobvaraqlar qoldig'i")}</h3>
            <table className="sim-tbl"><thead><tr><th>{t("Schyot")}</th><th>{t("Sizda")}</th><th>{t("To'g'ri")}</th></tr></thead><tbody>
              {rep.codes.map((k) => { const a = rep.mine[k] || 0, b = rep.ok[k] || 0; return <tr key={k} className={a === b ? "ok" : "bad"}><td><code>{k}</code> <span className="tiny muted">{accName(k)}</span></td><td>{fmt(a)}</td><td>{fmt(b)}</td></tr>; })}
            </tbody></table>
            <p className="tiny muted" style={{ marginTop: 6 }}>{t("Musbat — debet qoldiq, manfiy — kredit qoldiq.")}</p></section>
          <section className="card"><h3>{t("Balans (1-shakl)")}</h3>
            <table className="sim-tbl"><tbody>
              <tr className={rep.bm.a === rep.bo.a ? "ok" : "bad"}><td>{t("Aktivlar")}</td><td>{fmt(rep.bm.a)}</td><td>{fmt(rep.bo.a)}</td></tr>
              <tr className={rep.bm.l === rep.bo.l ? "ok" : "bad"}><td>{t("Majburiyatlar")}</td><td>{fmt(rep.bm.l)}</td><td>{fmt(rep.bo.l)}</td></tr>
              <tr className={rep.bm.eq === rep.bo.eq ? "ok" : "bad"}><td>{t("Kapital (foyda bilan)")}</td><td>{fmt(rep.bm.eq)}</td><td>{fmt(rep.bo.eq)}</td></tr>
            </tbody></table>
            {rep.bm.a !== rep.bm.l + rep.bm.eq && <p className="small" style={{ color: "var(--red)", fontWeight: 800, marginTop: 6 }}>{t("Sizning balansingiz yopilmadi: aktiv ≠ majburiyat + kapital.")}</p>}</section>
          <section className="card"><h3>{t("Moliyaviy natija (2-shakl)")}</h3>
            <table className="sim-tbl"><tbody>
              {([["Sotishdan daromad", "rev"], ["Sotilgan tovar tannarxi", "cogs"], ["Yalpi foyda", "gross"], ["Davr xarajatlari", "adm"], ["Foyda", "profit"]] as const).map(([l, k]) =>
                <tr key={k} className={rep.f2m[k] === rep.f2o[k] ? "ok" : "bad"}><td>{t(l)}</td><td>{fmt(rep.f2m[k])}</td><td>{fmt(rep.f2o[k])}</td></tr>)}
            </tbody></table></section>
          <section className="card"><h3>{t("QQS: budjetga to'lanadi")}</h3>
            <table className="sim-tbl"><tbody><tr className={rep.vm === rep.vo ? "ok" : "bad"}><td>6410</td><td>{fmt(rep.vm)}</td><td>{fmt(rep.vo)}</td></tr></tbody></table></section>
          <section className="card"><h3>{t("Hujjatlar bo'yicha")}</h3>
            <div className="stack" style={{ gap: 8 }}>{SIM_DOCS.map((d, i) => (
              <div key={i} className="small" style={{ fontWeight: 600 }}>
                {rep.docs[i].ok ? <CheckCircle2 size={14} color="var(--green)" /> : <XCircle size={14} color="var(--red)" />} <b>{t("{d}-kun", { d: d.day })} · {t(d.title)}</b>
                {!rep.docs[i].ok && <div className="tiny" style={{ marginTop: 2 }}>{t("To'g'ri")}: {d.ok.map((e) => `Dt ${e.dt} Kt ${e.kt} ${fmt(e.s)}`).join("; ")}<br />
                  {t("Sizda")}: {(st.entries[i] || []).filter((e: E) => e.dt || e.kt || e.s).map((e: E) => `Dt ${e.dt || "?"} Kt ${e.kt || "?"} ${fmt(e.s)}`).join("; ") || "—"}</div>}
              </div>))}</div></section>
        </div>
      </div>);
  }
  const day = st.day, docs = SIM_DOCS.map((d, i) => ({ d, i })).filter((x) => x.d.day === day);
  return (
    <div className="shell bare" id="sim">
      <PageTitle title={t("{d}-kun · «Ipak Savdo» MChJ", { d: day })} right={<button className="back" aria-label={t("Qaytadan")} onClick={reset}><RotateCcw size={18} /></button>} />
      <div className="stack">
        {day === 1 && <section className="card small" style={{ fontWeight: 600 }}>
          <b>{t("Boshlang'ich balans")}:</b> {Object.entries(SIM_OPEN).map(([k, v]) => `${k} — ${fmt(Math.abs(v))}`).join(" · ")}
          <p className="muted" style={{ marginTop: 6 }}>{t("Har hujjatga provodkalarni o'zingiz yozing. Xato darhol aytilmaydi — hafta oxirida balans va QQS bilan solishtiriladi.")}</p></section>}
        {docs.map(({ d, i }) => (
          <div key={i} className="sim-doc" data-i={i}>
            <b>{t(d.title)}</b><p className="small" style={{ fontWeight: 600 }}>{t(d.text)}</p>
            {st.entries[i].map((e: E, j: number) => (
              <div key={j} className="sim-pv">
                <input className="inp" inputMode="numeric" maxLength={4} placeholder="Dt" aria-label={t("Debet")} value={e.dt} onChange={(x) => setE(i, j, { dt: x.target.value.replace(/\D/g, "").slice(0, 4) })} />
                <input className="inp" inputMode="numeric" maxLength={4} placeholder="Kt" aria-label={t("Kredit")} value={e.kt} onChange={(x) => setE(i, j, { kt: x.target.value.replace(/\D/g, "").slice(0, 4) })} />
                <input className="inp" inputMode="numeric" placeholder={t("summa")} aria-label={t("Summa")} value={e.s ? fmt(e.s) : ""} onChange={(x) => setE(i, j, { s: Number(x.target.value.replace(/\D/g, "")) || 0 })} />
                <button className="chip bad" aria-label={t("o'chirish")} onClick={() => { st.entries[i].splice(j, 1); if (!st.entries[i].length) st.entries[i].push(blank()); save(); }}><Trash2 size={13} /></button>
                {(accName(e.dt) || accName(e.kt)) && <span className="tiny muted" style={{ gridColumn: "1/-1" }}>{accName(e.dt)}{e.kt ? " ← " + accName(e.kt) : ""}</span>}
              </div>))}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {d.sums.map((v) => <button key={v} className="chip" onClick={() => { const L = st.entries[i], tgt = L.find((e: E) => !e.s) || L[L.length - 1]; tgt.s = v; save(); }}>{fmt(v)}</button>)}
              <button className="chip blue" onClick={() => { st.entries[i].push(blank()); save(); }}><Plus size={13} />{t("provodka")}</button>
            </div>
          </div>))}
      </div>
      <div className="dock"><button className="btn" id="sim-next" onClick={() => { sfx("tap"); if (day < 5) { st.day = day + 1; save(); window.scrollTo(0, 0); } else { st.done = true; save(); burst(); } }}>
        {day < 5 ? t("Kunni yopish → {d}-kun", { d: day + 1 }) : t("Haftani yopish va hisobotni ko'rish")}</button></div>
    </div>);
}
