/* Telegram Mini App bilan ishlash (Telegram tashqarisida ham xatosiz ishlaydi) */
type WA = any;
export const W: WA = (typeof window !== "undefined" && (window as any).Telegram && (window as any).Telegram.WebApp) || null;
export const inTelegram = !!(W && W.initData);
export const BOT = "Buxgalterlar_Ligasi_bot";
export const BOT_LINK = "https://t.me/" + BOT;
export const APP_LINK = "https://murtozoabdubannonov90-byte.github.io/liga/";

export function tgInit(dark: boolean) {
  if (!inTelegram) return;
  try {
    W.ready(); W.expand();
    if (W.isVersionAtLeast && W.isVersionAtLeast("7.7")) W.disableVerticalSwipes?.();
    const bg = dark ? "#0B1915" : "#EEF3F0";
    W.setHeaderColor?.(bg); W.setBackgroundColor?.(bg);
    if (W.isVersionAtLeast && W.isVersionAtLeast("7.10")) W.setBottomBarColor?.(bg);
  } catch { /* eski versiya */ }
}
export const tgDark = () => !!(W && W.colorScheme === "dark");
export const tgUser = () => (W && W.initDataUnsafe && W.initDataUnsafe.user) || null;
export const startParam = (): string => (W && W.initDataUnsafe && W.initDataUnsafe.start_param) || "";

export function haptic(kind: "ok" | "bad" | "tap" | "warn") {
  try {
    const h = W && W.HapticFeedback;
    if (h && inTelegram) {
      if (kind === "tap") h.impactOccurred("light");
      else h.notificationOccurred(kind === "ok" ? "success" : kind === "bad" ? "error" : "warning");
      return;
    }
    if (navigator.vibrate) navigator.vibrate(kind === "bad" ? [40, 40, 60] : kind === "ok" ? 25 : 10);
  } catch { /* yo'q */ }
}

let backCb: (() => void) | null = null;
export function setBack(cb: (() => void) | null) {
  if (!inTelegram || !W.BackButton) return;
  try {
    if (backCb) W.BackButton.offClick(backCb);
    backCb = cb;
    if (cb) { W.BackButton.onClick(cb); W.BackButton.show(); } else W.BackButton.hide();
  } catch { /* */ }
}

/* Telegram havolasini ochish */
export function openTg(url: string) {
  try { if (inTelegram && W.openTelegramLink) { W.openTelegramLink(url); return; } } catch { /* */ }
  openUrl(url);
}
export function openUrl(url: string) {
  try { if (inTelegram && W.openLink) { W.openLink(url); return; } } catch { /* */ }
  const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
}
/* bosh ekranga ikonka (Telegram 8.0+) */
export const canHomeScreen = () => !!(inTelegram && W.isVersionAtLeast && W.isVersionAtLeast("8.0") && W.addToHomeScreen);
export function addToHomeScreen() { try { W.addToHomeScreen(); } catch { /* */ } }
/* butun ekran rejimi */
export const canFullscreen = () => !!(inTelegram && W.isVersionAtLeast && W.isVersionAtLeast("8.0") && W.requestFullscreen);
export function toggleFullscreen() { try { W.isFullscreen ? W.exitFullscreen() : W.requestFullscreen(); } catch { /* */ } }
/* tayyorlangan xabarni ulashish (Bot API 8.0) */
export function shareMessage(id: string): Promise<boolean> {
  return new Promise((res) => {
    try { W.shareMessage(id, (ok: boolean) => res(!!ok)); } catch { res(false); }
  });
}
export const canShareMessage = () => !!(inTelegram && W.isVersionAtLeast && W.isVersionAtLeast("8.0") && W.shareMessage);
