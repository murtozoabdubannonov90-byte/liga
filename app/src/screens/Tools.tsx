/* Buxgalter uchun kundalik vositalar: soliq taqvimi, qonun yangiliklari, kalkulyatorlar,
   xodim testi hisoboti, superadmin muharrirlari va jamoalar bellashuvi kartasi */
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, BellRing, Calculator, Scale, ExternalLink, Newspaper, Printer, Plus, Swords, ChevronRight, Trash2 } from "lucide-react";
import { S, persist } from "../engine/state";
import { t, tx, getLang } from "../lib/i18n";
import { go, replace, toast } from "../lib/nav";
import { rpc, errMsg } from "../engine/server";
import { C, startTopic, startNews } from "../engine/run";
import { fmt } from "../engine/data";
import { tzNow, ymd, fmtD } from "../engine/time";
import { openUrl } from "../lib/tg";
import { Card, PageTitle, Seg, Empty } from "../components/ui";

const OY = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const runTopic = (tp: string) => { const r = startTopic(tp); if (typeof r === "string") toast(t(r)); else go("quiz", { run: r }); };
const title = (x: any) => (getLang() === "ru" ? x.title_ru || x.title_uz : tx(x.title_uz));

/* ---------------- soliq taqvimi ---------------- */
export function upcoming(days = 60) {
  const out: { date: Date; n: number; x: any }[] = [], base = ymd(tzNow().day);
  for (let n = 0; n < days; n++) {
    const d = new Date(base); d.setDate(d.getDate() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (const x of (S.taxCal || []) as any[]) {
      if (!x.active) continue;
      if (Math.min(x.day, last) === d.getDate() && (!x.months?.length || x.months.includes(d.getMonth() + 1))) out.push({ date: d, n, x });
    }
  }
  return out;
}
const leftTxt = (n: number) => (n === 0 ? t("bugun") : n === 1 ? t("ertaga") : t("{n} kun qoldi", { n }));

/* bosh sahifa: 5 kun ichida muddat bo'lsa — eslatma kartasi */
export function DeadlineCard() {
  const u = upcoming(6)[0]; if (!u) return null;
  return (
    <button className="card deadline" onClick={() => go("calendar")}>
      <span className="dl-date"><b className="disp">{u.date.getDate()}</b><i>{t(OY[u.date.getMonth()])}</i></span>
      <span className="grow"><span className={"chip " + (u.n <= 1 ? "bad" : "gold")}>{leftTxt(u.n)}</span><b className="dl-t">{title(u.x)}</b></span>
      <ChevronRight size={18} color="var(--muted)" />
    </button>);
}

export function TaxCalendar() {
  const list = useMemo(() => upcoming(62), [S.taxCal]);
  const [on, setOn] = useState<"on" | "off">(S.taxRemind === false ? "off" : "on");
  const setRemind = (v: "on" | "off") => {
    setOn(v); S.taxRemind = v === "on"; persist();
    if (S.pid && S.token) rpc("liga_set_tax_remind", { p_id: S.pid, p_token: S.token, p_on: v === "on" }).catch(() => {});
  };
  return (
    <div className="shell bare"><PageTitle title={t("Soliq taqvimi")} />
      <div className="stack">
        <Card title={t("Telegram eslatmasi")} right={<BellRing size={20} />}>
          <p className="small muted" style={{ fontWeight: 600, marginBottom: 10 }}>{t("Muddatdan 3 kun va 1 kun oldin bot sizga shaxsan eslatadi.")}</p>
          <Seg id="taxr" value={on} onChange={setRemind} items={[["on", t("Yoqilgan")], ["off", t("O'chirilgan")]]} />
        </Card>
        {!list.length ? <Empty>{t("Yaqin 2 oyda muddat yo'q.")}</Empty> : <section className="card cal-list">
          {list.map((u, k) => (
            <div key={k} className="cal-row">
              <span className="dl-date"><b className="disp">{u.date.getDate()}</b><i>{t(OY[u.date.getMonth()])}</i></span>
              <span className="grow"><b>{title(u.x)}</b><span className={"small " + (u.n <= 3 ? "hot" : "muted")}>{leftTxt(u.n)}</span></span>
              {u.x.topic && <button className="chip blue" onClick={() => runTopic(u.x.topic)}>{t("Mashq")}</button>}
            </div>))}
        </section>}
        <p className="tiny muted" style={{ textAlign: "center" }}>{t("Muddat dam olish kuniga to'g'ri kelsa, keyingi ish kuniga o'tadi. Taqvimni superadmin yangilaydi.")}</p>
      </div>
    </div>);
}

/* ---------------- qonun yangiliklari ---------------- */
const nTitle = (n: any) => (getLang() === "ru" && n.title_ru ? n.title_ru : tx(n.title_uz));
const nBody = (n: any) => (getLang() === "ru" && n.body_ru ? n.body_ru : tx(n.body_uz));
export function NewsCard() {
  const n = (S.news || [])[0]; if (!n || Date.now() - new Date(n.created_at).getTime() > 14 * 864e5) return null;
  return (
    <button className="card row news-card" style={{ textAlign: "left" }} onClick={() => go("newsView", { id: n.id })}>
      <span className="ic"><Scale size={20} /></span>
      <span className="grow"><span className="tiny muted" style={{ fontWeight: 800 }}>{t("Qonun yangiligi")} · {fmtD(n.created_at)}</span><br /><b>{nTitle(n)}</b></span>
      <ChevronRight size={18} color="var(--muted)" />
    </button>);
}
export function News() {
  const L = S.news || [];
  return (
    <div className="shell bare"><PageTitle title={t("Qonun yangiliklari")} />
      {!L.length ? <Empty>{t("Hali yangilik yo'q. Har hafta yangi qaror va xatlar bo'yicha qisqa sharh qo'shiladi.")}</Empty>
        : <div className="stack">{L.map((n: any) => (
          <button key={n.id} className="card" style={{ textAlign: "left" }} onClick={() => go("newsView", { id: n.id })}>
            <span className="tiny muted" style={{ fontWeight: 800 }}>{fmtD(n.created_at)}{n.qs?.length ? " · " + t("{n} ta savol", { n: n.qs.length }) : ""}</span>
            <h3 style={{ fontSize: 17, margin: "4px 0 6px" }}>{nTitle(n)}</h3>
            <p className="small muted">{nBody(n).slice(0, 140)}{nBody(n).length > 140 ? "…" : ""}</p>
          </button>))}</div>}
    </div>);
}
export function NewsView({ id }: { id: number }) {
  const n = (S.news || []).find((x: any) => x.id === id);
  if (!n) return <div className="shell bare"><PageTitle title={t("Qonun yangiligi")} /><Empty>{t("Topilmadi")}</Empty></div>;
  return (
    <div className="shell bare"><PageTitle title={t("Qonun yangiligi")} />
      <div className="stack">
        <section className="card">
          <span className="tiny muted" style={{ fontWeight: 800 }}>{fmtD(n.created_at)}</span>
          <h2 style={{ fontSize: 21, margin: "6px 0 10px", lineHeight: 1.2 }}>{nTitle(n)}</h2>
          <p style={{ whiteSpace: "pre-line", lineHeight: 1.55, fontWeight: 500 }}>{nBody(n)}</p>
          {n.url && <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => openUrl(n.url)}><ExternalLink size={16} />{t("Manbani ochish")}</button>}
        </section>
      </div>
      {n.qs?.length > 0 && <div className="dock"><button className="btn" id="go" onClick={() => { const r = startNews(n); if (typeof r === "string") toast(t(r)); else replace("quiz", { run: r }); }}>
        {t("Bilimni tekshirish · {n} savol", { n: n.qs.length })}</button></div>}
    </div>);
}

/* ---------------- kalkulyatorlar ---------------- */
const num = (s: string) => Number(String(s || "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
function Money({ label, v, set, id, suffix }: { label: string; v: string; set: (s: string) => void; id: string; suffix?: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label>
    <div className="inp-wrap"><input id={id} className="inp num-inp" inputMode="decimal" value={v} onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ""); set(d ? fmt(+d) : ""); }} />{suffix && <span className="sfx">{suffix}</span>}</div></div>;
}
function Pct({ label, v, set, id }: { label: string; v: string; set: (s: string) => void; id: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label><div className="inp-wrap"><input id={id} className="inp num-inp" inputMode="decimal" value={v} onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ""))} /><span className="sfx">%</span></div></div>;
}
function Lines({ rows }: { rows: [string, number, boolean?][] }) {
  return <div className="calc-out">{rows.map(([l, v, big], k) => <div key={k} className={"cl" + (big ? " big" : "")}><span>{l}</span><b className="num">{fmt(Math.round(v))}</b></div>)}</div>;
}
function Salary() {
  const [mode, setMode] = useState<"gross" | "net">("gross"), [v, setV] = useState("8 000 000"), [r, setR] = useState("12"), [s, setS] = useState("12");
  const rr = num(r) / 100, ss = num(s) / 100, x = num(v);
  const gross = mode === "gross" ? x : rr < 1 ? x / (1 - rr) : 0, jsh = gross * rr, net = gross - jsh, soc = gross * ss;
  return (
    <div className="stack">
      <Seg id="sm" value={mode} onChange={setMode} items={[["gross", t("Hisoblangan → qo'lga")], ["net", t("Qo'lga → hisoblash")]]} />
      <Money id="sv" label={mode === "gross" ? t("Hisoblangan ish haqi") : t("Xodim qo'liga oladigan summa")} v={v} set={setV} suffix={t("so'm")} />
      <div className="row2"><Pct id="sr" label={t("JShDS stavkasi")} v={r} set={setR} /><Pct id="ss" label={t("Ijtimoiy soliq stavkasi")} v={s} set={setS} /></div>
      <Lines rows={[[t("Hisoblangan ish haqi"), gross], [t("JShDS (xodimdan ushlanadi)"), jsh], [t("Xodim qo'liga"), net, true], [t("Ijtimoiy soliq (ish beruvchi to'laydi)"), soc], [t("Ish beruvchining jami xarajati"), gross + soc, true]]} />
      <div className="note small"><span>{t("Provodkalar: Dt 9420 (yoki 2010) — Kt 6710; Dt 6710 — Kt 6410 (JShDS); Dt 9420 (yoki 2010) — Kt 6410 (ijtimoiy soliq).")}</span></div>
    </div>);
}
function Vat() {
  const [mode, setMode] = useState<"add" | "out">("add"), [v, setV] = useState("10 000 000"), [r, setR] = useState("12");
  const rate = num(r) / 100, x = num(v);
  const net = mode === "add" ? x : x / (1 + rate), vat = net * rate;
  return (
    <div className="stack">
      <Seg id="vm" value={mode} onChange={setMode} items={[["add", t("QQSsiz → QQS bilan")], ["out", t("QQS bilan → ajratish")]]} />
      <Money id="vv" label={mode === "add" ? t("Summa (QQSsiz)") : t("Summa (QQS bilan)")} v={v} set={setV} suffix={t("so'm")} />
      <Pct id="vr" label={t("QQS stavkasi")} v={r} set={setR} />
      <Lines rows={[[t("QQSsiz summa"), net], [t("QQS summasi"), vat, true], [t("QQS bilan jami"), net + vat, true]]} />
      {mode === "out" && <div className="note small"><span>{t("Formula: QQS = jami × {r} / (100 + {r}).", { r: num(r) })}</span></div>}
    </div>);
}
function Depr() {
  const [m, setM] = useState<"line" | "dec">("line"), [cost, setCost] = useState("60 000 000"), [salv, setSalv] = useState("0"), [yrs, setYrs] = useState("5");
  const c = num(cost), sv = num(salv), n = Math.max(1, Math.min(50, Math.round(num(yrs)) || 1));
  const sched: { y: number; a: number; rest: number }[] = [];
  let rest = c;
  for (let y = 1; y <= n; y++) {
    let a = m === "line" ? (c - sv) / n : y === n ? rest - sv : rest * (2 / n);
    a = Math.max(0, Math.min(a, rest - sv)); rest -= a; sched.push({ y, a, rest });
  }
  return (
    <div className="stack">
      <Seg id="dm" value={m} onChange={setM} items={[["line", t("To'g'ri chiziqli")], ["dec", t("Kamayib boruvchi qoldiq")]]} />
      <Money id="dc" label={t("Boshlang'ich qiymat")} v={cost} set={setCost} suffix={t("so'm")} />
      <div className="row2"><Money id="ds" label={t("Tugatish qiymati")} v={salv} set={setSalv} /><div className="field"><label htmlFor="dy">{t("Foydali muddat (yil)")}</label><input id="dy" className="inp num-inp" inputMode="numeric" value={yrs} onChange={(e) => setYrs(e.target.value.replace(/\D/g, ""))} /></div></div>
      {m === "line" && <Lines rows={[[t("Yillik eskirish"), (c - sv) / n, true], [t("Oylik eskirish"), (c - sv) / n / 12, true]]} />}
      <section className="card" style={{ padding: "6px 14px" }}>
        <div className="sched head"><span>{t("Yil")}</span><span>{t("Eskirish")}</span><span>{t("Qoldiq")}</span></div>
        {sched.map((x) => <div key={x.y} className="sched"><span>{x.y}</span><b className="num">{fmt(Math.round(x.a))}</b><span className="num">{fmt(Math.round(x.rest))}</span></div>)}
      </section>
      <div className="note small"><span>{t("Provodka: Dt 9420 (yoki 2010, 9410) — Kt 0230 (masalan, mashina va uskunalar eskirishi).")}</span></div>
    </div>);
}
export function Calcs() {
  const [tb, setTb] = useState<"sal" | "vat" | "dep">("sal");
  const tp = tb === "sal" ? "ish" : tb === "vat" ? "qqs" : "av";
  return (
    <div className="shell bare"><PageTitle title={t("Kalkulyatorlar")} right={<Calculator size={20} />} />
      <div className="stack">
        <Seg id="calc" value={tb} onChange={setTb} items={[["sal", t("Ish haqi")], ["vat", t("QQS")], ["dep", t("Amortizatsiya")]]} />
        {tb === "sal" && <Salary />}{tb === "vat" && <Vat />}{tb === "dep" && <Depr />}
        <p className="tiny muted" style={{ textAlign: "center" }}>{t("Stavkalarni o'zingiz o'zgartira olasiz — qonun o'zgarsa, hisob ham to'g'ri bo'ladi.")}</p>
      </div>
      <div className="dock"><button className="btn ghost" onClick={() => runTopic(tp)}>{t("Shu mavzuda mashq qilish")}</button></div>
    </div>);
}

/* ---------------- xodim testi hisoboti (ish beruvchi uchun, chop etiladi) ---------------- */
export function TestReport({ test, run }: { test: any; run: any }) {
  const c = C(), det: any[] = run.detail || [];
  const by: Record<string, { ok: number; n: number }> = {};
  for (const d of det) { const k = d.pool || "?"; by[k] = by[k] || { ok: 0, n: 0 }; by[k].n++; if (d.ok) by[k].ok++; }
  const pct = run.total ? Math.round((run.score / run.total) * 100) : 0;
  const verdict = pct >= 80 ? t("Tavsiya etiladi") : pct >= 60 ? t("Qo'shimcha suhbat tavsiya etiladi") : t("Qo'shimcha o'qitish tavsiya etiladi");
  const mmss = (ms: number) => Math.floor((ms || 0) / 60000) + ":" + String(Math.floor((ms || 0) / 1000) % 60).padStart(2, "0");
  const types: Record<string, { ok: number; n: number }> = {};
  for (const d of det) { const k = d.t || "?"; types[k] = types[k] || { ok: 0, n: 0 }; types[k].n++; if (d.ok) types[k].ok++; }
  const TN: Record<string, string> = { pv: "Provodka tuzish", calc: "Hisob-kitob", mc: "Qonun va nazariya" };
  return (
    <div className="shell bare report"><PageTitle title={t("Nomzod hisoboti")} />
      <section className="card">
        <p className="tiny muted" style={{ fontWeight: 800 }}>{test.title} · {fmtD(run.finished || run.started)}</p>
        <h2 style={{ fontSize: 22, margin: "6px 0 2px" }}>{run.name}</h2><p className="small muted">{run.phone}</p>
        <div className="stat3" style={{ marginTop: 14 }}>
          <div><b className="num">{pct}%</b><i>{t("natija")}</i></div><div><b className="num">{run.score}/{run.total}</b><i>{t("to'g'ri")}</i></div>
          <div><b className="num">{mmss(run.ms)}</b><i>{t("vaqt")}{run.late ? " · " + t("kechikdi") : ""}</i></div></div>
        <div className={"verdict " + (pct >= 80 ? "ok" : pct >= 60 ? "mid" : "bad")}>{verdict}</div>
      </section>
      <Card title={t("Ko'nikmalar bo'yicha")}>
        {Object.entries(types).map(([k, v]) => <Bar key={k} label={t(TN[k] || k)} ok={v.ok} n={v.n} />)}
      </Card>
      <Card title={t("Mavzular bo'yicha")}>
        {Object.entries(by).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([k, v]) => { const si = +k.replace(/\D/g, ""); return <Bar key={k} label={c.STAGES[si]?.title || k} ok={v.ok} n={v.n} />; })}
      </Card>
      <p className="tiny muted" style={{ textAlign: "center", margin: "10px 0 90px" }}>{t("Savollar har nomzodga alohida tanlanadi, javoblar serverda tekshiriladi. Hisobchi Liga")}</p>
      <div className="dock noprint"><button className="btn" onClick={() => window.print()}><Printer size={18} />{t("PDF saqlash / chop etish")}</button></div>
    </div>);
}
function Bar({ label, ok, n }: { label: string; ok: number; n: number }) {
  const p = n ? Math.round((ok / n) * 100) : 0;
  return <div className="skill"><div className="row between"><span className="small" style={{ fontWeight: 700 }}>{label}</span><b className="small num">{ok}/{n}</b></div>
    <div className="meter"><i style={{ width: Math.max(3, p) + "%", background: p >= 80 ? "var(--green)" : p >= 60 ? "var(--gold)" : "var(--red)" }} /></div></div>;
}

/* ---------------- jamoalar bellashuvi (reyting) ---------------- */
export function MatchCard() {
  const m = S.match; if (!m || (!m.cur && !m.prev)) return null;
  const me = S.group?.name || t("Jamoangiz");
  return (
    <Card title={t("Jamoalar bellashuvi")} right={<Swords size={20} color="var(--red)" />}>
      {m.cur ? <>
        <div className="vs"><div><b>{me}</b><i>{t("{n} kishi o'ynadi", { n: m.cur.my_played })}</i></div><span className="disp">VS</span>
          <div><b>{m.cur.opp_name}</b><i>{t("{n} kishi o'ynadi", { n: m.cur.opp_played })}</i></div></div>
        <p className="small muted" style={{ fontWeight: 600, marginTop: 8 }}>{t("Jamoa bali — eng yaxshi 3 kishining haftalik bali. G'olib juma 12:00 da.")}</p>
      </> : <p className="small muted" style={{ fontWeight: 600 }}>{t("Bu hafta raqib yo'q — dushanba kuni yangi juftlar.")}</p>}
      {m.prev && <p className="small" style={{ fontWeight: 700, marginTop: 8 }}>{t("O'tgan hafta: {a} — {b} · «{o}»", { a: m.prev.my_xp ?? 0, b: m.prev.opp_xp ?? 0, o: m.prev.opp_name })} {(m.prev.my_xp ?? 0) > (m.prev.opp_xp ?? 0) ? "🏆" : (m.prev.my_xp ?? 0) < (m.prev.opp_xp ?? 0) ? "" : "🤝"}</p>}
    </Card>);
}

/* ---------------- superadmin: soliq taqvimi va qonun yangiliklari ---------------- */
export function TaxCalEditor() {
  const [rows, setRows] = useState<any[]>([]), [f, setF] = useState<any>({ day: "15", months: "", title_uz: "", title_ru: "", topic: "" });
  const load = () => rpc<any[]>("liga_tax_cal_list").then((r) => { setRows(r || []); S.taxCal = r || []; }).catch(() => {});
  useEffect(() => { load(); }, []);
  const save = async (id: number | null, p: any) => {
    try { await rpc("liga_tax_cal_save", { p_pin: S.superPin, p_id: id, p }); toast(t("Saqlandi")); load(); setF({ day: "15", months: "", title_uz: "", title_ru: "", topic: "" }); }
    catch (e) { toast(errMsg(e)); }
  };
  const months = (s: string) => s.split(/[^\d]+/).map(Number).filter((x) => x >= 1 && x <= 12);
  return (
    <div className="stack">
      <div className="note small"><span>{t("Muddatlarni tekshirib to'ldiring: kun, oylar (bo'sh — har oy; masalan 1,4,7,10 — chorak), nomi. Bot muddatdan 3 va 1 kun oldin eslatadi.")}</span></div>
      <Card title={f.id ? t("Tahrirlash") : t("Yangi muddat")}>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row2"><input className="inp" aria-label={t("Kun")} placeholder={t("Kun")} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value.replace(/\D/g, "") })} />
            <input className="inp" aria-label={t("Oylar")} placeholder={t("Oylar (bo'sh — har oy)")} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} /></div>
          <input className="inp" placeholder={t("Nomi (o'zbekcha)")} value={f.title_uz} onChange={(e) => setF({ ...f, title_uz: e.target.value })} />
          <input className="inp" placeholder={t("Nomi (ruscha, ixtiyoriy)")} value={f.title_ru} onChange={(e) => setF({ ...f, title_ru: e.target.value })} />
          <select className="inp" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} aria-label={t("Mashq mavzusi")}>
            <option value="">{t("Mashq mavzusi (ixtiyoriy)")}</option>{C().TOPICS.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
          <button className="btn" onClick={() => save(f.id || null, { day: +f.day, months: months(f.months), title_uz: f.title_uz, title_ru: f.title_ru, topic: f.topic || null })}><Plus size={18} />{t("Saqlash")}</button>
        </div>
      </Card>
      <section className="card cal-list">{rows.map((x) => (
        <div key={x.id} className="cal-row" style={{ opacity: x.active ? 1 : 0.45 }}>
          <span className="dl-date"><b className="disp">{x.day}</b><i>{x.months?.length ? x.months.join(",") : t("har oy")}</i></span>
          <span className="grow"><b>{x.title_uz}</b>{x.topic && <span className="small muted">{x.topic}</span>}</span>
          <button className="chip" onClick={() => setF({ id: x.id, day: String(x.day), months: (x.months || []).join(","), title_uz: x.title_uz, title_ru: x.title_ru || "", topic: x.topic || "" })}>{t("tahrir")}</button>
          <button className="chip bad" aria-label={t("o'chirish")} onClick={() => save(x.id, { ...x, active: !x.active })}><Trash2 size={13} /></button>
        </div>))}</section>
    </div>);
}
const emptyQ = () => ({ q: "", o: ["", "", "", ""], a: 0, e: "" });
export function NewsEditor() {
  const [rows, setRows] = useState<any[]>([]), [f, setF] = useState<any>({ title_uz: "", title_ru: "", body_uz: "", body_ru: "", url: "", qs: [] as any[] });
  const load = () => rpc<any[]>("liga_news_admin", { p_pin: S.superPin }).then((r) => setRows(r || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const save = async () => {
    const qs = f.qs.map((x: any) => ({ ...x, o: x.o.filter((s: string) => s.trim()) })).filter((x: any) => x.q.trim().length >= 5);
    try { await rpc("liga_news_save", { p_pin: S.superPin, p_id: f.id || null, p: { ...f, qs } }); toast(t("Saqlandi")); setF({ title_uz: "", title_ru: "", body_uz: "", body_ru: "", url: "", qs: [] }); load(); }
    catch (e) { toast(errMsg(e)); }
  };
  const setQ = (k: number, x: any) => setF({ ...f, qs: f.qs.map((y: any, j: number) => (j === k ? x : y)) });
  return (
    <div className="stack">
      <Card title={f.id ? t("Tahrirlash") : t("Yangi qonun yangiligi")} right={<Newspaper size={20} />}>
        <div className="stack" style={{ gap: 8 }}>
          <input className="inp" placeholder={t("Sarlavha")} value={f.title_uz} onChange={(e) => setF({ ...f, title_uz: e.target.value })} />
          <textarea className="inp" rows={5} placeholder={t("Qisqa sharh: nima o'zgardi, kimga tegishli, qachondan")} value={f.body_uz} onChange={(e) => setF({ ...f, body_uz: e.target.value })} />
          <input className="inp" placeholder={t("Manba havolasi (lex.uz, soliq.uz)")} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          <details><summary className="small" style={{ fontWeight: 700 }}>{t("Ruscha matn (ixtiyoriy)")}</summary>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}><input className="inp" placeholder="Заголовок" value={f.title_ru} onChange={(e) => setF({ ...f, title_ru: e.target.value })} />
              <textarea className="inp" rows={4} placeholder="Краткий обзор" value={f.body_ru} onChange={(e) => setF({ ...f, body_ru: e.target.value })} /></div></details>
          {f.qs.map((x: any, k: number) => (
            <div key={k} className="flat stack" style={{ gap: 6 }}>
              <input className="inp" placeholder={t("Savol {n}", { n: k + 1 })} value={x.q} onChange={(e) => setQ(k, { ...x, q: e.target.value })} />
              {x.o.map((o: string, j: number) => <div key={j} className="row"><input className="inp grow" placeholder={t("Variant {n}", { n: j + 1 })} value={o} onChange={(e) => setQ(k, { ...x, o: x.o.map((y: string, i: number) => (i === j ? e.target.value : y)) })} />
                <button className={"chip " + (x.a === j ? "ok" : "")} onClick={() => setQ(k, { ...x, a: j })}>{x.a === j ? t("to'g'ri") : "✓"}</button></div>)}
              <input className="inp" placeholder={t("Izoh (nega to'g'ri)")} value={x.e} onChange={(e) => setQ(k, { ...x, e: e.target.value })} />
            </div>))}
          {f.qs.length < 5 && <button className="btn ghost sm" onClick={() => setF({ ...f, qs: [...f.qs, emptyQ()] })}><Plus size={16} />{t("Savol qo'shish")}</button>}
          <button className="btn" onClick={save}>{t("Saqlash")}</button>
        </div>
      </Card>
      {rows.map((n) => (
        <section key={n.id} className="card row" style={{ opacity: n.active ? 1 : 0.45 }}>
          <span className="grow"><b>{n.title_uz}</b><br /><span className="small muted">{fmtD(n.created_at)} · {t("{n} ta savol", { n: (n.qs || []).length })}{n.posted_at ? " · " + t("guruhlarga yuborildi") : ""}</span></span>
          <button className="chip" onClick={() => setF({ ...n, title_ru: n.title_ru || "", body_ru: n.body_ru || "", url: n.url || "", qs: (n.qs || []).map((x: any) => ({ ...x, o: [...x.o, "", "", "", ""].slice(0, 4) })) })}>{t("tahrir")}</button>
        </section>))}
    </div>);
}
export { CalendarClock };
