import { useEffect, useRef } from "react";
import { rgbToHex } from "../lib/color.js";

// Renders a physical keyboard from a layout; each key paints its matrix cell (r,c).
// cells = flat rows*cols of [r,g,b]; onPaint(r,c) is called on click/drag.
const U = 30; // px per key-width unit

export default function KeyboardLayout({ layout, cells, cols, onPaint }) {
  const painting = useRef(false);
  useEffect(() => {
    const up = () => (painting.current = false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const cellAt = (r, c) => cells[r * cols + c] || [0, 0, 0];
  // legend contrast: dark text on bright keys, light text on dark keys
  const labelColor = (r, c) => {
    const [rr, gg, bb] = cellAt(r, c);
    return (0.299 * rr + 0.587 * gg + 0.114 * bb) > 140 ? "#0a0a0a" : "#d4d4d8";
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="w-max select-none space-y-1 rounded-xl bg-neutral-950/60 p-2.5 ring-1 ring-black/50">
        {layout.layout.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map((k, ki) => (
              <button key={ki}
                      onPointerDown={() => { painting.current = true; onPaint(k.r, k.c); }}
                      onPointerEnter={() => { if (painting.current) onPaint(k.r, k.c); }}
                      title={`${k.label} — r${k.r} c${k.c}`}
                      className="keycap grid shrink-0 place-items-center rounded-[5px] text-[8.5px] font-semibold leading-none overflow-hidden"
                      style={{ height: U - 2, width: (k.w || 1) * U - 2, marginLeft: (k.gap || 0) * U, backgroundColor: rgbToHex(cellAt(k.r, k.c)), color: labelColor(k.r, k.c) }}>
                {k.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
