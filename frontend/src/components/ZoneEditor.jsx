import { useEffect, useRef, useState } from "react";
import { rgbToHex, parseColor, clamp, hex4 } from "../lib/color.js";
import { store, persist } from "../lib/store.js";
import { useT } from "../i18n/index.jsx";

// Per-zone mouse LED editor — each named zone (logo/scroll/strips) gets its own
// color, applied live and remembered per device. applyZone(led, rgb) does the HID.
export default function ZoneEditor({ zones, currentPid, accent, applyZone }) {
  const t = useT();
  const [zoneColors, setZoneColors] = useState({});   // { ledId: [r,g,b] }
  const zoneTimers = useRef({});

  // seed each zone from its saved color (or the accent) on device change
  useEffect(() => {
    const saved = (store.perDevice[hex4(currentPid ?? 0)] || {}).zones || {};
    const init = {};
    for (const z of zones) init[z.id] = Array.isArray(saved[z.id]) ? saved[z.id].map(clamp) : accent.slice();
    setZoneColors(init);
  }, [currentPid]); // eslint-disable-line react-hooks/exhaustive-deps

  const setZone = (id, rgb) => {
    rgb = rgb.map(clamp);
    setZoneColors((p) => ({ ...p, [id]: rgb }));
    clearTimeout(zoneTimers.current[id]);
    zoneTimers.current[id] = setTimeout(() => applyZone(id, rgb), 150);   // debounce picker drag
    if (currentPid != null) {
      const key = hex4(currentPid), d = store.perDevice[key] || (store.perDevice[key] = {});
      d.zones = { ...(d.zones || {}), [id]: rgb };
      persist();
    }
  };
  const zonesToAccent = () => { for (const z of zones) setZone(z.id, accent); };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] text-neutral-500">{t("zonesTitle")}</p>
        <button onClick={zonesToAccent} className="rounded-md bg-neutral-800 border border-neutral-700 hover:border-emerald-500/60 px-2 py-0.5 text-[10px] font-semibold">{t("zonesAll")}</button>
      </div>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {zones.map((z) => {
          const c = zoneColors[z.id] || accent;
          return (
            <label key={z.id} className="flex items-center gap-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/60 px-2 py-1.5 cursor-pointer">
              <input type="color" value={rgbToHex(c)} onChange={(e) => setZone(z.id, parseColor(e.target.value))}
                     className="h-6 w-8 shrink-0 cursor-pointer rounded ring-1 ring-white/10" />
              <span className="text-xs font-medium text-neutral-200">{z.name}</span>
              <span className="ml-auto font-mono text-[10px] text-neutral-500">{rgbToHex(c).toUpperCase()}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
