/* Tarmoq so'rovi vaqt chegarasi bilan: sekin internetda ilova cheksiz «yuklanmoqda» bo'lib qolmasin */
export function fetchT(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const AC = (globalThis as any).AbortController;
  const ac = AC ? new AC() : null;
  return new Promise<Response>((res, rej) => {
    const tm = setTimeout(() => { try { ac?.abort(); } catch { /* */ } rej(new Error("net_timeout")); }, ms);
    fetch(url, ac ? { ...init, signal: ac.signal } : init).then((r) => { clearTimeout(tm); res(r); }, (e) => { clearTimeout(tm); rej(e); });
  });
}
/* 2026-11-13 trafik: jonli o'yin holatini moslashuvchan oraliqda so'rash (har 1 soniya emas).
   next() keyingi so'rovgacha millisekundni qaytaradi; ekran yashirin bo'lsa — kamida 5 soniya. Qaytgan funksiya — to'xtatish. */
export function pollLoop(fn: () => Promise<void>, next: () => number): () => void {
  let on = true, tm: any = null;
  const run = async () => {
    if (!on) return;
    try { await fn(); } catch { /* */ }
    if (!on) return;
    let ms = Math.max(800, next());
    if (typeof document !== "undefined" && document.visibilityState === "hidden") ms = Math.max(ms, 5000);
    tm = setTimeout(run, ms);
  };
  const wake = () => { if (on && document.visibilityState === "visible") { clearTimeout(tm); tm = setTimeout(run, 50); } };
  document.addEventListener("visibilitychange", wake);
  run();
  return () => { on = false; clearTimeout(tm); document.removeEventListener("visibilitychange", wake); };
}
/* holatga qarab oraliq: o'yin ketmoqda — 2 s; savol ochilishigacha / xona kutilmoqda — 3–20 s */
export function liveGap(x: any, playMs = 2000): number {
  if (!x) return 3000;
  if (x.status === "done") return 60000;
  if (x.status === "play") { const qi = Number(x.q_in) || 0; return qi > 0 ? Math.min(Math.max(qi + 150, 800), playMs) : playMs; }
  const oi = Number(x.opens_in) || 0;
  if (oi > 0) return oi > 60000 ? Math.min(20000, oi / 2) : Math.min(3000, oi + 200);
  return 3000;
}
