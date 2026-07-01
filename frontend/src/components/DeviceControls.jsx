import { useState } from "react";
import { useT } from "../i18n/index.jsx";

// Onboard, fire-and-forget device toggles (the device doesn't reliably report
// these back, so we just reflect the last click). Shown per device category.
export default function DeviceControls({ category, onScrollMode, onScrollAccel, onSmartReel, onGameMode, onMacroMode }) {
  const t = useT();
  const [scroll, setScroll] = useState("");
  const [accel, setAccel] = useState(false);
  const [reel, setReel] = useState(false);
  const [game, setGame] = useState(false);
  const [macro, setMacro] = useState(false);

  const check = "h-3.5 w-3.5 accent-emerald-500";
  const rowLabel = "flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none";

  if (category === "mouse") {
    return (
      <div className="space-y-2.5">
        <label className="flex items-center justify-between gap-3 text-xs text-neutral-400">
          <span>{t("scrollLabel")}</span>
          <select value={scroll} onChange={(e) => { setScroll(e.target.value); if (e.target.value !== "") onScrollMode(+e.target.value); }}
                  className="rounded-md bg-neutral-800/80 border border-neutral-700 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none">
            <option value="">—</option>
            <option value="0">{t("scrollFree")}</option>
            <option value="1">{t("scrollTactile")}</option>
          </select>
        </label>
        <label className={rowLabel}>
          <input type="checkbox" checked={accel} onChange={(e) => { setAccel(e.target.checked); onScrollAccel(e.target.checked); }} className={check} />
          {t("accelLabel")}
        </label>
        <label className={rowLabel}>
          <input type="checkbox" checked={reel} onChange={(e) => { setReel(e.target.checked); onSmartReel(e.target.checked); }} className={check} />
          {t("smartReelLabel")}
        </label>
      </div>
    );
  }
  if (category === "keyboard") {
    return (
      <div className="space-y-2.5">
        <label className={rowLabel}>
          <input type="checkbox" checked={game} onChange={(e) => { setGame(e.target.checked); onGameMode(e.target.checked); }} className={check} />
          {t("gameModeLabel")}
        </label>
        <label className={rowLabel}>
          <input type="checkbox" checked={macro} onChange={(e) => { setMacro(e.target.checked); onMacroMode(e.target.checked); }} className={check} />
          {t("macroModeLabel")}
        </label>
      </div>
    );
  }
  return null;
}
