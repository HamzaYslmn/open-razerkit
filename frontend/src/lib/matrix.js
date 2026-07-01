// GENERATED from openrazer daemon hardware defs — matrix dimensions + LED zones.
// Plus small helpers with safe fallbacks. Single-LED ([1,1]) devices are absent
// from MATRIX (use ZONES or a solid color instead).
import { getDevice } from "./devices.js";

// pid -> { rows, cols }
export const MATRIX = {
  0x0044: { rows: 1, cols: 15 }, 0x0045: { rows: 1, cols: 15 }, 0x0046: { rows: 1, cols: 16 },
  0x004c: { rows: 1, cols: 21 }, 0x0050: { rows: 1, cols: 3 }, 0x0053: { rows: 1, cols: 3 },
  0x0059: { rows: 1, cols: 16 }, 0x005a: { rows: 1, cols: 16 }, 0x005c: { rows: 1, cols: 2 },
  0x0060: { rows: 1, cols: 16 }, 0x0064: { rows: 1, cols: 2 }, 0x0068: { rows: 1, cols: 17 },
  0x006c: { rows: 1, cols: 20 }, 0x006f: { rows: 1, cols: 16 }, 0x0070: { rows: 1, cols: 16 },
  0x0072: { rows: 1, cols: 16 }, 0x0073: { rows: 1, cols: 16 }, 0x0085: { rows: 1, cols: 2 },
  0x0086: { rows: 1, cols: 14 }, 0x0088: { rows: 1, cols: 14 }, 0x008d: { rows: 1, cols: 3 },
  0x008f: { rows: 1, cols: 3 }, 0x0090: { rows: 1, cols: 3 }, 0x0096: { rows: 1, cols: 2 },
  0x0099: { rows: 1, cols: 11 }, 0x00a4: { rows: 1, cols: 8 }, 0x00a7: { rows: 1, cols: 3 },
  0x00a8: { rows: 1, cols: 3 }, 0x00aa: { rows: 1, cols: 13 }, 0x00ab: { rows: 1, cols: 13 },
  0x00cb: { rows: 1, cols: 13 }, 0x00cc: { rows: 1, cols: 13 }, 0x00cd: { rows: 1, cols: 13 },
  0x00d6: { rows: 1, cols: 12 }, 0x00d7: { rows: 1, cols: 12 },
  0x0203: { rows: 6, cols: 22 }, 0x0204: { rows: 1, cols: 12 }, 0x0205: { rows: 6, cols: 22 },
  0x0207: { rows: 5, cols: 22 }, 0x0209: { rows: 6, cols: 22 }, 0x020f: { rows: 6, cols: 16 },
  0x0210: { rows: 6, cols: 22 }, 0x0211: { rows: 6, cols: 22 }, 0x0214: { rows: 6, cols: 22 },
  0x0216: { rows: 6, cols: 22 }, 0x0217: { rows: 6, cols: 22 }, 0x021a: { rows: 6, cols: 22 },
  0x021e: { rows: 6, cols: 22 }, 0x021f: { rows: 6, cols: 22 }, 0x0220: { rows: 6, cols: 16 },
  0x0221: { rows: 6, cols: 22 }, 0x0224: { rows: 6, cols: 16 }, 0x0225: { rows: 6, cols: 25 },
  0x0226: { rows: 9, cols: 22 }, 0x0227: { rows: 6, cols: 22 }, 0x0228: { rows: 6, cols: 22 },
  0x022a: { rows: 6, cols: 22 }, 0x022b: { rows: 4, cols: 6 }, 0x022c: { rows: 6, cols: 22 },
  0x022d: { rows: 6, cols: 16 }, 0x022f: { rows: 6, cols: 25 }, 0x0232: { rows: 6, cols: 16 },
  0x0233: { rows: 6, cols: 16 }, 0x0234: { rows: 6, cols: 16 }, 0x0237: { rows: 6, cols: 22 },
  0x023a: { rows: 6, cols: 16 }, 0x0240: { rows: 6, cols: 16 }, 0x0241: { rows: 6, cols: 22 },
  0x0243: { rows: 6, cols: 18 }, 0x0244: { rows: 1, cols: 21 }, 0x0245: { rows: 6, cols: 16 },
  0x024b: { rows: 6, cols: 16 }, 0x024c: { rows: 6, cols: 16 }, 0x024d: { rows: 6, cols: 16 },
  0x024e: { rows: 6, cols: 22 }, 0x0253: { rows: 6, cols: 16 }, 0x0256: { rows: 6, cols: 16 },
  0x0257: { rows: 5, cols: 15 }, 0x0258: { rows: 5, cols: 16 }, 0x025a: { rows: 6, cols: 22 },
  0x025c: { rows: 6, cols: 22 }, 0x025d: { rows: 6, cols: 22 }, 0x025e: { rows: 6, cols: 22 },
  0x0266: { rows: 8, cols: 22 }, 0x0269: { rows: 5, cols: 15 }, 0x026b: { rows: 6, cols: 18 },
  0x026c: { rows: 6, cols: 22 }, 0x026d: { rows: 6, cols: 16 }, 0x026e: { rows: 6, cols: 16 },
  0x0270: { rows: 6, cols: 16 }, 0x0271: { rows: 5, cols: 16 }, 0x0276: { rows: 6, cols: 16 },
  0x0279: { rows: 6, cols: 16 }, 0x0282: { rows: 5, cols: 15 }, 0x0287: { rows: 8, cols: 23 },
  0x028a: { rows: 6, cols: 16 }, 0x028b: { rows: 6, cols: 16 }, 0x028c: { rows: 6, cols: 16 },
  0x028d: { rows: 8, cols: 23 }, 0x028f: { rows: 1, cols: 10 }, 0x0290: { rows: 6, cols: 22 },
  0x0292: { rows: 6, cols: 22 }, 0x0293: { rows: 6, cols: 22 }, 0x0295: { rows: 6, cols: 22 },
  0x0296: { rows: 6, cols: 17 }, 0x0298: { rows: 6, cols: 17 }, 0x029d: { rows: 6, cols: 16 },
  0x029e: { rows: 6, cols: 16 }, 0x029f: { rows: 6, cols: 16 }, 0x02a0: { rows: 6, cols: 16 },
  0x02a1: { rows: 1, cols: 10 }, 0x02a3: { rows: 1, cols: 8 }, 0x02a5: { rows: 6, cols: 16 },
  0x02a6: { rows: 6, cols: 22 }, 0x02a7: { rows: 6, cols: 22 }, 0x02b0: { rows: 5, cols: 15 },
  0x02b6: { rows: 6, cols: 16 }, 0x02b8: { rows: 6, cols: 16 }, 0x02b9: { rows: 5, cols: 14 },
  0x02ba: { rows: 5, cols: 14 }, 0x02c5: { rows: 6, cols: 16 }, 0x02c6: { rows: 6, cols: 17 },
  0x02c7: { rows: 6, cols: 19 }, 0x02cf: { rows: 6, cols: 22 }, 0x02d5: { rows: 6, cols: 18 },
  0x02d7: { rows: 6, cols: 18 }, 0x0a24: { rows: 6, cols: 18 },
  0x0517: { rows: 2, cols: 24 }, 0x0518: { rows: 2, cols: 8 },
  0x0c00: { rows: 1, cols: 15 }, 0x0c04: { rows: 1, cols: 19 }, 0x0c05: { rows: 1, cols: 19 },
  0x0c08: { rows: 1, cols: 17 }, 0x0f07: { rows: 1, cols: 15 }, 0x0f08: { rows: 1, cols: 15 },
  0x0f09: { rows: 4, cols: 16 }, 0x0f0d: { rows: 1, cols: 16 }, 0x0f13: { rows: 4, cols: 16 },
  0x0f17: { rows: 1, cols: 20 }, 0x0f19: { rows: 1, cols: 4 }, 0x0f1d: { rows: 1, cols: 8 },
  0x0f1f: { rows: 6, cols: 80 }, 0x0f20: { rows: 1, cols: 8 }, 0x0f21: { rows: 1, cols: 12 },
  0x0f26: { rows: 1, cols: 10 }, 0x0f2b: { rows: 1, cols: 15 },
};

const SCROLL = { id: 0x01, name: "Scroll wheel" }, LOGO = { id: 0x04, name: "Logo" };
const BACKLIT = { id: 0x05, name: "Backlight" }, LEFT = { id: 0x11, name: "Left" }, RIGHT = { id: 0x10, name: "Right" };

// pid -> [{ id, name }] addressable LED zones (multi-zone devices)
export const ZONES = {
  0x0013: [SCROLL, LOGO], 0x0015: [SCROLL, LOGO, BACKLIT], 0x0016: [SCROLL, LOGO],
  0x002e: [SCROLL, LOGO, BACKLIT], 0x002f: [SCROLL, LOGO], 0x0034: [SCROLL, LOGO],
  0x0036: [SCROLL, LOGO], 0x0037: [SCROLL, LOGO], 0x003e: [SCROLL, BACKLIT], 0x003f: [SCROLL, BACKLIT],
  0x0040: [SCROLL, LOGO, BACKLIT], 0x0041: [SCROLL, LOGO], 0x0043: [SCROLL, LOGO],
  0x0048: [SCROLL, BACKLIT], 0x004f: [SCROLL, LOGO], 0x0050: [SCROLL, LOGO, BACKLIT],
  0x0053: [SCROLL, LOGO, BACKLIT], 0x0054: [SCROLL, LOGO], 0x0059: [SCROLL, LOGO, LEFT, RIGHT],
  0x005a: [SCROLL, LOGO, LEFT, RIGHT], 0x005b: [SCROLL, LOGO], 0x005c: [SCROLL, LOGO],
  0x0060: [SCROLL, LOGO, LEFT, RIGHT], 0x0064: [SCROLL, LOGO], 0x006c: [SCROLL, LOGO, LEFT, RIGHT],
  0x006e: [SCROLL, LOGO], 0x006f: [SCROLL, LOGO, LEFT, RIGHT], 0x0070: [SCROLL, LOGO, LEFT, RIGHT],
  0x0071: [SCROLL, LOGO], 0x0072: [SCROLL, LOGO], 0x0073: [SCROLL, LOGO], 0x0084: [SCROLL, LOGO],
  0x0085: [SCROLL, LOGO], 0x0086: [SCROLL, LOGO, LEFT, RIGHT], 0x0088: [SCROLL, LOGO, LEFT, RIGHT],
  0x008d: [SCROLL, LOGO, RIGHT], 0x008f: [SCROLL, LOGO], 0x0090: [SCROLL, LOGO], 0x0096: [SCROLL, LEFT],
  0x0099: [SCROLL, LOGO], 0x00aa: [SCROLL, LOGO], 0x00ab: [SCROLL, LOGO], 0x00af: [SCROLL, LOGO],
  0x00b0: [SCROLL, LOGO], 0x00cb: [SCROLL, LOGO], 0x00cc: [SCROLL, LOGO], 0x00cd: [SCROLL, LOGO],
};

// Returns { rows, cols, guess?, demo? } or null (single-LED → use zones/solid).
export function matrixFor(pid) {
  if (pid != null && MATRIX[pid]) return MATRIX[pid];
  const d = pid != null ? getDevice(pid) : null;
  if (!d) return { rows: 6, cols: 22, demo: true };          // no device: show a demo grid
  if (d.category === "keyboard") return { rows: 6, cols: 22, guess: true };
  return null;                                                // mouse/other w/o known matrix
}

export function zonesFor(pid) {
  if (pid != null) return ZONES[pid] || null;
  return [SCROLL, LOGO, LEFT, RIGHT];   // demo (no device): preview the multi-zone mouse editor
}
