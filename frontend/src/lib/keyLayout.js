// Physical keyboard layout for standard full-size Razer boards (BlackWidow /
// Chroma class, LED matrix 6x22). Coords (r, c) are from openrazer's KEY_MAPPING
// (daemon/openrazer_daemon/keyboard.py). w = width units (default 1); gap = blank
// units before the key. Fn-layer/media aliases that reuse F-key cells are omitted.
export const KEYBOARD_6x22 = {
  rows: 6, cols: 22,
  layout: [
    [
      { label: "M6", r: 0, c: 0 }, { label: "Esc", r: 0, c: 1, gap: 0.5 },
      { label: "F1", r: 0, c: 3, gap: 1 }, { label: "F2", r: 0, c: 4 }, { label: "F3", r: 0, c: 5 }, { label: "F4", r: 0, c: 6 },
      { label: "F5", r: 0, c: 7, gap: 0.5 }, { label: "F6", r: 0, c: 8 }, { label: "F7", r: 0, c: 9 }, { label: "F8", r: 0, c: 10 },
      { label: "F9", r: 0, c: 11, gap: 0.5 }, { label: "F10", r: 0, c: 12 }, { label: "F11", r: 0, c: 13 }, { label: "F12", r: 0, c: 14 },
      { label: "PrtSc", r: 0, c: 15, gap: 0.5 }, { label: "ScrLk", r: 0, c: 16 }, { label: "Pause", r: 0, c: 17 },
      { label: "Logo", r: 0, c: 20, gap: 1.5 },
    ],
    [
      { label: "M1", r: 1, c: 0 }, { label: "`", r: 1, c: 1, gap: 0.5 },
      { label: "1", r: 1, c: 2 }, { label: "2", r: 1, c: 3 }, { label: "3", r: 1, c: 4 }, { label: "4", r: 1, c: 5 }, { label: "5", r: 1, c: 6 },
      { label: "6", r: 1, c: 7 }, { label: "7", r: 1, c: 8 }, { label: "8", r: 1, c: 9 }, { label: "9", r: 1, c: 10 }, { label: "0", r: 1, c: 11 },
      { label: "-", r: 1, c: 12 }, { label: "=", r: 1, c: 13 }, { label: "Backspace", r: 1, c: 14, w: 2 },
      { label: "Ins", r: 1, c: 15, gap: 0.5 }, { label: "Home", r: 1, c: 16 }, { label: "PgUp", r: 1, c: 17 },
      { label: "Num", r: 1, c: 18, gap: 0.5 }, { label: "/", r: 1, c: 19 }, { label: "*", r: 1, c: 20 }, { label: "-", r: 1, c: 21 },
    ],
    [
      { label: "M2", r: 2, c: 0 }, { label: "Tab", r: 2, c: 1, w: 1.5, gap: 0.5 },
      { label: "Q", r: 2, c: 2 }, { label: "W", r: 2, c: 3 }, { label: "E", r: 2, c: 4 }, { label: "R", r: 2, c: 5 }, { label: "T", r: 2, c: 6 },
      { label: "Y", r: 2, c: 7 }, { label: "U", r: 2, c: 8 }, { label: "I", r: 2, c: 9 }, { label: "O", r: 2, c: 10 }, { label: "P", r: 2, c: 11 },
      { label: "[", r: 2, c: 12 }, { label: "]", r: 2, c: 13 },
      { label: "Del", r: 2, c: 15, gap: 1.5 }, { label: "End", r: 2, c: 16 }, { label: "PgDn", r: 2, c: 17 },
      { label: "7", r: 2, c: 18, gap: 0.5 }, { label: "8", r: 2, c: 19 }, { label: "9", r: 2, c: 20 }, { label: "+", r: 2, c: 21 },
    ],
    [
      { label: "M3", r: 3, c: 0 }, { label: "Caps", r: 3, c: 1, w: 1.75, gap: 0.5 },
      { label: "A", r: 3, c: 2 }, { label: "S", r: 3, c: 3 }, { label: "D", r: 3, c: 4 }, { label: "F", r: 3, c: 5 }, { label: "G", r: 3, c: 6 },
      { label: "H", r: 3, c: 7 }, { label: "J", r: 3, c: 8 }, { label: "K", r: 3, c: 9 }, { label: "L", r: 3, c: 10 }, { label: ";", r: 3, c: 11 },
      { label: "'", r: 3, c: 12 }, { label: "#", r: 3, c: 13 }, { label: "Enter", r: 3, c: 14, w: 2.25 },
      { label: "4", r: 3, c: 18, gap: 3.5 }, { label: "5", r: 3, c: 19 }, { label: "6", r: 3, c: 20 },
    ],
    [
      { label: "M4", r: 4, c: 0 }, { label: "Shift", r: 4, c: 1, w: 1.25, gap: 0.5 },
      { label: "\\", r: 4, c: 2 }, { label: "Z", r: 4, c: 3 }, { label: "X", r: 4, c: 4 }, { label: "C", r: 4, c: 5 }, { label: "V", r: 4, c: 6 },
      { label: "B", r: 4, c: 7 }, { label: "N", r: 4, c: 8 }, { label: "M", r: 4, c: 9 }, { label: ",", r: 4, c: 10 }, { label: ".", r: 4, c: 11 },
      { label: "/", r: 4, c: 12 }, { label: "Shift", r: 4, c: 14, w: 2.75 },
      { label: "↑", r: 4, c: 16, gap: 1.5 },
      { label: "1", r: 4, c: 18, gap: 1.5 }, { label: "2", r: 4, c: 19 }, { label: "3", r: 4, c: 20 }, { label: "Enter", r: 4, c: 21 },
    ],
    [
      { label: "M5", r: 5, c: 0 }, { label: "Ctrl", r: 5, c: 1, w: 1.25, gap: 0.5 },
      { label: "Win", r: 5, c: 2, w: 1.25 }, { label: "Alt", r: 5, c: 3, w: 1.25 },
      { label: "Space", r: 5, c: 7, w: 6.25 },
      { label: "Alt", r: 5, c: 11, w: 1.25 }, { label: "Fn", r: 5, c: 12, w: 1.25 }, { label: "Menu", r: 5, c: 13, w: 1.25 }, { label: "Ctrl", r: 5, c: 14, w: 1.25 },
      { label: "←", r: 5, c: 15, gap: 0.5 }, { label: "↓", r: 5, c: 16 }, { label: "→", r: 5, c: 17 },
      { label: "0", r: 5, c: 19, w: 2, gap: 1.5 }, { label: ".", r: 5, c: 20 },
    ],
  ],
};

// Returns a labeled layout when the matrix matches one we have (6x22 full-size), else null.
export function layoutFor(matrix) {
  if (matrix && matrix.rows === 6 && matrix.cols === 22) return KEYBOARD_6x22;
  return null;
}
