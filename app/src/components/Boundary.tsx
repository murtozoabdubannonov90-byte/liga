/* Ekranda kutilmagan xato bo'lsa — oq ekran o'rniga tushunarli xabar va «Qayta yuklash» tugmasi */
import { Component, type ReactNode } from "react";
import { reportErr } from "../lib/report";
import { t } from "../lib/i18n";

export async function hardReload() {
  try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch { /* */ }
  try { const rs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((rs || []).map((r) => r.unregister())); } catch { /* */ }
  location.reload();
}
export class Boundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: any) { return { err: String(e?.message || e) }; }
  componentDidCatch(e: any, info: any) { reportErr("render: " + String(e?.message || e), String(e?.stack || "") + "\n" + String(info?.componentStack || "").slice(0, 600)); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="shell bare" id="crash">
        <div className="card" style={{ margin: "40px 16px", textAlign: "center" }}>
          <h3 style={{ marginBottom: 8 }}>{t("Ilovada xatolik yuz berdi")}</h3>
          <p className="small muted" style={{ marginBottom: 14 }}>{t("Natijalaringiz saqlangan. «Qayta yuklash» tugmasini bosing.")}</p>
          <button className="btn" id="crash-reload" onClick={hardReload}>{t("Qayta yuklash")}</button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => { this.setState({ err: null }); try { (window as any).__liga?.nav?.tab("home"); } catch { /* */ } }}>{t("Bosh sahifaga qaytish")}</button>
        </div>
      </div>);
  }
}

/* Ekran ochilishi kerak bo'lgan narsa topilmasa — bo'sh oq ekran o'rniga xabar va «Bosh sahifa» tugmasi */
export function EmptyScreen({ text }: { text?: string }) {
  return (
    <div className="shell bare" id="empty-screen">
      <div className="card" style={{ margin: "40px 16px", textAlign: "center" }}>
        <p style={{ fontWeight: 700, marginBottom: 14 }}>{text || t("Bu sahifa ochilmadi.")}</p>
        <button className="btn" id="empty-home" onClick={() => { try { (window as any).__liga?.nav?.tab("home"); } catch { location.reload(); } }}>{t("Bosh sahifaga qaytish")}</button>
      </div>
    </div>);
}
