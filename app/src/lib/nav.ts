/* Ekranlar orasida yurish (oddiy stek) + toast */
import { useSyncExternalStore } from "react";
import { setBack } from "./tg";

export interface Route { name: string; p?: any; key: number }
let stack: Route[] = [{ name: "home", key: 0 }];
let toastMsg: { text: string; id: number } | null = null;
let n = 1, ver = 0;
const subs = new Set<() => void>();
const emit = () => { ver++; subs.forEach((f) => f()); syncBack(); };
export function useNav() { useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => ver); return { route: stack[stack.length - 1], depth: stack.length, toast: toastMsg }; }
const TABS = new Set(["home", "rate", "learn", "profile"]);
export const isTab = (name: string) => TABS.has(name);
export function go(name: string, p?: any) { stack.push({ name, p, key: n++ }); window.scrollTo(0, 0); emit(); }
export function replace(name: string, p?: any) { stack[stack.length - 1] = { name, p, key: n++ }; window.scrollTo(0, 0); emit(); }
export function tab(name: string) { stack = [{ name, key: n++ }]; window.scrollTo(0, 0); emit(); }
export function back() { if (stack.length > 1) stack.pop(); else stack = [{ name: "home", key: n++ }]; window.scrollTo(0, 0); emit(); }
export const current = () => stack[stack.length - 1];
let backGuard: (() => boolean) | null = null;   // savol paytida chiqishni tasdiqlash
export const setBackGuard = (f: (() => boolean) | null) => { backGuard = f; };
export const tryBack = () => { if (backGuard && !backGuard()) return; back(); };
function syncBack() { const r = stack[stack.length - 1]; setBack(stack.length > 1 || !isTab(r.name) ? tryBack : null); }
let tt: any = null;
export function toast(text: string) { toastMsg = { text, id: n++ }; emit(); clearTimeout(tt); tt = setTimeout(() => { toastMsg = null; emit(); }, 2600); }
export const refresh = () => emit();
/* Android ilovasi (Capacitor): telefonning «Orqaga» tugmasi — ichki sahifalardan orqaga, bosh sahifada ilovadan chiqish */
export function nativeBack() {
  const C = (window as any).Capacitor; if (!C?.isNativePlatform?.()) return;
  import("@capacitor/app").then(({ App }) => App.addListener("backButton", () => {
    const r = stack[stack.length - 1];
    if (stack.length > 1 || !isTab(r.name)) tryBack(); else if (r.name !== "home") tab("home"); else App.exitApp();
  })).catch(() => {});
}
