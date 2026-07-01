// Color helpers + parsing (shared by the UI and the apply path).
import { anyRGB } from "./protocol.js";

export const clamp = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
export const hex4 = (p) => p.toString(16).padStart(4, "0");
export const rgbToHex = (rgb) => "#" + rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");

export const QUICK = [["red", [255, 0, 0]], ["green", [0, 255, 0]], ["blue", [0, 0, 255]],
  ["white", [255, 255, 255]], ["yellow", [255, 255, 0]], ["cyan", [0, 255, 255]],
  ["magenta", [255, 0, 255]], ["orange", [255, 80, 0]]];
export const NAMED = Object.assign({ off: [0, 0, 0], black: [0, 0, 0], purple: [128, 0, 128] }, Object.fromEntries(QUICK));

export function parseColor(s) {
  const t = String(s).trim().replace(/^#/, "").toLowerCase();
  if (t in NAMED) return NAMED[t].slice();
  if (String(s).includes(",")) {
    const parts = String(s).split(",");
    if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p.trim()) && +p >= 0 && +p <= 255)) return parts.map((p) => +p);
  }
  if (/^[0-9a-f]{6}$/.test(t)) return [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16));
  throw new Error(`bad color '${s}' (use ff0000, '255,0,0', or a name)`);
}

export function describe(action, rgb) {
  if (action === "static" || (action === "breathing" && anyRGB(rgb)))
    return rgbToHex(rgb) + (action === "breathing" ? " breathing" : "");
  return action;
}
