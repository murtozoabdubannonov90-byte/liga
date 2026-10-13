/* Sertifikatlar: o'ringa qarab alohida (oltin/kumush/bronza) rasmiy hujjat ko'rinishi, QR + raqamli imzo.
   Ma'lumot har doim serverdan (liga_cert_verify2) — QR ichida faqat sertifikat raqami bor, ism/o'rin serverdan olinadi. */
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Award, Printer, ShieldCheck, ShieldX, Share2, Clock, Fingerprint } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { toast } from "../lib/nav";
import { PageTitle, Card, Empty } from "../components/ui";
import { rpc, errMsg } from "../engine/server";
import { APP_LINK } from "../lib/tg";
import { fmtD } from "../engine/time";
import { fmt } from "../engine/data";
import { Mark } from "./Onboard";
import { Medal, PLACE } from "../components/Medal";
import { burst } from "../lib/fx";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/cormorant-garamond/600-italic.css";

export const verifyUrl = (id: string) => APP_LINK + "?v=" + id;
const host = () => APP_LINK.replace(/^https?:\/\//, "").replace(/\/$/, "");
const dd = (s?: string) => fmtD(String(s || "").slice(0, 10));
const DEG = ["Oltin daraja", "Kumush daraja", "Bronza daraja"];

/* sertifikat ma'lumoti — serverdan */
export function useCert(id: string) {
  const [c, setC] = useState<any>(undefined);
  useEffect(() => { let on = true; rpc<any>("liga_cert_verify2", { p_id: id }).then((r) => on && setC(r && r.ok ? r : null)).catch(() => on && setC(null)); return () => { on = false; }; }, [id]);
  return c;
}

/* qimmatli qog'ozlardagidek nozik to'lqin chiziqlar (gilyosh) — o'rin rangida */
function Guilloche({ color, seed }: { color: string; seed: number }) {
  const paths = useMemo(() => {
    const out: string[] = [];
    for (let k = 0; k < 9; k++) {
      const ph = seed * 0.7 + k * 0.55, amp = 7 + (k % 3) * 3, y0 = 14 + k * 16;
      let d = "";
      for (let x = 0; x <= 200; x += 4) { const y = y0 + Math.sin(x / 11 + ph) * amp + Math.sin(x / 29 + ph * 2) * 4; d += (x ? "L" : "M") + x + " " + y.toFixed(1); }
      out.push(d);
    }
    return out;
  }, [seed]);
  return (
    <svg className="cert-gl" viewBox="0 0 200 160" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((d, k) => <path key={k} d={d} fill="none" stroke={color} strokeWidth=".35" opacity={0.55 - k * 0.03} />)}
    </svg>);
}

/* liga muhri (brend muhri) */
function Seal({ year, serial }: { year: string; serial: string }) {
  const r = 40;
  return (
    <svg className="cert-seal" viewBox="0 0 100 100" aria-hidden="true">
      <defs><path id="sealc" d={`M50 ${50 - r} a${r} ${r} 0 1 1 -0.01 0`} /></defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <text fontSize="8.4" fontWeight="800" letterSpacing="1.2" fill="currentColor"><textPath href="#sealc">HISOBCHI LIGA • TASDIQLANGAN • {year} •</textPath></text>
      <path d="M36 42h28M50 42v22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="41" cy="52" r="2.6" fill="currentColor" /><circle cx="59" cy="52" r="2.6" fill="currentColor" />
      <text x="50" y="76" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="currentColor">{serial}</text>
    </svg>);
}

export function CertPaper({ c }: { c: any }) {
  const [qr, setQr] = useState("");
  const place = c.kind === "week" ? Math.min(3, Math.max(1, c.place || 3)) : 0;
  const theme = place ? PLACE[place - 1] : null;
  const ink = theme ? theme.metal[3] : "#0F2A24", tint = theme ? theme.metal[2] : "#16382F";
  useEffect(() => { QRCode.toDataURL(verifyUrl(c.id), { margin: 1, width: 300, errorCorrectionLevel: "M", color: { dark: "#0F2A24", light: "#ffffff" } }).then(setQr); }, [c.id]);
  const w = c.week || {};
  return (
    <article className={"cert " + (theme ? "cert-" + theme.key : "cert-ink")} style={{ ["--c-ink" as any]: ink, ["--c-tint" as any]: tint }} aria-label={t("Sertifikat")}>
      <Guilloche color={tint} seed={(c.id || "A").charCodeAt(0) + (place || 4)} />
      <div className="cert-frame">
        <header className="cert-top">
          <Mark size={30} /><div><b>Hisobchi Liga</b><span>{t("Buxgalterlar haftalik ligasi")}</span></div>
        </header>
        <h2 className="cert-title">{t("Sertifikat")}</h2>
        {theme && <p className="cert-deg">{t(DEG[place - 1])}</p>}
        <p className="cert-small">{t("Ushbu sertifikat")}</p>
        <p className="cert-name">{c.name}</p>
        {c.kind === "week" ? <>
          <p className="cert-body">{t("{a}–{b} kunlari o'tkazilgan {n}-hafta ligasida «{team}» jamoasidagi {p} ishtirokchi orasida", { a: dd(w.from), b: dd(w.to), n: w.no, team: c.team || "Hisobchi Liga", p: c.participants || "—" })}</p>
          <div className="cert-place"><Medal place={place} size={46} week={w.no ? w.no + "-H" : undefined} /><b>{t("{n}-o'rin", { n: place })}</b></div>
          <p className="cert-body">{t("egallagani va {x} ball to'plagani uchun beriladi.", { x: fmt(c.xp || 0) })}</p>
        </> : <>
          <p className="cert-body">{t("Hisobchi Liga dasturining 12 bosqichini — provodka, QQS, ish haqi, asosiy vositalar, soliqlar, hisobotlar va qonunchilik — to'liq yakunlagani uchun beriladi.")}</p>
          <p className="cert-body"><b>{fmt(c.xp || 0)} {t("ball")}</b></p>
        </>}
        <footer className="cert-foot">
          <div className="cert-sign">
            <Seal year={String(c.issued_at || "").slice(0, 4)} serial={c.id} />
            <div><i>{c.signer}</i><span>{t("Hakamlar hay'ati nomidan")}</span><span>{t("Berilgan sana: {d}", { d: dd(c.issued_at) })}</span></div>
          </div>
          <div className="cert-qr">{qr && <img src={qr} alt={t("Tekshirish QR kodi")} />}<span>{t("Skanerlang — haqiqiyligini tekshiring")}</span></div>
        </footer>
        <p className="cert-micro">№ {c.serial} · {t("Raqamli imzo")}: {c.sig} · {host()}/?v={c.id}</p>
      </div>
    </article>);
}

function CertOpen({ id, onBack }: { id: string; onBack: () => void }) {
  const c = useCert(id);
  const share = async () => { const url = verifyUrl(id); try { if (navigator.share) await navigator.share({ title: t("Sertifikat"), url }); else { await navigator.clipboard.writeText(url); toast(t("Havola nusxalandi")); } } catch { /* bekor qilindi */ } };
  return (
    <div className="shell bare cert-page"><PageTitle title={t("Sertifikat")} onBack={onBack} />
      {c === undefined ? <Empty>{t("Yuklanmoqda...")}</Empty> : c ? <CertPaper c={c} /> : <Empty>{t("Bunday sertifikat topilmadi")}</Empty>}
      <div className="dock noprint"><div className="row" style={{ gap: 10 }}>
        <button className="btn ghost" onClick={share}><Share2 size={18} />{t("Ulashish")}</button>
        <button className="btn" onClick={() => window.print()}><Printer size={18} />{t("PDF / chop etish")}</button></div></div></div>);
}

export function CertView() {
  const [sel, setSel] = useState<string | null>(null);
  const [list, setList] = useState<any[]>(S.certs || []);
  useEffect(() => { if (S.pid) rpc<any[]>("liga_my_certs", { p_id: S.pid }).then((r) => { if (r) { S.certs = r; persist(); setList(r); } }).catch(() => {}); }, []);
  const issue = async (kind: "all12") => {
    try { const r = (await rpc<any[]>("liga_cert_issue", { p_id: S.pid, p_token: S.token, p_kind: kind }))[0];
      const L = [r, ...list.filter((x: any) => x.id !== r.id)]; S.certs = L; persist(); setList(L); setSel(r.id); burst(); }
    catch (e) { toast(errMsg(e)); }
  };
  if (sel) return <CertOpen id={sel} onBack={() => setSel(null)} />;
  const head = (c: any) => { if (c.kind !== "week") return { place: 0, h: t("12 bosqich yakunlandi"), s: "" };
    const [pos, xp, w] = String(c.detail || "").split("|"); return { place: +pos, h: t("{n}-o'rin · {d}-hafta", { n: pos, d: weekNo(w) }), s: t("{x} ball · {d}", { x: fmt(+xp), d: dd(w) }) }; };
  return (
    <div className="shell bare">
      <PageTitle title={t("Sertifikatlar")} />
      <div className="stack">
        {Object.keys(S.stars).length >= 12 && !list.some((c: any) => c.kind === "all12") && <Card title={t("Olish mumkin")}>
          <button className="btn" onClick={() => issue("all12")}><Award size={18} />{t("12 bosqich sertifikati")}</button></Card>}
        <Card title={t("Mening sertifikatlarim")}>
          {list.length ? <div className="cert-list">{list.map((c: any) => { const x = head(c); return (
            <button key={c.id} className="cert-row" onClick={() => setSel(c.id)}>
              {x.place ? <Medal place={x.place} size={30} /> : <Award size={30} color="var(--stamp)" />}
              <span className="grow"><b>{x.h}</b><small>{x.s}</small><small className="mono">№ {c.id}</small></span></button>); })}</div>
            : <Empty>{t("Haftalik kuchli uchlikka kiring — juma kuni medal va QR kodli sertifikat avtomatik beriladi.")}</Empty>}
        </Card>
        <p className="small muted">{t("Har sertifikatda QR kod va raqamli imzo bor. Ish beruvchi QR ni skanerlasa, ma'lumot to'g'ridan-to'g'ri liga serveridan ko'rsatiladi.")}</p>
      </div>
    </div>);
}
export const weekNo = (w: string) => { const d = new Date(String(w || "").slice(0, 10) + "T00:00:00Z"); if (isNaN(+d)) return ""; const t0 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t0.getUTCDay() || 7; t0.setUTCDate(t0.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t0.getUTCFullYear(), 0, 1)); return Math.ceil(((+t0 - +y0) / 864e5 + 1) / 7); };

/* ?v=ID — ochiq tekshiruv sahifasi (ro'yxatdan o'tish shart emas) */
export function Verify({ id }: { id: string }) {
  const c = useCert(id);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  const clock = now.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="shell bare verify">
      <div className="v-head"><Mark size={40} /><div><h1 className="disp">{t("Sertifikatni tekshirish")}</h1><span className="small muted">{host()}</span></div></div>
      {c === undefined ? <Empty>{t("Tekshirilmoqda...")}</Empty> : c ? <div className="stack">
        <section className="v-ok" id="v-ok">
          <div className="v-band" aria-hidden="true" />
          <div className="row" style={{ gap: 10 }}><ShieldCheck size={28} /><div className="grow"><b>{t("Sertifikat haqiqiy")}</b>
            <span>{t("Hisobchi Liga reyestrida mavjud · raqamli imzo mos")}</span></div></div>
          <div className="v-live"><Clock size={14} />{t("Jonli tekshiruv: {t} (Toshkent)", { t: clock })}</div>
        </section>
        <section className="card v-facts">
          <dl>
            <dt>{t("Egasi")}</dt><dd>{c.name}</dd>
            {c.kind === "week" && <><dt>{t("Natija")}</dt><dd>{t("{n}-o'rin", { n: c.place })} · {fmt(c.xp)} {t("ball")} · {t("{p} ishtirokchidan", { p: c.participants })}</dd>
              <dt>{t("Hafta")}</dt><dd>{t("{n}-hafta", { n: c.week?.no })}: {dd(c.week?.from)} – {dd(c.week?.to)}</dd></>}
            {c.team && <><dt>{t("Jamoa")}</dt><dd>{c.team}</dd></>}
            <dt>{t("Berilgan")}</dt><dd>{dd(c.issued_at)}</dd>
            <dt>{t("Seriya")}</dt><dd className="mono">{c.serial}</dd>
            <dt>{t("Raqamli imzo")}</dt><dd className="mono"><Fingerprint size={14} style={{ verticalAlign: "-2px" }} /> {c.sig}</dd>
          </dl>
        </section>
        {c.peers?.length > 0 && <section className="card">
          <h3>{t("Shu haftaning kuchli uchligi")}</h3>
          <ol className="v-peers">{c.peers.map((p: any) => (
            <li key={p.pos} className={p.me ? "me" : ""}><Medal place={p.pos} size={24} /><span className="grow">{p.n}</span>
              {p.cert && !p.me ? <a href={verifyUrl(p.cert)} className="mono small">№ {p.cert}</a> : p.me ? <span className="chip blue">{t("shu sertifikat")}</span> : null}</li>))}</ol>
        </section>}
        <CertPaper c={c} />
        <p className="small muted">{t("Ishonch uchun: tekshiruv faqat {h} manzilida o'tkaziladi. Boshqa saytdagi «tekshiruv» sahifasiga ishonmang.", { h: host() })}</p>
      </div>
        : <section className="v-bad" id="v-bad"><ShieldX size={28} /><div><b>{t("Bunday sertifikat topilmadi")}</b>
          <span>{t("Raqam noto'g'ri yoki sertifikat soxta. Asl sertifikatning QR kodini qayta skanerlang.")}</span></div></section>}
    </div>);
}
