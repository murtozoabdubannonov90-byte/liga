/* Qurilmadagi xatolarni serverga yozish (liga_client_err) — qaysi telefonda nima buzilayotganini ko'rish uchun.
   Bir sessiyada ko'pi bilan 5 ta, takrorlanmasdan. */
const SUPA = "https://bopzjxboembvcqycfwin.supabase.co/rest/v1/rpc/liga_client_err";
const KEY = "sb_publishable_DWSUYhML5IH5cOksXdlCDA_SNt6c9Dm";
const sent = new Set<string>();
export function reportErr(msg: string, stack?: string) {
  try {
    const m = String(msg || "").slice(0, 400); if (!m || sent.has(m) || sent.size >= 5) return; sent.add(m);
    const w = window as any, tg = w.Telegram?.WebApp;
    const body = JSON.stringify({ p_msg: m, p_stack: String(stack || "").slice(0, 1500), p_ua: navigator.userAgent.slice(0, 300),
      p_where: (location.pathname + location.hash.replace(/tgWebAppData=[^&]*/, "tgWebAppData=…")).slice(0, 200),
      p_tg: tg ? String(tg.platform || "") + " " + String(tg.version || "") : "", p_ver: String(w.__ligaVer || "") });
    fetch(SUPA, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* */ }
}
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => reportErr(String(e.message || "error"), (e as any).error?.stack || `${e.filename}:${e.lineno}:${e.colno}`));
  window.addEventListener("unhandledrejection", (e: any) => { const r = e?.reason; if (/net_timeout|Failed to fetch|NetworkError|Load failed/i.test(String(r?.message || r))) return; reportErr("unhandled: " + String(r?.message || r), r?.stack); });
}
