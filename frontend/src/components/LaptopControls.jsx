import { useState } from "react";
import { useT } from "../i18n/index.jsx";

// Razer Blade performance-mode / battery controls (HID, via the keyboard MCU).
// Performance mode drives the firmware fan curve — no manual fan-rpm knob (thermal
// safety). `verified` = this model's opcodes are confirmed (Blade 16 2024); other
// Blades stay disabled until the user opts in with "force" (opcodes are model-specific).
export default function LaptopControls({ verified, onPerf, onCharge }) {
  const t = useT();
  const [force, setForce] = useState(false);
  const [charge, setCharge] = useState("80");
  const enabled = verified || force;

  const btn = "rounded-lg bg-neutral-800/70 border border-neutral-700 hover:border-emerald-500/60 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
  const setBtn = "rounded-md bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
  const inp = "w-24 rounded-md bg-neutral-800/80 border border-neutral-700 px-2.5 py-1.5 text-sm font-mono focus:border-emerald-500 focus:outline-none";

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-300/90">
        {t("bladeWarn")}
      </p>

      {!verified && (
        <label className="flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer select-none">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-3.5 w-3.5 accent-amber-500" />
          {t("bladeForce")}
        </label>
      )}

      <fieldset disabled={!enabled} className="contents">
        <div>
          <p className="mb-1.5 text-[11px] text-neutral-500">{t("bladePerf")}</p>
          <div className="flex flex-wrap gap-2">
            {["balanced", "gaming", "creator"].map((m) => (
              <button key={m} onClick={() => onPerf(m)} className={btn}>{t("perf_" + m)}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] text-neutral-500">{t("bladeCharge")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min={50} max={95} step={5} value={charge}
                   onChange={(e) => setCharge(e.target.value)} className={inp} />
            <button onClick={() => onCharge(charge)} className={setBtn}>{t("setBtn")}</button>
            <button onClick={() => onCharge("off")} className={btn}>{t("bladeChargeOff")}</button>
            <span className="text-[10px] text-neutral-600">50–95%</span>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
