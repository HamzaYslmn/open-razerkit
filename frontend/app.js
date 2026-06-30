// WebHID transport + UI. Mirrors the CLI menu: pick a device, fire colors/effects.
// Globals from devices.js (DEVICES, DEFAULT_PID, getDevice) and protocol.js
// (razerReport, buildReports, anyRGB).

const VID = 0x1532;
const QUICK = [["red", [255, 0, 0]], ["green", [0, 255, 0]], ["blue", [0, 0, 255]],
               ["white", [255, 255, 255]], ["yellow", [255, 255, 0]], ["cyan", [0, 255, 255]],
               ["magenta", [255, 0, 255]], ["orange", [255, 80, 0]]];
const NAMED = Object.assign({ off: [0, 0, 0], black: [0, 0, 0], purple: [128, 0, 128] },
                            Object.fromEntries(QUICK));
const HZ = { 1: 1000, 2: 500, 3: 125 };

let devicesByPid = new Map();   // pid -> [HIDDevice, ...]
let currentPid = null;
let currentRGB = [0, 255, 136];
let save = true;

const $ = (id) => document.getElementById(id);
const hex4 = (p) => p.toString(16).padStart(4, "0");
const clamp = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
const rgbToHex = (rgb) => "#" + rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");

// --- local persistence (localStorage) ---------------------------------------
// The Razer protocol doesn't reliably expose the *stored* color for readback,
// so we remember the last-applied state here instead of asking the device.
const STORE_KEY = "razer-rgb";
const store = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } })();
store.perDevice = store.perDevice || {};   // hex pid -> { rgb, action }
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode / full */ } }

// --- color parsing (port of core.parse_color) --------------------------------
function parseColor(s) {
  const t = String(s).trim().replace(/^#/, "").toLowerCase();
  if (t in NAMED) return NAMED[t].slice();
  if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p.trim()) && +p >= 0 && +p <= 255))
      return parts.map((p) => +p);
  }
  if (/^[0-9a-f]{6}$/.test(t)) return [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16));
  throw new Error(`bad color '${s}' (use ff0000, '255,0,0', or a name)`);
}
function describe(action, rgb) {
  if (action === "static" || (action === "breathing" && anyRGB(rgb)))
    return rgbToHex(rgb) + (action === "breathing" ? " breathing" : "");
  return action;
}

// --- toasts ------------------------------------------------------------------
function toast(msg, kind = "ok") {
  const styles = {
    ok: "border-emerald-500/40 bg-emerald-950/80 text-emerald-100",
    err: "border-red-500/40 bg-red-950/80 text-red-100",
    warn: "border-amber-500/40 bg-amber-950/80 text-amber-100",
  };
  const t = document.createElement("div");
  t.className = `pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur transition-all duration-300 translate-x-3 opacity-0 ${styles[kind] || styles.ok}`;
  t.textContent = msg;
  $("toasts").appendChild(t);
  requestAnimationFrame(() => t.classList.remove("translate-x-3", "opacity-0"));
  setTimeout(() => { t.classList.add("translate-x-3", "opacity-0"); setTimeout(() => t.remove(), 320); },
            kind === "err" ? 6500 : 3000);
}
function setStatus(msg, kind) {
  const el = $("status");
  el.textContent = msg;
  el.className = "text-sm min-h-[1.25rem] font-mono " +
    (kind === "ok" ? "text-emerald-400" : kind === "err" ? "text-red-400" : "text-neutral-400");
}

// --- WebHID transport --------------------------------------------------------
function indexDevices(list) {
  devicesByPid = new Map();
  for (const d of list) {
    if (d.vendorId !== VID) continue;
    if (!devicesByPid.has(d.productId)) devicesByPid.set(d.productId, []);
    devicesByPid.get(d.productId).push(d);
  }
}
async function refresh() {
  try {
    indexDevices(navigator.hid ? await navigator.hid.getDevices() : []);
    renderDevices();
  } catch (e) { toast("device scan failed: " + e.message, "err"); }
}
async function requestDevices() {
  let granted;
  try { granted = await navigator.hid.requestDevice({ filters: [{ vendorId: VID }] }); }
  catch (e) { toast(e.message, "err"); return; }
  if (!granted.length) { toast("No device selected.", "warn"); return; }

  // Merge granted devices with already-permitted ones so a just-granted device
  // is NEVER lost to a getDevices() timing/return quirk (the old connect bug).
  const known = navigator.hid ? await navigator.hid.getDevices() : [];
  indexDevices([...new Set([...known, ...granted])]);

  const pid = granted[0].productId;
  if (devicesByPid.has(pid)) currentPid = pid;     // select what the user just picked
  renderDevices();

  if (currentPid == null) {
    const nm = granted[0].productName || `1532:${hex4(pid)}`;
    toast(`Granted ${nm}, but Chrome exposes no usable HID collection for it ` +
          `(its control interface is a protected mouse/keyboard collection). Use the CLI for this one.`, "err");
  } else {
    reflectDeviceColor(currentPid);   // show this device's last-known color
    toast(`Connected: ${getDevice(currentPid)?.name || granted[0].productName || hex4(pid)}`, "ok");
  }
}
async function sendReports(pid, reports) {
  const cands = devicesByPid.get(pid) || [];
  if (!cands.length) throw new Error(`no 1532:${hex4(pid)} granted -- click Connect`);
  let last = null;
  for (const dev of cands) {
    try {
      if (!dev.opened) await dev.open();
      for (const rep of reports) await dev.sendFeatureReport(0, rep);
      return;
    } catch (e) { last = e; }
  }
  throw new Error(`every granted collection rejected the report (last: ${last && last.message}). ` +
    `Chrome may be blocking this device's mouse collection (WebHID protected usage).`);
}
async function readHz(pid) {
  const req = razerReport(0x00, 0x85, 0x01, [], 0xFF);   // get polling rate
  for (const dev of devicesByPid.get(pid) || []) {
    try {
      if (!dev.opened) await dev.open();
      await dev.sendFeatureReport(0, req);
      const dv = await dev.receiveFeatureReport(0);
      if (dv.getUint8(0) === 0x02 && dv.getUint8(8)) {
        const code = dv.getUint8(8);
        return HZ[code] || (code >= 1 && code <= 8 ? Math.floor(1000 / code) : null);
      }
    } catch (e) { /* collection can't be read -- try next */ }
  }
  return null;
}

// --- apply (port of core.apply) ----------------------------------------------
async function applyAction(action, rgb) {
  if (currentPid == null) { toast("Connect a device first.", "warn"); return; }
  const dev = getDevice(currentPid);
  const ovTxn = (() => { const v = $("txnInput").value.trim(); return v ? parseInt(v, 16) : null; })();
  const ovLed = (() => { const v = $("ledInput").value.trim(); return v ? parseInt(v, 16) : null; })();
  let method, txn, led, label;
  if (dev) { method = dev.method; txn = ovTxn ?? dev.txn; led = ovLed ?? dev.led; label = dev.name; }
  else { method = "custom"; txn = ovTxn ?? 0x3f; led = ovLed ?? 0x00; label = `unknown 1532:${hex4(currentPid)}`; }

  let reports;
  try { reports = buildReports(method, action, rgb, txn, led, save); }
  catch (e) { setStatus(`${label}: ${e.message}`, "err"); toast(e.message, "err"); return; }
  try {
    await sendReports(currentPid, reports);
    setStatus(`OK  ${label} -> ${describe(action, rgb)}`, "ok");
    const key = hex4(currentPid);                       // remember this device's state
    store.perDevice[key] = { rgb: rgb ? rgb.map(clamp) : store.perDevice[key]?.rgb, action };
    if (rgb) store.lastRGB = rgb.map(clamp);
    store.lastPid = currentPid;
    persist();
  } catch (e) { setStatus(`${label}: ${e.message}`, "err"); toast(e.message, "err"); }
}

// --- debounced apply ---------------------------------------------------------
const DEBOUNCE_MS = 500;          // apply this long after the last edit (tune to taste)
let applyTimer = null;
function applyDebounced(action, rgb) {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => applyAction(action, rgb), DEBOUNCE_MS);
}
function applyNow(action, rgb) {   // discrete actions (swatch/effect/commit) -- no wait
  clearTimeout(applyTimer);
  applyAction(action, rgb);
}

// --- color sync (sliders <-> hex <-> rgb <-> picker <-> preview) -------------
// apply: false = preview only, true = preview + debounced apply (live editing).
function syncColor(rgb, apply) {
  currentRGB = rgb.map(clamp);
  const hex = rgbToHex(currentRGB);
  ["R", "G", "B"].forEach((ch, i) => { $("slider" + ch).value = currentRGB[i]; $("num" + ch).value = currentRGB[i]; });
  $("hexInput").value = hex.slice(1);
  $("rgbInput").value = currentRGB.join(", ");
  $("picker").value = hex;
  $("preview").style.background = hex;
  $("previewHex").textContent = `${hex.toUpperCase()}  ·  rgb(${currentRGB.join(", ")})`;
  if (apply) applyDebounced("static", currentRGB);
}

// --- rendering ---------------------------------------------------------------
function renderDevices() {
  const sel = $("deviceSelect"), dot = $("statusDot");
  const pids = [...devicesByPid.keys()].sort((a, b) => a - b);
  if (!pids.length) {
    sel.innerHTML = "<option>No devices -- click Connect</option>";
    currentPid = null; $("deviceMeta").textContent = "";
    dot.className = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-neutral-600";
    toggleEffects();
    return;
  }
  if (currentPid == null || !devicesByPid.has(currentPid))
    currentPid = (store.lastPid && devicesByPid.has(store.lastPid)) ? store.lastPid
               : pids.includes(DEFAULT_PID) ? DEFAULT_PID : pids[0];
  sel.innerHTML = pids.map((p) => {
    const d = getDevice(p), star = p === DEFAULT_PID ? " ★" : "";
    return `<option value="${p}" ${p === currentPid ? "selected" : ""}>${d ? d.name : "unknown model"} (1532:${hex4(p)})${star}</option>`;
  }).join("");
  dot.className = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-emerald-400 pulse-dot";
  renderMeta();
}
async function renderMeta() {
  const d = getDevice(currentPid), m = $("deviceMeta");
  const base = d ? `method ${d.method} · txn 0x${d.txn.toString(16)} · led 0x${d.led.toString(16)}`
                 : "unknown model · falls back to custom / txn 3f";
  m.textContent = base;
  toggleEffects();
  const hz = await readHz(currentPid);
  if (hz && getDevice(currentPid) === d) m.textContent = base + `  ·  ${hz} Hz`;
}
function reflectDeviceColor(pid) {
  // Show this device's last-known color (from localStorage) -- preview only, no apply.
  const d = store.perDevice[hex4(pid)];
  if (d && Array.isArray(d.rgb)) syncColor(d.rgb.map(clamp), false);
}
function toggleEffects() {
  const d = getDevice(currentPid);
  const canWave = d && d.method !== "custom" && d.method !== "logo";   // single-LED can't wave
  const w = $("fxWave");
  w.disabled = !canWave;
  w.classList.toggle("opacity-30", !canWave);
  w.classList.toggle("cursor-not-allowed", !canWave);
}
function buildColorGrid() {
  $("colorGrid").innerHTML = QUICK.map(([name, rgb]) => {
    const dark = name === "white" || name === "yellow";
    return `<button class="swatch rounded-xl px-2 py-3.5 text-xs font-bold capitalize ring-1 ring-inset ring-black/20 shadow-lg shadow-black/40 hover:ring-2 hover:ring-white/60 ${dark ? "text-black/80" : "text-white drop-shadow"}"
            style="background:rgb(${rgb.join(",")})" data-rgb="${rgb.join(",")}">${name}</button>`;
  }).join("");
  $("colorGrid").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { syncColor(b.dataset.rgb.split(",").map(Number), false); applyNow("static", currentRGB); }));
}
function buildSliders() {
  const meta = [["R", "#ef4444"], ["G", "#22c55e"], ["B", "#3b82f6"]];
  $("sliders").innerHTML = meta.map(([ch, col], i) => `
    <div class="flex items-center gap-3">
      <span class="w-3 text-xs font-bold" style="color:${col}">${ch}</span>
      <input id="slider${ch}" type="range" min="0" max="255" value="${currentRGB[i]}" class="flex-1" style="background:linear-gradient(90deg,#171717,${col})" />
      <input id="num${ch}" type="number" min="0" max="255" value="${currentRGB[i]}" class="w-16 rounded-md bg-neutral-800/80 border border-neutral-700 px-2 py-1 text-sm font-mono text-center focus:border-emerald-500 focus:outline-none" />
    </div>`).join("");
  const readSliders = () => ["R", "G", "B"].map((ch) => clamp($("slider" + ch).value));
  const readNums = () => ["R", "G", "B"].map((ch) => clamp($("num" + ch).value));
  ["R", "G", "B"].forEach((ch) => {
    // drag: live preview + debounced apply (fires 500ms after you stop moving);
    // release: apply immediately so the final value lands without waiting.
    $("slider" + ch).addEventListener("input", () => syncColor(readSliders(), true));
    $("slider" + ch).addEventListener("change", () => applyNow("static", currentRGB));
    $("num" + ch).addEventListener("input", () => syncColor(readNums(), true));
    $("num" + ch).addEventListener("change", () => applyNow("static", currentRGB));
  });
}

// --- sponsor popup -----------------------------------------------------------
function wireSponsor() {
  const el = $("sponsor");
  if (!el) return;
  // Shows on every load (dismissal is not remembered). Close just hides it for this visit.
  $("sponsorClose").addEventListener("click", () => el.remove());
}

// --- init --------------------------------------------------------------------
function init() {
  wireSponsor();    // independent of WebHID support
  if (!navigator.hid) {
    $("unsupported").classList.remove("hidden");
    document.querySelectorAll("main button, main select, main input").forEach((e) => (e.disabled = true));
    return;
  }
  // restore last session from localStorage
  save = store.save ?? true;
  $("saveToggle").checked = save;
  if (typeof store.txn === "string") $("txnInput").value = store.txn;
  if (typeof store.led === "string") $("ledInput").value = store.led;
  if (Array.isArray(store.lastRGB)) currentRGB = store.lastRGB.map(clamp);

  buildColorGrid();
  buildSliders();
  syncColor(currentRGB, false);

  $("connectBtn").addEventListener("click", requestDevices);
  $("deviceSelect").addEventListener("change", (e) => { currentPid = +e.target.value; renderMeta(); reflectDeviceColor(currentPid); });
  $("saveToggle").addEventListener("change", (e) => { save = e.target.checked; store.save = save; persist(); });
  $("txnInput").addEventListener("change", () => { store.txn = $("txnInput").value.trim(); persist(); });
  $("ledInput").addEventListener("change", () => { store.led = $("ledInput").value.trim(); persist(); });
  $("picker").addEventListener("input", () => syncColor(parseColor($("picker").value), true));
  $("picker").addEventListener("change", () => applyNow("static", currentRGB));

  // Live text: apply ~500ms after the last keystroke -- no need to leave the field.
  // Partial/invalid input while typing is ignored silently; Enter/blur commits + reports errors.
  const liveText = (id) => () => { let rgb; try { rgb = parseColor($(id).value); } catch { return; } syncColor(rgb, true); };
  const commitText = (id) => () => {
    try { syncColor(parseColor($(id).value), false); applyNow("static", currentRGB); }
    catch (e) { setStatus(e.message, "err"); toast(e.message, "err"); }
  };
  ["hexInput", "rgbInput"].forEach((id) => {
    $(id).addEventListener("input", liveText(id));
    $(id).addEventListener("change", commitText(id));
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") commitText(id)(); });
  });

  $("fxSpectrum").addEventListener("click", () => applyNow("spectrum", null));
  $("fxBreathing").addEventListener("click", () => applyNow("breathing", currentRGB));
  $("fxWave").addEventListener("click", () => applyNow("wave", null));
  $("fxOff").addEventListener("click", () => applyNow("static", [0, 0, 0]));

  navigator.hid.addEventListener("connect", (e) => {
    refresh();
    if (e.device?.vendorId === VID)
      toast(`Connected: ${getDevice(e.device.productId)?.name || e.device.productName || "Razer device"}`, "ok");
  });
  navigator.hid.addEventListener("disconnect", (e) => {
    refresh();
    if (e.device?.vendorId === VID)
      toast(`Disconnected: ${getDevice(e.device.productId)?.name || e.device.productName || "Razer device"}`, "warn");
  });
  refresh();
}

document.addEventListener("DOMContentLoaded", init);
