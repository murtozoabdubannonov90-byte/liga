/* Tarmoq so'rovi vaqt chegarasi bilan: sekin internetda ilova cheksiz «yuklanmoqda» bo'lib qolmasin */
export function fetchT(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const AC = (globalThis as any).AbortController;
  const ac = AC ? new AC() : null;
  return new Promise<Response>((res, rej) => {
    const tm = setTimeout(() => { try { ac?.abort(); } catch { /* */ } rej(new Error("net_timeout")); }, ms);
    fetch(url, ac ? { ...init, signal: ac.signal } : init).then((r) => { clearTimeout(tm); res(r); }, (e) => { clearTimeout(tm); rej(e); });
  });
}
