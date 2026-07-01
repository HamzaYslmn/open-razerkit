// Shared localStorage state (last-applied color/effect per device, lang, prefs).
// The protocol can't read back the stored color, so we remember it here.
// ponytail: key stays "razer-rgb" (pre-rename) so existing users keep their saved state.
const KEY = "razer-rgb";

export const store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
store.perDevice = store.perDevice || {};   // hex pid -> { rgb, action }

export const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private mode / full */ } };
