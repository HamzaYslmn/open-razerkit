import { useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { store, persist } from "../lib/store.js";
import { rgbToHex } from "../lib/color.js";

const html = (s) => ({ dangerouslySetInnerHTML: { __html: s } });

// Named lighting profiles: snapshot of store.perDevice, kept in localStorage.
// "default" sorts first — it's the one the CLI watcher treats as the fallback.
export default function ProfilesCard({ onApply, getSnapshot, toast }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [, bump] = useState(0);
  const profiles = store.profiles || {};
  const names = Object.keys(profiles).sort((a, b) =>
    a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b));

  const save = () => {
    const n = name.trim().toLowerCase();
    if (!n) { toast(t("profNeedName"), "warn"); return; }
    const snap = getSnapshot();
    if (!snap) { toast(t("profNothing"), "warn"); return; }
    store.profiles = { ...profiles, [n]: snap };
    persist(); setName(""); bump((x) => x + 1);
  };
  const del = (n) => {
    const next = { ...profiles };
    delete next[n];
    store.profiles = next;
    persist(); bump((x) => x + 1);
  };

  return (
    <section>
      <p {...html(t("profHelp"))} className="mb-3 text-[11px] leading-relaxed text-neutral-500" />
      <div className="mb-3 flex gap-2">
        <input type="text" value={name} placeholder={t("profNamePh")} maxLength={24}
               onChange={(e) => setName(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") save(); }}
               className="flex-1 rounded-md bg-neutral-800/80 border border-neutral-700 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" />
        <button onClick={save} className="rounded-md bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 text-sm font-semibold">{t("profSave")}</button>
      </div>
      {!names.length && <p className="text-[11px] text-neutral-500">{t("profNone")}</p>}
      {names.map((n) => {
        const entries = Object.entries(profiles[n] || {});
        return (
          <div key={n} className="mb-1.5 flex items-center gap-2 rounded-md border border-white/5 bg-neutral-800/40 px-2.5 py-1.5">
            <span className="flex gap-1">
              {entries.slice(0, 4).map(([pid, ent]) => (
                <span key={pid} title={`1532:${pid}`} className="h-3.5 w-3.5 rounded-sm ring-1 ring-inset ring-white/15"
                      style={{ background: Array.isArray(ent?.rgb) ? rgbToHex(ent.rgb) : "#333" }} />
              ))}
            </span>
            <span className="flex-1 truncate text-sm font-semibold text-neutral-200">{n}</span>
            <span className="text-[10px] font-mono text-neutral-500">{t("profDevices", { n: entries.length })}</span>
            <button onClick={() => onApply(n)} className="rounded bg-emerald-600/90 hover:bg-emerald-500 px-2.5 py-1 text-xs font-bold text-black">{t("profApply")}</button>
            <button onClick={() => del(n)} className="rounded bg-neutral-700/70 hover:bg-red-900/70 px-2 py-1 text-xs font-semibold text-neutral-300">{t("profDelete")}</button>
          </div>
        );
      })}
    </section>
  );
}
