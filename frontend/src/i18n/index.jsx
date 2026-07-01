// React i18n: a context provider + hooks. Components call useT()/useI18n()
// instead of receiving `t` as a prop. Two dicts (en/tr), no external library.
// ponytail: HTML_KEYS render via dangerouslySetInnerHTML — our own static
// translations, never user input.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { EN } from "./en.js";
import { TR } from "./tr.js";
import { store, persist } from "../lib/store.js";

const DICTS = { en: EN, tr: TR };

export const HTML_KEYS = new Set([
  "unsupported", "s1Tip", "saveTip", "advHelp",
  "faqA1", "faqA2", "faqA3", "faqA4",
]);

// Imperative form for the few places that need the current lang inside a
// long-lived closure (e.g. HID event listeners registered once on mount).
export function makeT(lang) {
  const dict = DICTS[lang] || EN;
  return (key, vars) => {
    let s = dict[key] != null ? dict[key] : (EN[key] != null ? EN[key] : key);
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    return s;
  };
}

const detect = () => (store.lang
  || ((navigator.languages || [navigator.language || ""]).some((l) => l && l.toLowerCase().startsWith("tr")) ? "tr" : "en"));

const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detect);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l) => { setLangState(l); store.lang = l; persist(); };
  const value = useMemo(() => ({ t: makeT(lang), lang, setLang }), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
export const useT = () => useContext(I18nCtx).t;
