import { useEffect, useState } from "react";
import { Users, Receipt, FileText, HelpCircle, ClipboardCheck, Settings2, Copy, Bell, Smartphone, Trash2, Plus, Printer, Check, X, Link2, LogOut } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { go, toast, tab as goTab } from "../lib/nav";
import { PageTitle, Card, Seg, Empty, copyText } from "../components/ui";
import { rpc, errMsg } from "../engine/server";
import { fmt } from "../engine/data";
import { fmtD, curMonth, weekId, ymd } from "../engine/time";
import { BOT_LINK, APP_LINK, openTg } from "../lib/tg";
import { monthName } from "./FinalLive";

const ask = (q: string) => window.confirm(q);
function Members() {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => rpc<any[]>("liga_admin_list2", { p_pin: S.adminPin }).then((r) => setRows(r || [])).catch((e) => { toast(errMsg(e)); setRows([]); });
  useEffect(() => { load(); }, []);
  if (!rows) return <Empty>{t("Yuklanmoqda...")}</Empty>;
  const cur = weekId(), personal = S.adminGroup?.code === "ASOSIY";
  rows.sort((a, b) => ((b.week_id === cur ? b.week_xp : 0) - (a.week_id === cur ? a.week_xp : 0)) || b.xp - a.xp);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="small muted" style={{ fontWeight: 700 }}>{t("{n} ishtirokchi · natijalar faqat sizga ko'rinadi", { n: rows.length })}</p>
      {rows.map((p) => (
        <section key={p.id} className="card" style={{ padding: 13 }}>
          <div className="row"><b className="grow">{(p.first_name || "") + " " + (p.last_name || "")}{p.id === S.pid ? " · " + t("siz") : ""}</b><span className="disp num" style={{ fontSize: 16 }}>{p.week_id === cur ? p.week_xp : 0}</span></div>
          <p className="small muted" style={{ marginTop: 4, fontWeight: 600 }}>{p.phone} · {t(p.region || "—")} · {t("aniqlik")}: {p.acc_total ? Math.round((p.acc_ok / p.acc_total) * 100) + "%" : "—"}</p>
          <p className="small muted" style={{ fontWeight: 600 }}>{t("jami {xp} XP · {s} bosqich · {d} kun", { xp: p.xp, s: p.stages, d: p.streak })}{personal ? " · " + (p.pay_ok ? t("obuna {d} gacha", { d: fmtD(p.paid_until) }) : t("obuna to'lanmagan")) : ""}</p>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {personal && <button className="btn sm ghost" data-pay={p.id} onClick={async () => { if (!ask(t("{n} uchun 1 oylik to'lov qabul qilindimi?", { n: p.first_name }))) return; const d = await rpc("liga_admin_player_pay", { p_pin: S.adminPin, p_id: p.id, p_months: 1 }).catch((e) => toast(errMsg(e))); if (d) { toast(t("Obuna {d} gacha", { d: fmtD(d as any) })); load(); } }}>{t("+1 oy (naqd)")}</button>}
            {p.has_device && <button className="btn sm ghost" data-dev={p.id} onClick={async () => { if (!ask(t("{n} yangi telefonga o'tadimi? Natijalar saqlanadi.", { n: p.first_name }))) return; await rpc("liga_admin_reset_device", { p_pin: S.adminPin, p_id: p.id }).catch((e) => toast(errMsg(e))); toast(t("Tayyor — yangi telefonda ro'yxatdan o'tsin")); load(); }}><Smartphone size={15} />{t("Qurilma")}</button>}
            {p.id !== S.pid && <button className="btn sm ghost" style={{ color: "var(--red)" }} onClick={async () => { if (!ask(t("{n} ligadan o'chirilsinmi?", { n: p.first_name }))) return; await rpc("liga_admin_delete", { p_pin: S.adminPin, p_id: p.id }).catch((e) => toast(errMsg(e))); load(); }}><Trash2 size={15} /></button>}
          </div>
        </section>))}
    </div>);
}
function Receipts() {
  const [rows, setRows] = useState<any[] | null>(null), [big, setBig] = useState<number | null>(null);
  const load = () => rpc<any[]>("liga_admin_receipts", { p_pin: S.adminPin }).then((r) => setRows(r || [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const decide = async (id: number, ok: boolean) => { if (!ok && !ask(t("Chek rad etilsinmi? Ishtirokchining obunasi bekor qilinadi."))) return; await rpc("liga_admin_receipt_decide", { p_pin: S.adminPin, p_id: id, p_ok: ok }).catch((e) => toast(errMsg(e))); toast(ok ? t("Tasdiqlandi") : t("Rad etildi")); load(); };
  const st: Record<string, string> = { check: t("tekshirilmagan"), paid: t("tasdiqlangan"), cancelled: t("rad etilgan") };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <button className="btn ghost" id="tgadm" onClick={async () => { try { const c = await rpc<string>("liga_admin_tg_link", { p_pin: S.adminPin }); if (!c) return toast(t("PIN noto'g'ri")); openTg(BOT_LINK + "?start=" + c); } catch (e) { toast(errMsg(e)); } }}><Bell size={18} />{t("Cheklarni Telegramda olish")}</button>
      <p className="small muted" style={{ fontWeight: 600 }}>{t("Ishtirokchi chek yuborishi bilan ligaga qo'shiladi. Chek soxta bo'lsa — «Rad etish».")}</p>
      {!rows ? <Empty>{t("Yuklanmoqda...")}</Empty> : !rows.length ? <Empty>{t("Hali chek yo'q.")}</Empty> : rows.map((x) => (
        <section key={x.id} className="card rcpt">
          <img src={x.receipt} alt={t("Chek")} className={big === x.id ? "big" : ""} onClick={() => setBig(big === x.id ? null : x.id)} />
          <div><b>{x.name}</b><p className="small muted">{x.phone}</p><p className="small" style={{ fontWeight: 700 }}>{fmt(x.amount)} {t("so'm")} · {t("{n} oy", { n: x.months })}</p>
            <span className={"chip " + (x.status === "paid" ? "ok" : x.status === "cancelled" ? "bad" : "gold")}>{st[x.status] || x.status}</span>
            {x.status === "check" && <div className="row" style={{ marginTop: 8 }}><button className="btn sm ok" data-rok={x.id} onClick={() => decide(x.id, true)}><Check size={15} />{t("Tasdiqlash")}</button><button className="btn sm bad" onClick={() => decide(x.id, false)}><X size={15} /></button></div>}</div>
        </section>))}
    </div>);
}
export function Report({ month }: { month?: string }) {
  const [m, setM] = useState(month || curMonth()), [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { setRows(null); rpc<any[]>("liga_admin_month", { p_pin: S.adminPin, p_month: m }).then((r) => setRows(r || [])).catch(() => setRows([])); }, [m]);
  const months = [0, 1, 2, 3].map((k) => { const d = ymd(curMonth() + "-01"); d.setMonth(d.getMonth() - k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); });
  const weeks = rows ? ([...new Set(rows.reduce((a: string[], x) => a.concat(Object.keys(x.weeks || {})), []))].sort() as string[]) : [];
  const ac = (rows || []).filter((x) => x.acc_total > 0), avg = ac.length ? Math.round((ac.reduce((a, x) => a + x.acc_ok / x.acc_total, 0) / ac.length) * 100) : 0;
  const pc = (x: any) => (x.acc_total ? Math.round((x.acc_ok / x.acc_total) * 100) + "%" : "—");
  const weak = ac.filter((x) => x.acc_total >= 20 && x.acc_ok / x.acc_total < 0.7);
  return (
    <div className="shell bare" style={{ maxWidth: 1100 }}>
      <PageTitle title={t("Oylik hisobot")} />
      <div className="noprint" style={{ marginBottom: 12 }}><Seg id="rm" value={m} onChange={setM} items={months.map((x) => [x, monthName(x)] as [string, string])} /></div>
      <section className="card">
        <h2 className="disp" style={{ fontSize: 22 }}>{S.adminGroup?.name} — {monthName(m)}</h2>
        <p className="small muted" style={{ fontWeight: 600 }}>{t("Hisobchi Liga · rahbar uchun oylik hisobot · tuzilgan: {d}", { d: new Date().toLocaleDateString("ru-RU") })}</p>
        {!rows ? <Empty>{t("Yuklanmoqda...")}</Empty> : <>
          <div className="stat3" style={{ gridTemplateColumns: "repeat(4,1fr)", margin: "12px 0" }}>
            <div><b>{rows.length}</b><i>{t("xodim")}</i></div><div><b>{rows.filter((x) => x.month_xp > 0).length}</b><i>{t("faol")}</i></div>
            <div><b>{avg}%</b><i>{t("o'rtacha aniqlik")}</i></div><div><b>{weeks.length}</b><i>{t("hafta")}</i></div></div>
          <div className="scroll-x"><table className="rep"><thead><tr><th>№</th><th>{t("Xodim")}</th><th>{t("Viloyat")}</th>{weeks.map((w) => <th key={w}>{fmtD(w.slice(0, 10)).slice(0, 5)}</th>)}<th>{t("Oy jami")}</th><th>{t("Top-3")}</th><th>{t("Aniqlik")}</th><th>{t("Final")}</th><th>{t("Oxirgi faollik")}</th></tr></thead>
            <tbody>{rows.map((x, k) => <tr key={x.id}><td className="n">{k + 1}</td><td><b>{x.name}</b><br /><span className="tiny muted">{x.phone}</span></td><td>{t(x.region || "—")}</td>
              {weeks.map((w) => <td key={w} className="n">{(x.weeks || {})[w] ?? "—"}</td>)}<td className="n"><b>{x.month_xp}</b></td><td className="n">{x.tops || "—"}</td><td className="n">{pc(x)}</td><td className="n">{x.final_score ?? "—"}</td><td>{x.last_active ? new Date(x.last_active).toLocaleDateString("ru-RU") : "—"}</td></tr>)}</tbody></table></div>
          {weak.length > 0 && <p className="small" style={{ marginTop: 10, fontWeight: 700 }}>{t("Qo'shimcha o'qitish tavsiya etiladi")}: {weak.map((x) => x.name + " (" + pc(x) + ")").join(", ")}</p>}
        </>}
      </section>
      <div className="dock noprint"><button className="btn" onClick={() => window.print()}><Printer size={18} />{t("PDF saqlash / chop etish")}</button></div>
    </div>);
}
/* savol muharriri: jamoa savollari (admin) yoki umumiy savollar (superadmin) */
export function QEditor({ pin }: { pin: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [f, setF] = useState<any>({ t: "mc", q: "", o: ["", "", "", ""], a: 0, dt: "", kt: "", e: "", unit: "", lang: S.lang === "ru" ? "ru" : "uz" });
  const [err, setErr] = useState("");
  const load = () => rpc<any[]>("liga_cq_admin", { p_pin: pin }).then((r) => setRows(r || [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const save = async () => {
    setErr(""); const p: any = { t: f.t, q: f.q.trim(), e: f.e.trim(), lang: f.lang };
    if (f.t === "mc") { const o: string[] = []; let ai = 0; f.o.forEach((x: string, k: number) => { if (x.trim()) { if (k === f.a) ai = o.length; o.push(x.trim()); } }); p.o = o; p.a = ai; if (!f.o[f.a]?.trim()) return setErr(t("To'g'ri javob varianti bo'sh")); }
    if (f.t === "pv") { p.dt = f.dt.trim(); p.kt = f.kt.trim(); }
    if (f.t === "calc") { p.a = Number(String(f.a).replace(/\D/g, "")); p.unit = f.unit || null; }
    try { await rpc("liga_cq_save", { p_pin: pin, p_id: f.id || null, p }); toast(t("Saqlandi")); setF({ ...f, id: undefined, q: "", o: ["", "", "", ""], a: 0, dt: "", kt: "", e: "" }); load(); }
    catch (e) { setErr(errMsg(e)); }
  };
  return (
    <div className="stack">
      <Card title={f.id ? t("Savolni tahrirlash") : t("Yangi savol")}>
        <div className="stack" style={{ gap: 10 }}>
          <Seg id="cqt" value={f.t} onChange={(v) => setF({ ...f, t: v, a: v === "mc" ? 0 : "" })} items={[["mc", t("Test")], ["pv", t("Provodka")], ["calc", t("Hisob")]]} />
          <div className="field"><label htmlFor="cq">{t("Savol")}</label><textarea id="cq" className="inp" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
          {f.t === "mc" && f.o.map((v: string, k: number) => <div key={k} className="row"><input className="inp" placeholder={"ABCD"[k] + " " + t("variant")} value={v} onChange={(e) => { const o = f.o.slice(); o[k] = e.target.value; setF({ ...f, o }); }} />
            <button className={"chip " + (f.a === k ? "ok" : "")} onClick={() => setF({ ...f, a: k })}>{f.a === k ? t("to'g'ri") : "✓"}</button></div>)}
          {f.t === "pv" && <div className="btn-row"><input className="inp mono" placeholder={t("Debet (masalan 5010)")} value={f.dt} onChange={(e) => setF({ ...f, dt: e.target.value.replace(/\D/g, "").slice(0, 4) })} /><input className="inp mono" placeholder={t("Kredit (masalan 5110)")} value={f.kt} onChange={(e) => setF({ ...f, kt: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>}
          {f.t === "calc" && <div className="btn-row"><input className="inp" inputMode="numeric" placeholder={t("To'g'ri javob (raqam)")} value={f.a} onChange={(e) => setF({ ...f, a: e.target.value.replace(/\D/g, "") })} /><input className="inp" placeholder={t("Birlik (so'm)")} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>}
          <div className="field"><label htmlFor="ce">{t("Izoh (nega to'g'ri)")}</label><textarea id="ce" className="inp" value={f.e} onChange={(e) => setF({ ...f, e: e.target.value })} /></div>
          <p className="err">{err}</p>
          <button className="btn" onClick={save}><Plus size={18} />{f.id ? t("Saqlash") : t("Savol qo'shish")}</button>
        </div>
      </Card>
      <Card title={t("Qo'shilgan savollar")} right={<span className="chip">{rows?.length || 0}</span>}>
        {!rows ? <Empty>{t("Yuklanmoqda...")}</Empty> : !rows.length ? <Empty>{t("Hali savol yo'q")}</Empty> : <div className="board">{rows.map((x) => (
          <div key={x.id} className="r" style={{ opacity: x.active ? 1 : 0.5 }}><span className="p tiny">{x.t}</span><span className="n" style={{ whiteSpace: "normal" }}>{x.q}</span>
            <span className="row"><button className="chip" onClick={() => setF({ id: x.id, t: x.t, q: x.q, o: x.t === "mc" ? [...(x.o || []), "", "", "", ""].slice(0, 4) : ["", "", "", ""], a: x.t === "mc" ? Number(x.a) : x.a ?? "", dt: x.dt || "", kt: x.kt || "", e: x.e || "", unit: x.unit || "", lang: x.lang })}>{t("tahrir")}</button>
              <button className="chip bad" onClick={async () => { await rpc("liga_cq_save", { p_pin: pin, p_id: x.id, p: { t: x.t, q: x.q, o: x.o, a: x.a, dt: x.dt, kt: x.kt, e: x.e, unit: x.unit, lang: x.lang, active: !x.active } }).catch((e) => toast(errMsg(e))); load(); }}>{x.active ? t("o'chirish") : t("yoqish")}</button></span></div>))}</div>}
      </Card>
    </div>);
}
function Tests() {
  const [rows, setRows] = useState<any[] | null>(null), [title, setTitle] = useState(t("Buxgalter lavozimiga test")), [n, setN] = useState("30"), [mins, setMins] = useState("30"), [open, setOpen] = useState<string | null>(null);
  const load = () => rpc<any[]>("liga_test_admin", { p_pin: S.adminPin }).then((r) => setRows(r || [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const link = (c: string) => APP_LINK + "?t=" + c;
  const create = async () => { try { const c = await rpc<string>("liga_test_create", { p_pin: S.adminPin, p_title: title, p_n: +n, p_minutes: +mins, p_lang: S.lang === "ru" ? "ru" : "uz" }); copyText(link(c), () => toast(t("Havola nusxalandi"))); load(); } catch (e) { toast(errMsg(e)); } };
  const mmss = (ms: number) => Math.floor((ms || 0) / 60000) + ":" + String(Math.floor((ms || 0) / 1000) % 60).padStart(2, "0");
  return (
    <div className="stack">
      <Card title={t("Xodim tanlash testi")}>
        <p className="small muted" style={{ fontWeight: 600, marginBottom: 10 }}>{t("Ishga olayotgan buxgalteringizga havola yuboring: u ro'yxatdan o'tmasdan test ishlaydi, natijasi shu yerda ko'rinadi.")}</p>
        <div className="stack" style={{ gap: 10 }}>
          <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t("Test nomi")} />
          <div className="btn-row"><Seg id="tn" value={n} onChange={setN} items={[["20", "20"], ["30", "30"], ["40", "40"]]} /><Seg id="tm" value={mins} onChange={setMins} items={[["20", t("20 daq")], ["30", t("30 daq")], ["45", t("45 daq")]]} /></div>
          <button className="btn" onClick={create}><Plus size={18} />{t("Test yaratish")}</button>
        </div>
      </Card>
      {!rows ? <Empty>{t("Yuklanmoqda...")}</Empty> : rows.map((x) => (
        <section key={x.code} className="card">
          <div className="row"><b className="grow">{x.title}</b><span className={"chip " + (x.active ? "ok" : "")}>{x.active ? t("ochiq") : t("yopiq")}</span></div>
          <p className="small muted" style={{ fontWeight: 600 }}>{t("{n} savol · {m} daqiqa · {k} nomzod", { n: x.n, m: x.minutes, k: x.runs.length })}</p>
          <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn sm ghost" onClick={() => copyText(link(x.code), () => toast(t("Havola nusxalandi")))}><Link2 size={15} />{t("Havola")}</button>
            <button className="btn sm ghost" onClick={() => setOpen(open === x.code ? null : x.code)}>{t("Natijalar")}</button>
            <button className="btn sm ghost" onClick={async () => { await rpc("liga_test_toggle", { p_pin: S.adminPin, p_code: x.code, p_active: !x.active }); load(); }}>{x.active ? t("Yopish") : t("Ochish")}</button></div>
          {open === x.code && (x.runs.length ? <div className="board" style={{ marginTop: 8 }}>{x.runs.map((r: any, k: number) => (
            <button key={k} className="r" style={{ width: "100%", textAlign: "left" }} disabled={!r.finished} onClick={() => go("testReport", { test: x, run: r })}><span className="p">{k + 1}</span><span className="n">{r.name}<small>{r.phone} · {r.finished ? mmss(r.ms) + " · " + t("hisobot") : t("ishlamoqda")}{r.late ? " · " + t("kechikdi") : ""}</small></span>
              <span className="x">{r.score != null ? Math.round((r.score / r.total) * 100) + "%" : "—"}</span></button>))}</div> : <Empty>{t("Hali nomzod yo'q")}</Empty>)}
        </section>))}
    </div>);
}
function More() {
  const g = S.adminGroup || {}, [wq, setWq] = useState<any[]>([]);
  useEffect(() => { rpc<any[]>("liga_wq_admin", { p_pin: S.adminPin }).then((r) => setWq(r || [])).catch(() => {}); }, []);
  const bl = BOT_LINK + "?start=g_" + g.code, al = APP_LINK + "?g=" + g.code;
  return (
    <div className="stack">
      <Card title={g.name}>
        <p className="small" style={{ fontWeight: 600 }}>{t("Kod")}: <b className="mono">{g.code}</b> · {t("{n} ishtirokchi", { n: g.members })} · {t("{n} ta guruh ulangan", { n: g.chats })}</p>
        <p className="small muted">{t("Obuna")}: {g.paid_until ? fmtD(g.paid_until) : t("muddatsiz")} · {t("Boshlanish")}: {fmtD(g.start_date)}</p>
        {g.code !== "ASOSIY" && <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn sm ghost" onClick={() => copyText(bl, () => toast(t("Nusxa olindi")))}><Copy size={15} />{t("Taklif havolasi (bot)")}</button>
          <button className="btn sm ghost" onClick={() => copyText(al, () => toast(t("Nusxa olindi")))}><Copy size={15} />{t("Ilova havolasi")}</button></div>}
        <p className="small muted" style={{ marginTop: 10 }}>{t("Telegram guruhingizga botni qo'shing va guruhda /ulash {c} deb yozing.", { c: g.code })}</p>
      </Card>
      <Card title={t("Haftaning savoli")}>
        {wq.length ? wq.map((w) => (
          <div key={w.id} className="flat" style={{ marginBottom: 8 }}><b className="small">{w.author_name}</b> <span className="chip">{w.status}</span><p style={{ fontWeight: 700, marginTop: 4 }}>{w.q}</p>
            {(w.o || []).map((x: string, k: number) => <p key={k} className="small">{k === w.a ? "✅" : "▫️"} {x}</p>)}
            {w.status === "pending" && <div className="row" style={{ marginTop: 8 }}><button className="btn sm ok" onClick={async () => { await rpc("liga_wq_decide", { p_pin: S.adminPin, p_qid: w.id, p_ok: true }); toast(t("Tasdiqlandi")); setWq(wq.map((x) => x.id === w.id ? { ...x, status: "approved" } : x)); }}>{t("Tasdiqlash")}</button>
              <button className="btn sm bad" onClick={async () => { await rpc("liga_wq_decide", { p_pin: S.adminPin, p_qid: w.id, p_ok: false }); setWq(wq.map((x) => x.id === w.id ? { ...x, status: "rejected" } : x)); }}>{t("Rad etish")}</button></div>}
          </div>)) : <Empty>{t("Hali taklif yo'q.")}</Empty>}
      </Card>
      <button className="btn ghost" onClick={() => { S.adminPin = ""; S.adminGroup = null; persist(); goTab("profile"); }}><LogOut size={18} />{t("Admin rejimidan chiqish")}</button>
    </div>);
}
export function Admin() {
  const [tb, setTb] = useState<"mem" | "rcp" | "rep" | "q" | "test" | "more">(S.adminGroup?.code === "ASOSIY" ? "rcp" : "mem");
  const [ok, setOk] = useState(!!S.adminGroup);
  useEffect(() => { rpc<any[]>("liga_admin_group", { p_pin: S.adminPin }).then((r) => { if (!r || !r[0]) { S.adminPin = ""; persist(); toast(t("PIN eskirgan — qayta kiring")); go("adminLogin"); return; } S.adminGroup = r[0]; persist(); setOk(true); }).catch(() => {}); }, []);
  const items: [typeof tb, any, string][] = [["mem", Users, "A'zolar"], ["rcp", Receipt, "Cheklar"], ["rep", FileText, "Hisobot"], ["q", HelpCircle, "Savollar"], ["test", ClipboardCheck, "Testlar"], ["more", Settings2, "Jamoa"]];
  return (
    <div className="shell bare">
      <PageTitle title={t("Admin panel")} />
      <div className="tiles" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 14 }}>
        {items.map(([id, Ic, l]) => <button key={id} className="tile" style={{ gridTemplateColumns: "1fr", justifyItems: "center", textAlign: "center", borderColor: tb === id ? "var(--stamp)" : undefined, background: tb === id ? "var(--stamp-soft)" : undefined }} onClick={() => id === "rep" ? go("report") : setTb(id)}><Ic size={20} /><b style={{ fontSize: 13 }}>{t(l)}</b></button>)}
      </div>
      {ok && <>{tb === "mem" && <Members />}{tb === "rcp" && <Receipts />}{tb === "q" && <QEditor pin={S.adminPin!} />}{tb === "test" && <Tests />}{tb === "more" && <More />}</>}
    </div>);
}
