import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/app.css";
import App from "./App";
import { boot } from "./boot";

boot();
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
/* testlar uchun ichki kirish */
import * as nav from "./lib/nav";
import * as st from "./engine/state";
import * as run from "./engine/run";
import * as score from "./engine/score";
import * as time from "./engine/time";
(window as any).__liga = { nav, st, run, score, time };
